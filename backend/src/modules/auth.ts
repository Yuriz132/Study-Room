import { Router, type Request, type Response, type NextFunction } from 'express'
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { z } from 'zod'
import { recordLearningActivity } from './leaderboard'
import { ipGuardRegister, ipGuardLogin, recordRegistration } from './ipGuard'

// ============================================
// 账户 + 云端学习进度模块
// 存储：backend/data/users.json（JSON 文件，零外部依赖；位于 dist 之外，重建不会丢失）
// 密码：scrypt 加盐哈希，绝不存明文
// ============================================

// __dirname 在编译后为 dist/modules，开发期为 src/modules，向上两级均到达 backend 根目录，
// 因此数据目录稳定落在 backend/data，不受 tsc 重新生成 dist 的影响。
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

// ---------- 类型 ----------
export interface StudyPlan {
  id: string
  type: 'units' | 'words' | 'custom'
  title: string
  target: number
  // type=units 时：选中的 listKey 列表
  selectedLists?: string[]
  // 仅自定义任务(type=custom)使用：子任务清单
  tasks?: { id: string; text: string; done: boolean }[]
  createdAt: number
}

export interface SavedArticle {
  id: string
  title: string
  content: string
  usedWords: string[]
  target: number
  theme: string
  createdAt: number
}

// SRS 间隔复习记录（与前端 lib/reviews.ts 结构一致；JSON 键为字符串）
interface ReviewRecord {
  reps: number
  ease: number
  interval: number
  due: number
  last: number
  grade?: 'good' | 'vague' | 'forget'
}

/** 个人笔记（支持文字与图片） */
interface Note {
  id: string
  title: string
  content: string
  images?: string[]
  createdAt: number
  updatedAt: number
}

/** 错题合集中的单条错题（拍照识别或手动输入） */
export interface WrongItem {
  id: string
  text: string
  /** 拍照来源时保存压缩后的图片 data URL，便于回看原题 */
  imageUrl?: string
  source: 'photo' | 'text'
  createdAt: number
}

/** 错题合集：可建多个，每个合集带隔离的 AI 分析与对话 */
export interface WrongCollection {
  id: string
  name: string
  createdAt: number
  items: WrongItem[]
  messages: { role: 'user' | 'assistant'; text: string; createdAt: number }[]
}

interface ProgressData {
  starred: number[]
  known: number[]
  progress: Record<string, { reviewed: number; total: number }>
  plans: StudyPlan[]
  savedArticles?: SavedArticle[]
  reviews?: Record<string, ReviewRecord>
  notes?: Note[]
}

export interface User {
  username: string
  salt: string
  passwordHash: string
  token: string | null
  role?: 'admin'
  pkWins?: number
  /** 头像（压缩后的图片 data URI；null 表示使用默认字母头像） */
  avatar?: string | null
  /** 管理员封禁头像：为 true 时前端不显示头像，且本人无法修改 */
  avatarBanned?: boolean
  /** 个性签名（用户自定义，≤80 字） */
  signature?: string
  progress: ProgressData
  /** 错题合集（云端持久化，每个用户独立） */
  wrongCollections?: WrongCollection[]
  /** 服务器端签到日期记录（YYYY-MM-DD，活动期间逐日追加） */
  checkinDates?: string[]
  /** 最早连续签满 3 天的服务器时间戳(ms)，用于「谁先达标」排序判定 */
  checkinFirstAt?: number
}

type AuthedRequest = Request & { user?: User }

const EMPTY_PROGRESS: ProgressData = { starred: [], known: [], progress: {}, plans: [], savedArticles: [], reviews: {}, notes: [] }

/** 合并已生成文章：按 id 去重，云端优先（incoming 覆盖同 id 的已有项），最新在前 */
function mergeSavedArticles(existing: SavedArticle[], incoming: SavedArticle[]): SavedArticle[] {
  const map = new Map<string, SavedArticle>()
  for (const a of existing) map.set(a.id, a)
  for (const a of incoming) map.set(a.id, a)
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt)
}

// ---------- 文件读写（带缓存，减少磁盘 IO）----------
let usersCache: User[] | null = null

export async function loadUsers(): Promise<User[]> {
  if (usersCache) return usersCache
  try {
    const raw = await fs.readFile(USERS_FILE, 'utf-8')
    usersCache = JSON.parse(raw) as User[]
  } catch {
    usersCache = []
  }
  return usersCache
}

export async function saveUsers(users: User[]): Promise<void> {
  usersCache = users
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8')
}

// ---------- 密码哈希 ----------
function hashPassword(password: string): { salt: string; passwordHash: string } {
  const salt = randomBytes(16).toString('hex')
  const passwordHash = scryptSync(password, salt, 64).toString('hex')
  return { salt, passwordHash }
}

export function verifyPassword(password: string, salt: string, passwordHash: string): boolean {
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(passwordHash, 'hex')
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

function publicUser(u: User): { username: string; token: string; role?: string; avatar?: string | null; avatarBanned?: boolean; signature?: string | null } {
  return { username: u.username, token: u.token as string, role: u.role, avatar: u.avatar ?? null, avatarBanned: !!u.avatarBanned, signature: u.signature ?? null }
}

/** 校验头像 data URI：仅允许图片格式，解码后 ≤ 1MB，魔术字节校验防伪造 */
function validateAvatarDataUri(dataUri: string): Buffer | null {
  const m = /^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(dataUri)
  if (!m) return null
  let ext = m[1].toLowerCase()
  if (ext === 'jpeg') ext = 'jpg'
  let buf: Buffer
  try {
    buf = Buffer.from(m[2], 'base64')
  } catch {
    return null
  }
  if (buf.length > 1024 * 1024) return null
  const okMagic =
    (ext === 'jpg' && buf[0] === 0xff && buf[1] === 0xd8) ||
    (ext === 'png' && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) ||
    (ext === 'webp' && buf.slice(8, 12).toString('ascii') === 'WEBP') ||
    (ext === 'gif' && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46)
  return okMagic ? buf : null
}

/** 通过 Bearer token 解析用户（供 socket.io 握手鉴权复用） */
export async function getUserByToken(token?: string | null): Promise<User | null> {
  if (!token) return null
  const users = await loadUsers()
  return users.find((u) => u.token === token) || null
}

/** 记录一次 PK 胜利（参与真人对战且获胜时调用） */
export async function recordPkWin(username: string): Promise<void> {
  if (!username) return
  const users = await loadUsers()
  const u = users.find((x) => x.username === username)
  if (!u) return
  u.pkWins = (u.pkWins || 0) + 1
  await saveUsers(users)
}

// ---------- 鉴权中间件 ----------
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: '未登录或登录已过期' })
    return
  }
  const token = header.slice('Bearer '.length).trim()
  loadUsers()
    .then((users) => {
      const user = users.find((u) => u.token === token)
      if (!user) {
        res.status(401).json({ message: '登录已过期，请重新登录' })
        return
      }
      ;(req as AuthedRequest).user = user
      next()
    })
    .catch(() => {
      res.status(500).json({ message: '服务器内部错误' })
    })
}

/** 管理员鉴权：必须在 authMiddleware 之后使用 */
export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthedRequest).user
  if (!user || user.role !== 'admin') {
    res.status(403).json({ message: '需要管理员权限' })
    return
  }
  next()
}

// ---------- 校验 schema ----------
const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, '用户名至少 2 个字符')
    .max(8, '用户名最多 8 个字符')
    .regex(/^[a-zA-Z0-9_\u4e00-\u9fff]+$/, '用户名仅限字母、数字、下划线、中文'),
  password: z.string().min(6, '密码至少 6 位').max(64, '密码过长'),
})

const planSchema = z.object({
  id: z.string(),
  type: z.enum(['units', 'words', 'custom']),
  title: z.string(),
  target: z.number().int().nonnegative(),
  selectedLists: z.array(z.string()).optional(),
  tasks: z
    .array(z.object({ id: z.string(), text: z.string(), done: z.boolean() }))
    .optional(),
  createdAt: z.number(),
})

const savedArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  usedWords: z.array(z.string()),
  target: z.number(),
  theme: z.string(),
  createdAt: z.number(),
})

const reviewRecordSchema = z.object({
  reps: z.number().int().nonnegative(),
  ease: z.number(),
  interval: z.number().nonnegative(),
  due: z.number(),
  last: z.number(),
  grade: z.enum(['good', 'vague', 'forget']).optional(),
})

const noteSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  images: z.array(z.string()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const progressSchema = z
  .object({
    starred: z.array(z.number().int()).optional(),
    known: z.array(z.number().int()).optional(),
    progress: z
      .record(z.string(), z.object({ reviewed: z.number().int(), total: z.number().int() }))
      .optional(),
    plans: z.array(planSchema).optional(),
    savedArticles: z.array(savedArticleSchema).optional(),
    reviews: z.record(z.string(), reviewRecordSchema).optional(),
    notes: z.array(noteSchema).optional(),
  })
  .refine(
    (d) =>
      d.starred !== undefined ||
      d.known !== undefined ||
      d.progress !== undefined ||
      d.plans !== undefined ||
      d.savedArticles !== undefined ||
      d.reviews !== undefined ||
      d.notes !== undefined,
    {
      message: '至少提供 starred / known / progress / plans / savedArticles / reviews / notes 中的一项',
    }
  )

const GEETEST_CAPTCHA_ID = process.env.GEETEST_CAPTCHA_ID || ''
const GEETEST_CAPTCHA_KEY = process.env.GEETEST_CAPTCHA_KEY || ''
const GEETEST_API = 'http://gcaptcha4.geetest.com/validate'

async function verifyGeetest(params?: { lot_number?: string; captcha_output?: string; pass_token?: string; gen_time?: string }): Promise<boolean> {
  // 未配置密钥则不强制人机验证
  if (!GEETEST_CAPTCHA_ID || !GEETEST_CAPTCHA_KEY) return true
  if (!params?.lot_number || !params?.captcha_output || !params?.pass_token || !params?.gen_time) {
    return false
  }
  // 生成签名：HMAC-SHA256(lot_number, captcha_key)
  const sign_token = createHmac('sha256', GEETEST_CAPTCHA_KEY).update(params.lot_number).digest('hex')
  try {
    const body = new URLSearchParams({
      lot_number: params.lot_number,
      captcha_output: params.captcha_output,
      pass_token: params.pass_token,
      gen_time: params.gen_time,
      sign_token,
    })
    const r = await fetch(`${GEETEST_API}?captcha_id=${GEETEST_CAPTCHA_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(5000),
    })
    if (!r.ok) return true // 容灾：极验服务异常时放行，不阻塞用户
    const j: any = await r.json()
    return j?.result === 'success'
  } catch {
    return true // 容灾：网络异常时放行，不阻塞用户
  }
}

export const authRouter: Router = Router()

// 注册：仅记录账号密码
authRouter.post('/auth/register', ipGuardRegister, async (req: Request, res: Response) => {
  const parsed = credentialsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const { username, password } = parsed.data

  // 蜜罐：机器人常无差别填全字段；正常用户不会填此隐藏项
  const hp = (req.body as any)?.hp
  if (hp) return res.status(400).json({ message: '注册失败，请稍后再试' })
  // 极验行为验证（未配置密钥时跳过，不强制）
  const geetestParams = (req.body as any)?.geetest
  if (!(await verifyGeetest(geetestParams))) {
    return res.status(GEETEST_CAPTCHA_ID ? 403 : 400).json({
      message: GEETEST_CAPTCHA_ID ? '请先完成人机验证' : '注册失败，请稍后再试',
    })
  }

  const users = await loadUsers()
  if (users.some((u) => u.username === username)) {
    return res.status(409).json({ message: '该用户名已被注册' })
  }
  const { salt, passwordHash } = hashPassword(password)
  const token = generateToken()
  const user: User = {
    username,
    salt,
    passwordHash,
    token,
    progress: { ...EMPTY_PROGRESS },
  }
  users.push(user)
  await saveUsers(users)
  recordRegistration(req)
  return res.status(201).json(publicUser(user))
})

// 登录
authRouter.post('/auth/login', ipGuardLogin, async (req: Request, res: Response) => {
  const parsed = credentialsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const { username, password } = parsed.data
  const users = await loadUsers()
  const user = users.find((u) => u.username === username)
  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    return res.status(401).json({ message: '用户名或密码错误' })
  }
  // 每次登录轮换 token
  user.token = generateToken()
  await saveUsers(users)
  return res.json(publicUser(user))
})

// 获取当前登录用户信息（用户名+角色+头像状态）
authRouter.get('/auth/me', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user as User
  return res.json({ username: user.username, role: user.role, avatar: user.avatar ?? null, avatarBanned: !!user.avatarBanned, signature: user.signature ?? null })
})

// 头像：仅本人可设置 / 清除
const avatarSchema = z.object({ avatar: z.string().min(1).max(1_400_000) })

authRouter.put('/auth/avatar', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user as User
  if (user.avatarBanned) {
    return res.status(403).json({ message: '你的头像已被管理员封禁，暂时无法修改' })
  }
  const parsed = avatarSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: '头像数据无效' })
  }
  if (!validateAvatarDataUri(parsed.data.avatar)) {
    return res.status(400).json({ message: '仅支持 jpg/png/webp/gif 图片，且大小不超过 1MB' })
  }
  user.avatar = parsed.data.avatar
  const users = await loadUsers()
  const idx = users.findIndex((u) => u.username === user.username)
  if (idx >= 0) users[idx] = user
  await saveUsers(users)
  return res.json({ avatar: user.avatar, avatarBanned: !!user.avatarBanned })
})

authRouter.delete('/auth/avatar', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user as User
  user.avatar = null
  const users = await loadUsers()
  const idx = users.findIndex((u) => u.username === user.username)
  if (idx >= 0) users[idx] = user
  await saveUsers(users)
  return res.json({ avatar: null, avatarBanned: !!user.avatarBanned })
})

// 管理员：封禁 / 解封某用户头像
const banSchema = z.object({ username: z.string().min(1), banned: z.boolean() })

authRouter.post('/auth/admin/avatar-ban', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const parsed = banSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: '参数错误' })
  }
  const { username, banned } = parsed.data
  const users = await loadUsers()
  const idx = users.findIndex((u) => u.username === username)
  if (idx < 0) {
    return res.status(404).json({ message: '用户不存在' })
  }
  users[idx].avatarBanned = banned
  await saveUsers(users)
  return res.json({ username, avatarBanned: banned })
})

// 修改密码（需登录，验证旧密码）
const passwordChangeSchema = z.object({
  oldPassword: z.string().min(1, '请输入旧密码'),
  newPassword: z.string().min(6, '新密码至少 6 位').max(64, '密码过长'),
})
authRouter.put('/auth/password', authMiddleware, async (req: Request, res: Response) => {
  const parsed = passwordChangeSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const { oldPassword, newPassword } = parsed.data
  const user = (req as AuthedRequest).user as User
  if (!verifyPassword(oldPassword, user.salt, user.passwordHash)) {
    return res.status(401).json({ message: '旧密码错误' })
  }
  const { salt, passwordHash } = hashPassword(newPassword)
  user.salt = salt
  user.passwordHash = passwordHash
  user.token = generateToken() // 修改密码后 token 轮换，其他设备自动下线
  const users = await loadUsers()
  const idx = users.findIndex((u) => u.username === user.username)
  if (idx >= 0) users[idx] = user
  await saveUsers(users)
  return res.json({ message: '密码修改成功', token: user.token })
})

// 个性签名：仅本人可设置（≤80 字）
const signatureSchema = z.object({ signature: z.string().trim().max(80, '个性签名最多 80 字') })
authRouter.put('/auth/signature', authMiddleware, async (req: Request, res: Response) => {
  const parsed = signatureSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const user = (req as AuthedRequest).user as User
  user.signature = parsed.data.signature || undefined
  const users = await loadUsers()
  const idx = users.findIndex((u) => u.username === user.username)
  if (idx >= 0) users[idx] = user
  await saveUsers(users)
  return res.json({ signature: user.signature ?? null })
})

// 公开用户档案（无需登录）：资料 + 学习统计 + 发帖数
const FORUM_POSTS_FILE = path.join(DATA_DIR, 'forum_posts.json')
authRouter.get('/users/:username', async (req: Request, res: Response) => {
  const name = String(req.params.username)
  const users = await loadUsers()
  const u = users.find((x) => x.username === name)
  if (!u) return res.status(404).json({ message: '用户不存在' })
  let postCount = 0
  try {
    const raw = await fs.readFile(FORUM_POSTS_FILE, 'utf-8')
    const posts = JSON.parse(raw) as Array<{ author: string; hidden?: boolean }>
    postCount = posts.filter((p) => p.author === name && !p.hidden).length
  } catch {
    postCount = 0
  }
  return res.json({
    username: u.username,
    avatar: u.avatarBanned ? null : (u.avatar ?? null),
    avatarBanned: !!u.avatarBanned,
    signature: u.signature ?? null,
    pkWins: u.pkWins ?? 0,
    stats: {
      known: (u.progress.known || []).length,
      starred: (u.progress.starred || []).length,
      posts: postCount,
    },
  })
})

// 获取云端进度
authRouter.get('/progress', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user as User
  return res.json(user.progress)
})

// 保存/导入进度（按分片合并：提供的字段覆盖，未提供的保留）
authRouter.put('/progress', authMiddleware, async (req: Request, res: Response) => {
  const parsed = progressSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const user = (req as AuthedRequest).user as User
  const incoming = parsed.data
  const prevKnownLen = (user.progress.known || []).length
  // 已生成文章：增量合并（按 id 去重），未提供则保留原值
  const prevArticles = user.progress.savedArticles || []
  const mergedArticles = incoming.savedArticles
    ? mergeSavedArticles(prevArticles, incoming.savedArticles)
    : prevArticles
  const next: ProgressData = {
    starred: incoming.starred ?? user.progress.starred,
    known: incoming.known ?? user.progress.known,
    progress: incoming.progress ?? user.progress.progress,
    plans: incoming.plans ?? user.progress.plans,
    savedArticles: mergedArticles,
    // 复习安排：按 wordId 合并，同一词以本次上传为准（覆盖）
    reviews: incoming.reviews
      ? { ...(user.progress.reviews ?? {}), ...incoming.reviews }
      : user.progress.reviews,
    // 个人笔记：以本次上传为准（全量替换）
    notes: incoming.notes ?? user.progress.notes,
  }
  // 净变化量（可正可负）：新掌握为正、取消掌握为负，驱动排行榜「今日 / 本周」净增量
  const knownDelta = (next.known || []).length - prevKnownLen
  user.progress = next
  const users = await loadUsers()
  const idx = users.findIndex((u) => u.username === user.username)
  if (idx >= 0) users[idx] = user
  await saveUsers(users)
  // 记录当日「已掌握」净变化，驱动排行榜「今日 / 本周」（delta=0 时跳过）
  if (knownDelta !== 0) await recordLearningActivity(user.username, knownDelta)
  return res.json(user.progress)
})
