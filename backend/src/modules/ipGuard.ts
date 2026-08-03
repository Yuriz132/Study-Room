import type { Request, Response, NextFunction } from 'express'

// ============================================================
// 反滥用：按客户端真实 IP 对「注册 / 登录」做滑动窗口限流 + 临时封禁
// 目标：拦住同一 IP 批量注册 / 压力测试，同时避免永久封 IP 误伤共享出口 IP 的正常用户。
// 设计要点：
// - 仅按 IP 计数，不做永久封禁；异常 IP 临时封禁一段时间后自动解封。
// - 数据存内存，重启后清零（压力测试多为突发，重启清零可接受，且封禁本就限时）。
// - 已在 app.ts 开启 trust proxy，req.ip 取 X-Forwarded-For 首段（真实客户端）。
// ============================================================

const REG_WINDOW_MS = 10 * 60 * 1000 // 注册计数窗口：10 分钟
const REG_MAX = 5 // 10 分钟内同 IP 最多注册 5 次
const JAIL_WINDOW_MS = 60 * 60 * 1000 // 封禁判定窗口：1 小时
const JAIL_THRESHOLD = 10 // 1 小时内同 IP 注册满 10 次 → 触发临时封禁
const JAIL_MS = 60 * 60 * 1000 // 临时封禁时长：1 小时

const LOGIN_WINDOW_MS = 10 * 60 * 1000
const LOGIN_MAX = 30 // 10 分钟内同 IP 最多登录 30 次（较宽松，避免误伤）

type Bucket = { reg: number[]; login: number[]; bannedUntil: number }

const buckets = new Map<string, Bucket>()

function get(ip: string): Bucket {
  let b = buckets.get(ip)
  if (!b) {
    b = { reg: [], login: [], bannedUntil: 0 }
    buckets.set(ip, b)
  }
  return b
}

function prune(arr: number[], windowMs: number, now: number) {
  const cutoff = now - windowMs
  let i = 0
  while (i < arr.length && arr[i] < cutoff) i++
  if (i > 0) arr.splice(0, i)
}

function cleanup() {
  const now = Date.now()
  for (const [ip, b] of buckets) {
    prune(b.reg, JAIL_WINDOW_MS, now)
    prune(b.login, LOGIN_WINDOW_MS, now)
    if (b.bannedUntil && b.bannedUntil <= now) b.bannedUntil = 0
    if (b.reg.length === 0 && b.login.length === 0 && b.bannedUntil === 0) {
      buckets.delete(ip)
    }
  }
}
// 每 5 分钟清理一次；unref 避免阻止进程退出
setInterval(cleanup, 5 * 60 * 1000).unref?.()

function clientIp(req: Request): string {
  // 已开启 trust proxy：req.ip 取 X-Forwarded-For 首段（真实客户端）；兜底用 socket 地址
  const raw = (req.ip || (req.socket.remoteAddress as string) || 'unknown')
    .split(',')[0]
    .trim()
  return raw || 'unknown'
}

/** 注册前置限流 + 临时封禁检查（作为 Express 中间件） */
export function ipGuardRegister(req: Request, res: Response, next: NextFunction): void {
  const ip = clientIp(req)
  const now = Date.now()
  const b = get(ip)

  if (b.bannedUntil > now) {
    const retry = Math.ceil((b.bannedUntil - now) / 1000)
    res.set('Retry-After', String(retry))
    res.status(429).json({
      message: `检测到异常注册行为，已临时限制该 IP，${retry} 秒后自动解除`,
    })
    return
  }

  prune(b.reg, REG_WINDOW_MS, now)
  if (b.reg.length >= REG_MAX) {
    const oldest = b.reg[0]
    const retry = Math.max(1, Math.ceil((oldest + REG_WINDOW_MS - now) / 1000))
    res.set('Retry-After', String(retry))
    res.status(429).json({ message: `注册过于频繁，请 ${retry} 秒后再试` })
    return
  }

  // 标记本次已通过前置检查；成功落库后在路由里调用 recordRegistration
  ;(req as any).__ipGuardIp = ip
  next()
}

/** 注册成功后记录一次（用于计数与触发封禁） */
export function recordRegistration(req: Request): void {
  const ip = (req as any).__ipGuardIp as string | undefined
  if (!ip) return
  const b = get(ip)
  const now = Date.now()
  b.reg.push(now)
  prune(b.reg, JAIL_WINDOW_MS, now)
  if (b.reg.length >= JAIL_THRESHOLD) {
    b.bannedUntil = now + JAIL_MS
  }
}

/** 登录限流（较宽松，避免误伤共享出口 IP） */
export function ipGuardLogin(req: Request, res: Response, next: NextFunction): void {
  const ip = clientIp(req)
  const now = Date.now()
  const b = get(ip)
  prune(b.login, LOGIN_WINDOW_MS, now)
  if (b.login.length >= LOGIN_MAX) {
    const oldest = b.login[0]
    const retry = Math.max(1, Math.ceil((oldest + LOGIN_WINDOW_MS - now) / 1000))
    res.set('Retry-After', String(retry))
    res.status(429).json({ message: `登录尝试过于频繁，请 ${retry} 秒后再试` })
    return
  }
  b.login.push(now)
  next()
}
