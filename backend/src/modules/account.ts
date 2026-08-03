import { Router, type Request, type Response } from 'express'
import { authMiddleware, adminMiddleware, loadUsers, saveUsers, verifyPassword } from './auth'
import { loadGraph, saveGraph } from './friends'
import { removeUserMessages } from './dmStore'

type AuthedReq = Request & { user?: { username: string } }

export const accountRouter: Router = Router()

// 所有账号操作均需登录
accountRouter.use(authMiddleware)

/** 删除用户并清理其好友关系与私信数据 */
async function deleteUser(username: string): Promise<boolean> {
  const users = await loadUsers()
  const idx = users.findIndex((u) => u.username === username)
  if (idx < 0) return false
  users.splice(idx, 1)
  await saveUsers(users)

  // 清理好友关系图
  const g = await loadGraph()
  delete g[username]
  for (const k of Object.keys(g)) {
    const n = g[k]
    if (!n) continue
    n.friends = n.friends.filter((x) => x !== username)
    n.incoming = n.incoming.filter((x) => x !== username)
    n.outgoing = n.outgoing.filter((x) => x !== username)
  }
  await saveGraph(g)

  // 清理私信会话
  await removeUserMessages(username)
  return true
}

// 注销当前账号（需输入密码确认）
accountRouter.delete('/', async (req: Request, res: Response) => {
  const me = (req as AuthedReq).user!.username
  const body = (req.body || {}) as { password?: string }
  if (!body.password) {
    return res.status(400).json({ message: '请输入密码' })
  }
  const users = await loadUsers()
  const u = users.find((x) => x.username === me)
  if (!u) return res.status(404).json({ message: '账号不存在' })
  if (!verifyPassword(body.password, u.salt, u.passwordHash)) {
    return res.status(401).json({ message: '密码错误' })
  }
  await deleteUser(me)
  return res.json({ ok: true })
})

// 管理员注销任意用户（无需密码）
accountRouter.delete('/admin/:username', adminMiddleware, async (req: Request, res: Response) => {
  const raw = req.params.username
  const target = decodeURIComponent(Array.isArray(raw) ? raw[0] : raw)
  const ok = await deleteUser(target)
  if (!ok) return res.status(404).json({ message: '用户不存在' })
  return res.json({ ok: true })
})
