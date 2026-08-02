import { Router, type Request, type Response } from 'express'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * 排行榜 API（公开）
 * 返回所有用户的"今日/本周/全部掌握"学习数据
 */
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const DAILY_FILE = path.join(DATA_DIR, 'daily.json')

interface UserSummary {
  username: string
  knownCount: number
  todayReviewed: number
  weekReviewed: number
  totalReviewed: number
  pkWins: number
  lastActive: number
}

interface DailyFile {
  [username: string]: { [dateStr: string]: { reviewed: number; timestamp: number } }
}

async function loadUsers(): Promise<any[]> {
  try {
    const raw = await fs.readFile(USERS_FILE, 'utf-8')
    return JSON.parse(raw) as any[]
  } catch { return [] }
}
let dailyCache: DailyFile | null = null
async function loadDaily(): Promise<DailyFile> {
  if (dailyCache) return dailyCache
  try {
    const raw = await fs.readFile(DAILY_FILE, 'utf-8')
    dailyCache = JSON.parse(raw) as DailyFile
  } catch {
    dailyCache = {}
  }
  return dailyCache
}
async function saveDaily(d: DailyFile): Promise<void> {
  dailyCache = d
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(DAILY_FILE, JSON.stringify(d, null, 2), 'utf-8')
}

/**
 * 记录某用户当日「已掌握」净变化量（可正可负），供排行榜「今日/本周」统计。
 * 在 PUT /progress 合并 known 后调用；delta 为本次 known 数组长度的净变化
 * （新掌握为正、取消掌握为负），累加后按 0 兜底，确保「今日/本周」反映净增量。
 * 日期口径与 GET /leaderboard 的 todayStr() 保持一致（UTC，避免读写错位）。
 */
export async function recordLearningActivity(username: string, delta: number): Promise<void> {
  if (!username || delta === 0) return
  const daily = await loadDaily()
  const t = todayStr()
  if (!daily[username]) daily[username] = {}
  const cur = daily[username][t] || { reviewed: 0, timestamp: 0 }
  daily[username][t] = { reviewed: Math.max(0, cur.reviewed + delta), timestamp: Date.now() }
  await saveDaily(daily)
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}
function weekAgoStr(): string {
  const d = new Date(); d.setDate(d.getDate() - 6)
  return d.toISOString().slice(0, 10)
}

export const leaderboardRouter: Router = Router()

leaderboardRouter.get('/leaderboard', async (_req: Request, res: Response) => {
  const users = await loadUsers()
  const daily = await loadDaily()
  const t = todayStr()
  const w = weekAgoStr()

  const list: UserSummary[] = users.map((u: any) => {
    const known: number[] = u.progress?.known || []
    const totalReviewed: number = u.progress?.progress
      ? Object.values<{ reviewed: number }>(u.progress.progress).reduce((s, p) => s + p.reviewed, 0)
      : 0
    const userDaily = daily[u.username] || {}
    const todayReviewed = userDaily[t]?.reviewed || 0
    let weekReviewed = 0
    for (const [date, val] of Object.entries(userDaily)) {
      if (date >= w && date <= t) weekReviewed += val.reviewed
    }
    const lastActive = userDaily[t]?.timestamp || 0
    return {
      username: u.username,
      knownCount: known.length,
      todayReviewed,
      weekReviewed,
      totalReviewed,
      pkWins: u.pkWins || 0,
      lastActive,
    }
  })

  const sortDesc = (key: keyof UserSummary) =>
    list.sort((a, b) => (b[key] as number) - (a[key] as number) || (b.lastActive - a.lastActive))

  res.json({
    totalWords: 3459,
    today: sortDesc('todayReviewed').slice(0, 20),
    week: sortDesc('weekReviewed').slice(0, 20),
    allTime: sortDesc('knownCount').slice(0, 20),
    pk: sortDesc('pkWins').slice(0, 20),
  })
})
