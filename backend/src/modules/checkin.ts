import { Router, type Request, type Response } from 'express'
import { authMiddleware, adminMiddleware, loadUsers, saveUsers, type User } from './auth'

/**
 * 签到领会员 —— 服务器端记账模块
 *
 * - 签到/连续天数以服务器为准（写入 users.json 的 checkinDates），不再信任浏览器本地数据；
 * - 首次连续签满 3 天时记录服务器时间戳 checkinFirstAt，作为「谁先达标」的权威排序依据；
 * - 管理员可拉取达标名单（按 checkinFirstAt 升序，最早达标者在前）。
 *
 * 规则与页面一致：每日 06:30 - 07:00（Asia/Shanghai）可签到一次，连续 3 天达标。
 */

export const checkinRouter: Router = Router()
checkinRouter.use(authMiddleware)

const GOAL = 3
const MIGRATE_WINDOW_DAYS = 30

type AuthedReq = Request & { user?: User }

// ---------- 上海时区日期工具 ----------
function todayStr(): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const get = (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function fmt(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** 当前是否在每日签到窗口 06:30 - 07:00（上海时区） */
function inWindowNow(): boolean {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date())
  const get = (t: Intl.DateTimeFormatPartTypes) => Number(p.find((x) => x.type === t)?.value || 0)
  const mins = (get('hour') % 24) * 60 + get('minute')
  return mins >= 6 * 60 + 30 && mins <= 7 * 60
}

/** 从日期数组计算「截至今天」的连续签到天数（今天没签则视为 0） */
function consecutive(dates: string[], today: string): number {
  const set = new Set(dates)
  if (!set.has(today)) return 0
  let count = 0
  const d = new Date(today + 'T00:00:00Z')
  while (set.has(fmt(d))) {
    count++
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return count
}

/** 校验并规范化一组日期（仅接受过去 30 天内、格式合法的 YYYY-MM-DD） */
function sanitizeDates(raw: unknown, today: string): string[] {
  if (!Array.isArray(raw)) return []
  const cutoff = new Date(today + 'T00:00:00Z')
  cutoff.setUTCDate(cutoff.getUTCDate() - MIGRATE_WINDOW_DAYS)
  const out = new Set<string>()
  for (const s of raw) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) continue
    if (s > today) continue
    if (s < fmt(cutoff)) continue
    const d = new Date(s + 'T00:00:00Z')
    if (isNaN(d.getTime())) continue
    out.add(s)
  }
  return Array.from(out).sort()
}

function statusOf(u: User, now: string) {
  const dates = u.checkinDates || []
  const consec = consecutive(dates, now)
  return {
    today: now,
    inWindow: inWindowNow(),
    alreadyToday: dates.includes(now),
    dates,
    consecutive: consec,
    reached: consec >= GOAL,
    firstAt: u.checkinFirstAt ?? null,
  }
}

// GET /api/account/checkin —— 查询本人签到状态
checkinRouter.get('/', async (req: Request, res: Response) => {
  const me = (req as AuthedReq).user!.username
  const users = await loadUsers()
  const u = users.find((x) => x.username === me)
  if (!u) return res.status(404).json({ message: '账号不存在' })
  return res.json(statusOf(u, todayStr()))
})

// POST /api/account/checkin —— 今日签到（服务端记账，首次达标记录时间戳）
checkinRouter.post('/', async (req: Request, res: Response) => {
  const me = (req as AuthedReq).user!.username
  const users = await loadUsers()
  const u = users.find((x) => x.username === me)
  if (!u) return res.status(404).json({ message: '账号不存在' })

  const today = todayStr()
  const dates = Array.isArray(u.checkinDates) ? [...u.checkinDates] : []
  if (dates.includes(today)) {
    return res.status(400).json({ message: '今日已签到' })
  }
  if (!inWindowNow()) {
    return res.status(400).json({ message: '签到时段为每日 06:30 - 07:00' })
  }

  dates.push(today)
  u.checkinDates = dates
  const consec = consecutive(dates, today)
  if (consec >= GOAL && typeof u.checkinFirstAt !== 'number') {
    u.checkinFirstAt = Date.now()
  }
  await saveUsers(users)
  return res.json(statusOf(u, today))
})

// POST /api/account/checkin/migrate —— 一次性迁移浏览器本地签到记录
// 仅当服务器还没有该用户任何签到记录时允许；日期须在过去 30 天内。
checkinRouter.post('/migrate', async (req: Request, res: Response) => {
  const me = (req as AuthedReq).user!.username
  const users = await loadUsers()
  const u = users.find((x) => x.username === me)
  if (!u) return res.status(404).json({ message: '账号不存在' })

  if (Array.isArray(u.checkinDates) && u.checkinDates.length > 0) {
    return res.status(400).json({ message: '已在服务器签到，无需迁移' })
  }

  const body = (req.body || {}) as { dates?: unknown }
  const today = todayStr()
  u.checkinDates = sanitizeDates(body.dates, today)
  const consec = consecutive(u.checkinDates, today)
  if (consec >= GOAL) u.checkinFirstAt = Date.now()
  await saveUsers(users)
  return res.json(statusOf(u, today))
})

// GET /api/account/checkin/admin-list —— 达标名单（按达成时间升序，最早者第一）
checkinRouter.get('/admin-list', adminMiddleware, async (_req: Request, res: Response) => {
  const now = todayStr()
  const users = await loadUsers()
  const list = users
    .filter((u) => typeof u.checkinFirstAt === 'number' && (u.checkinDates?.length || 0) > 0)
    .map((u) => ({
      username: u.username,
      avatar: u.avatar ?? null,
      signature: u.signature ?? null,
      dates: u.checkinDates || [],
      consecutive: consecutive(u.checkinDates || [], now),
      firstAt: u.checkinFirstAt as number,
    }))
    .sort((a, b) => a.firstAt - b.firstAt)
  return res.json({ list })
})
