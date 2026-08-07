import { Router, type Request, type Response } from 'express'
import { Server, Socket } from 'socket.io'
import { z } from 'zod'
import path from 'path'
import { promises as fs } from 'fs'
import { authMiddleware, loadUsers, type User } from './auth'

// ============================================
// 群聊模块
// 存储：backend/data/groups.json（JSON 文件，零外部依赖；位于 dist 之外，重建不丢）
//
// 功能覆盖（见产品需求）：
//  1. 创建群聊 + 群公告（群主/管理员可设，全员可见）
//  2. 公开群「火箭班」：好友列表入口，固定公开群；入群须填真实姓名，管理员审核
//  3. 打卡考勤：周一~周五 + 周日 06:20-06:35（15 分钟），逾期/迟到=缺勤
//  4. 违规处罚：累计缺勤超过阈值（管理员设定）→ 永久拉黑、移出、无法再加入；
//     被拉黑者可提交申诉，管理员可撤销拉黑
//  5. 以上管理操作仅限群管理员（群主 / 被任命管理员 / 站点管理员）
//  6. 每日早读任务：编号从 List 6 起，按日历日每天 +1（List 6 → … → 71）
// ============================================

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json')

// ---------- 类型 ----------
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0=周日 … 6=周六
export type AttendState = 'present' | 'absent'

export interface GroupMember {
  username: string
  role: 'owner' | 'admin' | 'member'
  status: 'pending' | 'approved'
  /** 公开群入群备注（真实姓名） */
  realName?: string
  joinedAt: number
  /** 被拉黑（永久，除非管理员撤销） */
  banned?: boolean
  banReason?: string
  /** 申诉内容 + 时间（被拉黑后由本人提交） */
  appeal?: string
  appealAt?: number
  /** 已读游标：用于「未读红点」计算 */
  lastReadAt?: number
}

export interface GroupTask {
  id: string
  listNumber: number // 6,7,…（早读单元编号）
  text?: string
  date: string // YYYY-MM-DD（上海时区）
  publishedAt: number
}

export interface GroupMessage {
  id: string
  type: 'message' | 'system'
  username: string
  avatar: string | null
  text: string
  timestamp: number
  sysKind?: string
}

export interface GroupAnnouncement {
  id: string
  text: string
  author: string
  createdAt: number
}

export interface CheckinRule {
  /** 需要打卡的星期（0=周日 … 6=周六），默认 [0,1,2,3,4,5] = 周日~周五 */
  weekdays: number[]
  startMin: number // 06:20 = 380
  endMin: number // 06:35 = 395
  /** 累计缺勤超过该值即拉黑（> 阈值才拉黑） */
  absentThreshold: number
}

export interface Group {
  id: string
  name: string
  description?: string
  isPublic: boolean
  /** 群主用户名；固定公开群「火箭班」owner 为空，由站点管理员管理 */
  owner: string
  createdAt: number
  announcement: GroupAnnouncement | null
  members: GroupMember[]
  tasks: GroupTask[]
  /** 首个早读任务发布的日期（List 6 起点）；未发布过则为 null */
  taskEpoch: string | null
  checkin: CheckinRule
  /** attendance[日期][用户名] = 'present' | 'absent' */
  attendance: Record<string, Record<string, AttendState>>
  /** 每个成员累计缺勤次数（持久化） */
  absenceCount: Record<string, number>
  messages: GroupMessage[]
}

const MAX_MESSAGES = 200
const MAX_TASKS = 120
const LIST_START = 6
const LIST_END = 71

// ---------- 文件读写（带缓存）----------
let groupsCache: Group[] | null = null

export async function loadGroups(): Promise<Group[]> {
  if (groupsCache) return groupsCache
  try {
    const raw = await fs.readFile(GROUPS_FILE, 'utf-8')
    groupsCache = JSON.parse(raw) as Group[]
  } catch {
    groupsCache = []
  }
  // 首次加载时确保种子群「火箭班」存在
  const seeded = seedRocketClass()
  if (seeded) await saveGroups(groupsCache)
  return groupsCache
}

export async function saveGroups(g: Group[]): Promise<void> {
  groupsCache = g
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(GROUPS_FILE, JSON.stringify(g, null, 2), 'utf-8')
}

function genId(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10)
}

// ---------- 上海时区工具 ----------
function parts(tz: string, opts: Intl.DateTimeFormatOptions, date: Date = new Date()): Record<string, string> {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, ...opts }).formatToParts(date)
  const out: Record<string, string> = {}
  for (const x of p) out[x.type] = x.value
  return out
}

function shanghaiDateStr(d: Date = new Date()): string {
  const p = parts('Asia/Shanghai', { year: 'numeric', month: '2-digit', day: '2-digit' }, d)
  return `${p.year}-${p.month}-${p.day}`
}

function shanghaiNowMin(): number {
  const p = parts('Asia/Shanghai', { hour: '2-digit', minute: '2-digit', hour12: false })
  return (Number(p.hour) % 24) * 60 + Number(p.minute)
}

function shanghaiWeekday(): Weekday {
  // Intl 周日=0 … 周六=6，与 Weekday 定义一致
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', weekday: 'short' }).format(new Date())
  const map: Record<string, Weekday> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[p] ?? 1
}

/** 两个上海日期之间的天数差（b - a，按日历日） */
function dayDiff(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime()
  const db = new Date(b + 'T00:00:00Z').getTime()
  return Math.round((db - da) / 86400000)
}

// ---------- 种子：固定公开群「火箭班」----------
function seedRocketClass(): boolean {
  if (!groupsCache) groupsCache = []
  if (groupsCache.some((g) => g.id === 'rocket' || g.name === '火箭班')) return false
  const now = Date.now()
  groupsCache.push({
    id: 'rocket',
    name: '火箭班',
    description: 'Study Room · 火箭班公开群（早读打卡 · 冲刺专升本）',
    isPublic: true,
    owner: '',
    createdAt: now,
    announcement: {
      id: genId('a_'),
      text: '欢迎加入火箭班！请于每天 6:20–6:35 在群内打卡，入群须填写真实姓名，审核通过后正式成为成员。',
      author: '系统',
      createdAt: now,
    },
    members: [],
    tasks: [],
    taskEpoch: null,
    checkin: { weekdays: [0, 1, 2, 3, 4, 5], startMin: 380, endMin: 395, absentThreshold: 3 },
    attendance: {},
    absenceCount: {},
    messages: [],
  })
  return true
}

// ---------- 权限 ----------
type AuthedReq = Request & { user?: User }

function getGroup(groups: Group[], id: string): Group | undefined {
  return groups.find((g) => g.id === id)
}

function findMember(g: Group, username: string): GroupMember | undefined {
  return g.members.find((m) => m.username === username)
}

/** 是否拥有该群的管理权限：站点管理员 / 群主 / 被任命管理员 */
function canManage(g: Group, user?: User): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (g.owner && g.owner === user.username) return true
  const m = findMember(g, user.username)
  return !!m && m.role === 'admin' && m.status === 'approved' && !m.banned
}

function isApprovedMember(g: Group, username: string): boolean {
  const m = findMember(g, username)
  return !!m && m.status === 'approved' && !m.banned
}

/** 是否拥有解散群聊的权限：站点管理员 / 群主（被任命管理员不可解散） */
function canDisband(g: Group, user?: User): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (g.owner && g.owner === user.username) return true
  return false
}

// ---------- 考勤结算（迟到=缺勤；超阈值拉黑）----------
/**
 * 结算某个群的考勤：
 * - 对每个「需要打卡的过去日期」（含今天仅当窗口已关闭），对当时已approved的成员：
 *   若当天无 present 记录 → 记 absent 并累加缺勤；缺勤 > 阈值 → 拉黑（role=member 才计，管理员/群主豁免）。
 * - 仅在记录缺失时记账，重复调用幂等。
 * 返回本次新被拉黑的用户名列表（供广播系统消息）。
 */
function evaluateGroup(g: Group): string[] {
  const newlyBanned: string[] = []
  const today = shanghaiDateStr()
  const nowMin = shanghaiNowMin()
  const rule = g.checkin

  // 结算窗口：从建群日次日 到 今天（今天仅当窗口已关闭才结算）
  const start = new Date(g.createdAt)
  const startStr = shanghaiDateStr(start)
  let cursor = new Date(startStr + 'T00:00:00Z')
  const end = new Date(today + 'T00:00:00Z')
  // 最多回溯 400 天，防止极端数据
  let guard = 0
  while (cursor.getTime() <= end.getTime() && guard++ < 400) {
    const ds = shanghaiDateStr(cursor)
    const wd = shanghaiWeekdayAt(cursor)
    const isToday = ds === today
    const windowClosed = !isToday || nowMin > rule.endMin
    if (rule.weekdays.includes(wd) && windowClosed) {
      if (!g.attendance[ds]) g.attendance[ds] = {}
      for (const m of g.members) {
        if (m.status !== 'approved' || m.banned) continue
        if (m.role === 'owner' || m.role === 'admin') continue // 管理岗豁免考勤
        // 入群前的日期不计缺勤
        if (shanghaiDateStr(new Date(m.joinedAt)) > ds) continue
        if (g.attendance[ds][m.username] === 'present') continue
        if (g.attendance[ds][m.username] === 'absent') continue
        // 记一次缺勤
        g.attendance[ds][m.username] = 'absent'
        const cnt = (g.absenceCount[m.username] || 0) + 1
        g.absenceCount[m.username] = cnt
        if (cnt > rule.absentThreshold && !m.banned) {
          m.banned = true
          m.banReason = `累计缺勤 ${cnt} 次，超过阈值 ${rule.absentThreshold}，已移出群聊`
          newlyBanned.push(m.username)
        }
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return newlyBanned
}

/** 指定 Date 的上海星期（0=周日…6=周六） */
function shanghaiWeekdayAt(d: Date): Weekday {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', weekday: 'short' }).format(d)
  const map: Record<string, Weekday> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[p] ?? 1
}

// ---------- 早读任务编号 ----------
function computeListNumber(g: Group, today: string): number {
  if (!g.taskEpoch) return LIST_START
  const diff = dayDiff(g.taskEpoch, today)
  return Math.min(LIST_END, LIST_START + Math.max(0, diff))
}

// ============================================================
// Socket.IO 群聊房间
// ============================================================
let groupIo: Server | null = null

export function registerGroups(io: Server): void {
  groupIo = io
  io.on('connection', async (socket: Socket) => {
    const token = (socket.handshake.auth && (socket.handshake.auth as Record<string, unknown>).token) as string | undefined
    const me = token ? (await loadUsers().then((us) => us.find((u) => u.token === token)?.username)) : null
    if (!me) return

    const joinedRooms = new Set<string>()

    socket.on('group:join', async (data?: { groupId?: string }) => {
      const groupId = data?.groupId
      if (!groupId) return
      const groups = await loadGroups()
      const g = getGroup(groups, groupId)
      if (!g) {
        socket.emit('group:error', { message: '群聊不存在' })
        return
      }
      if (!isApprovedMember(g, me)) {
        socket.emit('group:error', { message: '你还没有加入该群聊' })
        return
      }
      socket.join('group:' + groupId)
      joinedRooms.add(groupId)
      // 更新已读游标
      const m = findMember(g, me)
      if (m) {
        m.lastReadAt = Date.now()
        await saveGroups(groups)
      }
      socket.emit('group:history', g.messages.slice(-100))
      socket.emit('group:meta', {
        id: g.id,
        name: g.name,
        announcement: g.announcement,
        checkin: g.checkin,
        taskListNumberToday: computeListNumber(g, shanghaiDateStr()),
      })
    })

    socket.on('group:message', async (data?: { groupId?: string; text?: string }) => {
      const groupId = data?.groupId
      const text = (data?.text || '').trim()
      if (!groupId || !text || text.length > 500) return
      const groups = await loadGroups()
      const g = getGroup(groups, groupId)
      if (!g || !isApprovedMember(g, me)) return
      const users = await loadUsers()
      const u = users.find((x) => x.username === me)
      const msg: GroupMessage = {
        id: genId('m_'),
        type: 'message',
        username: me,
        avatar: u?.avatar ?? null,
        text,
        timestamp: Date.now(),
      }
      g.messages.push(msg)
      if (g.messages.length > MAX_MESSAGES) g.messages.shift()
      await saveGroups(groups)
      io.to('group:' + groupId).emit('group:message', msg)
    })

    // 管理员删除单条消息
    socket.on('group:delete', async (data?: { groupId?: string; id?: string }) => {
      const groupId = data?.groupId
      const id = data?.id
      if (!groupId || !id) return
      const groups = await loadGroups()
      const g = getGroup(groups, groupId)
      if (!g) return
      if (!canManage(g, await loadUsers().then((us) => us.find((x) => x.username === me)))) {
        socket.emit('group:error', { message: '只有群管理员可以删除消息' })
        return
      }
      const idx = g.messages.findIndex((m) => m.id === id)
      if (idx === -1) return
      g.messages.splice(idx, 1)
      await saveGroups(groups)
      io.to('group:' + groupId).emit('group:deleted', { id })
    })

    socket.on('group:leave', async (data?: { groupId?: string }) => {
      const groupId = data?.groupId
      if (groupId) {
        socket.leave('group:' + groupId)
        joinedRooms.delete(groupId)
      }
    })

    socket.on('disconnect', () => {
      for (const gid of joinedRooms) socket.leave('group:' + gid)
      joinedRooms.clear()
    })
  })

  // 周期性考勤结算（每 5 分钟），自动拉黑超阈值成员并广播系统消息
  const timer = setInterval(async () => {
    try {
      const groups = await loadGroups()
      let changed = false
      for (const g of groups) {
        const banned = evaluateGroup(g)
        if (banned.length) {
          changed = true
          for (const name of banned) {
            io.to('group:' + g.id).emit('group:message', {
              id: genId('m_'),
              type: 'system',
              username: '系统',
              avatar: null,
              text: `${name} 因累计缺勤被移出群聊`,
              timestamp: Date.now(),
              sysKind: 'ban',
            } as GroupMessage)
          }
        }
      }
      if (changed) await saveGroups(groups)
    } catch {
      /* ignore */
    }
  }, 5 * 60 * 1000)
  // 不阻止进程退出
  timer.unref?.()
}

// ============================================================
// REST 路由
// ============================================================
export const groupRouter: Router = Router()
groupRouter.use(authMiddleware)

// 当前用户能看到的「精简群信息」
function publicView(g: Group) {
  return {
    id: g.id,
    name: g.name,
    description: g.description ?? null,
    isPublic: g.isPublic,
    owner: g.owner,
    memberCount: g.members.filter((m) => m.status === 'approved' && !m.banned).length,
    pendingCount: g.members.filter((m) => m.status === 'pending').length,
  }
}

// 群完整详情（按身份裁剪）
function detailView(g: Group, me: string, user?: User): Record<string, unknown> {
  const member = findMember(g, me)
  const approved = !!member && member.status === 'approved' && !member.banned
  const manage = canManage(g, user)
  const today = shanghaiDateStr()
  const nowMin = shanghaiNowMin()
  const inWindow = nowMin >= g.checkin.startMin && nowMin <= g.checkin.endMin
  const isCheckinDay = g.checkin.weekdays.includes(shanghaiWeekday())
  const myStatus = member ? (member.banned ? 'banned' : member.status) : 'none'
  const unread = approved && member?.lastReadAt
    ? g.messages.filter((m) => m.timestamp > (member.lastReadAt || 0) && m.username !== me).length
    : 0

  const view: Record<string, unknown> = {
    id: g.id,
    name: g.name,
    description: g.description ?? null,
    isPublic: g.isPublic,
    owner: g.owner,
    createdAt: g.createdAt,
    announcement: g.announcement,
    checkin: g.checkin,
    myStatus,
    myRole: member?.role ?? null,
    canManage: manage,
    canDisband: canDisband(g, user),
    canChat: approved,
    taskListNumberToday: computeListNumber(g, today),
    todayInfo: {
      date: today,
      isCheckinDay,
      inWindow,
      checkedIn: approved ? g.attendance[today]?.[me] === 'present' : false,
    },
    unread,
    memberCount: g.members.filter((m) => m.status === 'approved' && !m.banned).length,
    tasks: g.tasks.slice(-10).reverse(),
    // 非成员仅看元信息；成员/管理员看成员列表
    members: approved || manage ? g.members : [],
    myAppeal: member?.banned ? member.appeal ?? null : null,
  }
  return view
}

// 创建群聊（任意登录用户）
const createSchema = z.object({
  name: z.string().trim().min(2, '群名至少 2 个字').max(20, '群名最多 20 字'),
  description: z.string().trim().max(200, '简介最多 200 字').optional(),
  isPublic: z.boolean().optional(),
})
groupRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  const me = (req as AuthedReq).user!.username
  const groups = await loadGroups()
  const now = Date.now()
  const g: Group = {
    id: genId('g_'),
    name: parsed.data.name,
    description: parsed.data.description,
    isPublic: !!parsed.data.isPublic,
    owner: me,
    createdAt: now,
    announcement: null,
    members: [{ username: me, role: 'owner', status: 'approved', joinedAt: now, lastReadAt: now }],
    tasks: [],
    taskEpoch: null,
    checkin: { weekdays: [0, 1, 2, 3, 4, 5], startMin: 380, endMin: 395, absentThreshold: 3 },
    attendance: {},
    absenceCount: {},
    messages: [],
  }
  groups.push(g)
  await saveGroups(groups)
  return res.status(201).json(publicView(g))
})

// 群列表：公开群 + 我加入的群
groupRouter.get('/', async (req: Request, res: Response) => {
  const me = (req as AuthedReq).user!.username
  const groups = await loadGroups()
  const publicGroups = groups.filter((g) => g.isPublic).map(publicView)
  const myGroups = groups
    .filter((g) => isApprovedMember(g, me))
    .map((g) => {
      const m = findMember(g, me)!
      const unread = g.messages.filter((x) => x.timestamp > (m.lastReadAt || 0) && x.username !== me).length
      return { ...publicView(g), myRole: m.role, unread, taskListNumberToday: computeListNumber(g, shanghaiDateStr()) }
    })
  return res.json({ publicGroups, myGroups })
})

// 群详情
groupRouter.get('/:id', async (req: Request, res: Response) => {
  const me = (req as AuthedReq).user!.username
  const groups = await loadGroups()
  const g = getGroup(groups, String(req.params.id))
  if (!g) return res.status(404).json({ message: '群聊不存在' })
  if (!g.isPublic && !isApprovedMember(g, me)) {
    return res.status(403).json({ message: '你还没有加入该群聊' })
  }
  return res.json(detailView(g, me, (req as AuthedReq).user))
})

// 申请加入群聊（公开群须填真实姓名，管理员审核）
const joinSchema = z.object({
  note: z.string().trim().max(40, '备注最多 40 字').optional(),
})
groupRouter.post('/:id/join', async (req: Request, res: Response) => {
  const me = (req as AuthedReq).user!.username
  const parsed = joinSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  const groups = await loadGroups()
  const g = getGroup(groups, String(req.params.id))
  if (!g) return res.status(404).json({ message: '群聊不存在' })
  const existing = findMember(g, me)
  if (existing) {
    if (existing.banned) return res.status(403).json({ message: '你已被移出该群，无法再次加入' })
    if (existing.status === 'pending') return res.status(409).json({ message: '入群申请已提交，等待管理员审核' })
    return res.status(409).json({ message: '你已是该群成员' })
  }
  if (g.isPublic) {
    const realName = parsed.data.note?.trim()
    if (!realName || realName.length < 2) return res.status(400).json({ message: '公开群入群须填写真实姓名' })
    g.members.push({ username: me, role: 'member', status: 'pending', realName, joinedAt: Date.now() })
  } else {
    g.members.push({ username: me, role: 'member', status: 'pending', joinedAt: Date.now() })
  }
  await saveGroups(groups)
  return res.json({ status: 'pending' })
})

// 管理员：审核通过
const targetSchema = z.object({ username: z.string().trim().min(1, '用户名不能为空') })
groupRouter.post('/:id/approve', async (req: Request, res: Response) => {
  const parsed = targetSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '参数错误' })
  const groups = await loadGroups()
  const g = getGroup(groups, String(req.params.id))
  if (!g) return res.status(404).json({ message: '群聊不存在' })
  if (!canManage(g, (req as AuthedReq).user)) return res.status(403).json({ message: '需要群管理员权限' })
  const m = findMember(g, parsed.data.username)
  if (!m || m.status !== 'pending') return res.status(404).json({ message: '没有待审核的申请' })
  m.status = 'approved'
  m.joinedAt = Date.now()
  m.lastReadAt = Date.now()
  await saveGroups(groups)
  if (groupIo) {
    groupIo.to('group:' + g.id).emit('group:message', {
      id: genId('m_'), type: 'system', username: '系统', avatar: null,
      text: `${m.username} 已通过审核，加入群聊`, timestamp: Date.now(), sysKind: 'join',
    } as GroupMessage)
  }
  return res.json({ status: 'approved' })
})

// 管理员：拒绝/移除待审核
groupRouter.post('/:id/reject', async (req: Request, res: Response) => {
  const parsed = targetSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '参数错误' })
  const groups = await loadGroups()
  const g = getGroup(groups, String(req.params.id))
  if (!g) return res.status(404).json({ message: '群聊不存在' })
  if (!canManage(g, (req as AuthedReq).user)) return res.status(403).json({ message: '需要群管理员权限' })
  g.members = g.members.filter((m) => !(m.username === parsed.data.username && m.status === 'pending'))
  await saveGroups(groups)
  return res.json({ status: 'rejected' })
})

// 退出群聊（群主不可退出）
groupRouter.post('/:id/leave', async (req: Request, res: Response) => {
  const me = (req as AuthedReq).user!.username
  const groups = await loadGroups()
  const g = getGroup(groups, String(req.params.id))
  if (!g) return res.status(404).json({ message: '群聊不存在' })
  const m = findMember(g, me)
  if (!m) return res.status(404).json({ message: '你不是该群成员' })
  if (m.role === 'owner') return res.status(400).json({ message: '群主不能退出群聊' })
  g.members = g.members.filter((x) => x.username !== me)
  await saveGroups(groups)
  return res.json({ status: 'left' })
})

// 管理员：设置群公告
const announceSchema = z.object({ text: z.string().trim().min(1, '公告不能为空').max(500, '公告最多 500 字') })
groupRouter.post('/:id/announce', async (req: Request, res: Response) => {
  const parsed = announceSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  const groups = await loadGroups()
  const g = getGroup(groups, String(req.params.id))
  if (!g) return res.status(404).json({ message: '群聊不存在' })
  if (!canManage(g, (req as AuthedReq).user)) return res.status(403).json({ message: '需要群管理员权限' })
  const ann: GroupAnnouncement = { id: genId('a_'), text: parsed.data.text, author: (req as AuthedReq).user!.username, createdAt: Date.now() }
  g.announcement = ann
  await saveGroups(groups)
  if (groupIo) groupIo.to('group:' + g.id).emit('group:announcement', ann)
  return res.json(ann)
})

// 打卡（仅窗口内、打卡日、已approve且未拉黑）
groupRouter.post('/:id/checkin', async (req: Request, res: Response) => {
  const me = (req as AuthedReq).user!.username
  const groups = await loadGroups()
  const g = getGroup(groups, String(req.params.id))
  if (!g) return res.status(404).json({ message: '群聊不存在' })
  if (!isApprovedMember(g, me)) return res.status(403).json({ message: '你还没有加入该群聊' })
  const today = shanghaiDateStr()
  const nowMin = shanghaiNowMin()
  if (!g.checkin.weekdays.includes(shanghaiWeekday())) return res.status(400).json({ message: '今天不是打卡日' })
  if (nowMin < g.checkin.startMin || nowMin > g.checkin.endMin) {
    const fmt = (x: number) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`
    return res.status(400).json({ message: `打卡时间为 ${fmt(g.checkin.startMin)}–${fmt(g.checkin.endMin)}` })
  }
  if (!g.attendance[today]) g.attendance[today] = {}
  if (g.attendance[today][me] === 'present') return res.status(400).json({ message: '今日已打卡' })
  g.attendance[today][me] = 'present'
  await saveGroups(groups)
  if (groupIo) groupIo.to('group:' + g.id).emit('group:event', { type: 'checkin', username: me, date: today })
  return res.json({ checkedIn: true, date: today })
})

// 管理员：查看考勤（全量近期 + 缺勤统计 + 待申诉）
groupRouter.get('/:id/attendance', async (req: Request, res: Response) => {
  const groups = await loadGroups()
  const g = getGroup(groups, String(req.params.id))
  if (!g) return res.status(404).json({ message: '群聊不存在' })
  if (!canManage(g, (req as AuthedReq).user)) return res.status(403).json({ message: '需要群管理员权限' })
  evaluateGroup(g)
  await saveGroups(groups)
  // 近期日期（倒序，最多 30 天）
  const dates = Object.keys(g.attendance).sort().reverse().slice(0, 30)
  const appeals = g.members.filter((m) => m.banned && m.appeal).map((m) => ({ username: m.username, appeal: m.appeal, appealAt: m.appealAt }))
  return res.json({
    checkin: g.checkin,
    dates,
    attendance: g.attendance,
    absenceCount: g.absenceCount,
    members: g.members,
    appeals,
    listNumberToday: computeListNumber(g, shanghaiDateStr()),
  })
})

// 管理员：调整打卡规则
const ruleSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  startMin: z.number().int().min(0).max(1439).optional(),
  endMin: z.number().int().min(0).max(1439).optional(),
  absentThreshold: z.number().int().min(1).max(30).optional(),
})
groupRouter.post('/:id/checkin-rule', async (req: Request, res: Response) => {
  const parsed = ruleSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '参数错误' })
  const groups = await loadGroups()
  const g = getGroup(groups, String(req.params.id))
  if (!g) return res.status(404).json({ message: '群聊不存在' })
  if (!canManage(g, (req as AuthedReq).user)) return res.status(403).json({ message: '需要群管理员权限' })
  const r = parsed.data
  if (r.weekdays) g.checkin.weekdays = r.weekdays
  if (typeof r.startMin === 'number') g.checkin.startMin = r.startMin
  if (typeof r.endMin === 'number') g.checkin.endMin = r.endMin
  if (typeof r.absentThreshold === 'number') g.checkin.absentThreshold = r.absentThreshold
  if (g.checkin.endMin <= g.checkin.startMin) return res.status(400).json({ message: '结束时间须晚于开始时间' })
  await saveGroups(groups)
  return res.json(g.checkin)
})

// 管理员：发布今日早读任务（List 6 起按日历日递增，幂等）
const taskSchema = z.object({ text: z.string().trim().max(300, '说明最多 300 字').optional() })
groupRouter.post('/:id/task', async (req: Request, res: Response) => {
  const parsed = taskSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  const groups = await loadGroups()
  const g = getGroup(groups, String(req.params.id))
  if (!g) return res.status(404).json({ message: '群聊不存在' })
  if (!canManage(g, (req as AuthedReq).user)) return res.status(403).json({ message: '需要群管理员权限' })
  const today = shanghaiDateStr()
  const existing = g.tasks.find((t) => t.date === today)
  if (existing) return res.json(existing)
  if (!g.taskEpoch) g.taskEpoch = today
  const listNumber = computeListNumber(g, today)
  const task: GroupTask = { id: genId('t_'), listNumber, text: parsed.data.text, date: today, publishedAt: Date.now() }
  g.tasks.push(task)
  if (g.tasks.length > MAX_TASKS) g.tasks.shift()
  await saveGroups(groups)
  if (groupIo) groupIo.to('group:' + g.id).emit('group:task', task)
  return res.json(task)
})

// 被拉黑者提交申诉
const appealSchema = z.object({ text: z.string().trim().min(1, '申诉内容不能为空').max(300, '申诉最多 300 字') })
groupRouter.post('/:id/appeal', async (req: Request, res: Response) => {
  const me = (req as AuthedReq).user!.username
  const parsed = appealSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  const groups = await loadGroups()
  const g = getGroup(groups, String(req.params.id))
  if (!g) return res.status(404).json({ message: '群聊不存在' })
  const m = findMember(g, me)
  if (!m || !m.banned) return res.status(403).json({ message: '你不在被拉黑状态' })
  m.appeal = parsed.data.text
  m.appealAt = Date.now()
  await saveGroups(groups)
  return res.json({ ok: true })
})

// 管理员：撤销拉黑（恢复成员资格，缺勤计数清零）
groupRouter.post('/:id/unban', async (req: Request, res: Response) => {
  const parsed = targetSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '参数错误' })
  const groups = await loadGroups()
  const g = getGroup(groups, String(req.params.id))
  if (!g) return res.status(404).json({ message: '群聊不存在' })
  if (!canManage(g, (req as AuthedReq).user)) return res.status(403).json({ message: '需要群管理员权限' })
  const m = findMember(g, parsed.data.username)
  if (!m || !m.banned) return res.status(404).json({ message: '该成员未被拉黑' })
  m.banned = false
  m.banReason = undefined
  m.appeal = undefined
  m.appealAt = undefined
  m.status = 'approved'
  m.lastReadAt = Date.now()
  g.absenceCount[m.username] = 0
  await saveGroups(groups)
  if (groupIo) {
    groupIo.to('group:' + g.id).emit('group:message', {
      id: genId('m_'), type: 'system', username: '系统', avatar: null,
      text: `${m.username} 的拉黑已撤销，恢复群成员资格`, timestamp: Date.now(), sysKind: 'unban',
    } as GroupMessage)
  }
  return res.json({ status: 'unbanned' })
})

// 管理员：移除成员（不可移除群主）
groupRouter.post('/:id/remove', async (req: Request, res: Response) => {
  const parsed = targetSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '参数错误' })
  const me = (req as AuthedReq).user!.username
  const groups = await loadGroups()
  const g = getGroup(groups, String(req.params.id))
  if (!g) return res.status(404).json({ message: '群聊不存在' })
  if (!canManage(g, (req as AuthedReq).user)) return res.status(403).json({ message: '需要群管理员权限' })
  const m = findMember(g, parsed.data.username)
  if (!m) return res.status(404).json({ message: '成员不存在' })
  if (m.role === 'owner') return res.status(400).json({ message: '不能移除群主' })
  if (m.username === me) return res.status(400).json({ message: '不能移除自己，群主可退出，管理员请联系群主' })
  g.members = g.members.filter((x) => x.username !== parsed.data.username)
  await saveGroups(groups)
  if (groupIo) {
    groupIo.to('group:' + g.id).emit('group:message', {
      id: genId('m_'), type: 'system', username: '系统', avatar: null,
      text: `${parsed.data.username} 已被移出群聊`, timestamp: Date.now(), sysKind: 'kick',
    } as GroupMessage)
  }
  return res.json({ status: 'removed' })
})

// 管理员：设置成员角色（owner 不可改；可任命/取消 admin）
const roleSchema = z.object({ username: z.string().trim().min(1), role: z.enum(['admin', 'member']) })
groupRouter.post('/:id/role', async (req: Request, res: Response) => {
  const parsed = roleSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '参数错误' })
  const groups = await loadGroups()
  const g = getGroup(groups, String(req.params.id))
  if (!g) return res.status(404).json({ message: '群聊不存在' })
  if (!canManage(g, (req as AuthedReq).user)) return res.status(403).json({ message: '需要群管理员权限' })
  const m = findMember(g, parsed.data.username)
  if (!m) return res.status(404).json({ message: '成员不存在' })
  if (m.role === 'owner') return res.status(400).json({ message: '不能修改群主角色' })
  m.role = parsed.data.role
  await saveGroups(groups)
  return res.json({ username: m.username, role: m.role })
})

// 群主 / 站点管理员：解散群聊（群聊彻底删除，所有成员移出）
groupRouter.post('/:id/disband', async (req: Request, res: Response) => {
  const me = (req as AuthedReq).user!
  const groups = await loadGroups()
  const g = getGroup(groups, String(req.params.id))
  if (!g) return res.status(404).json({ message: '群聊不存在' })
  if (!canDisband(g, me)) return res.status(403).json({ message: '只有群主或管理员可以解散群聊' })
  if (groupIo) {
    groupIo.to('group:' + g.id).emit('group:message', {
      id: genId('m_'), type: 'system', username: '系统', avatar: null,
      text: '该群聊已解散', timestamp: Date.now(), sysKind: 'disband',
    } as GroupMessage)
    groupIo.to('group:' + g.id).emit('group:disbanded', { id: g.id })
  }
  const idx = groups.findIndex((x) => x.id === g.id)
  if (idx >= 0) groups.splice(idx, 1)
  await saveGroups(groups)
  return res.json({ status: 'disbanded' })
})
