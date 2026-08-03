import { Server, Socket } from 'socket.io'
import { Router, type Request, type Response } from 'express'
import { getUserByToken, authMiddleware } from './auth'
import { loadGraph } from './friends'
import { appendDm, markRead, convKey, loadDm, type DmMessage } from './dmStore'

// 供 REST 邀请接口广播使用的 io 引用（在 registerDm 中赋值）
let dmIo: Server | null = null

// ============================================
// 私信（1v1）实时模块
// - dm:join   加入与某好友的私信房间，拉取历史并标记已读
// - dm:message 发送私信（仅好友之间），广播到房间
// - dm:read    标记与某好友的私信为已读
// - dm:leave   离开房间
// ============================================

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

async function areFriends(a: string, b: string): Promise<boolean> {
  const g = await loadGraph()
  return !!g[a]?.friends.includes(b)
}

export function registerDm(io: Server): void {
  dmIo = io
  io.on('connection', async (socket: Socket) => {
    const token = (socket.handshake.auth && (socket.handshake.auth as Record<string, unknown>).token) as string | undefined
    const me = token ? (await getUserByToken(token))?.username : null
    if (!me) return

    socket.on('dm:join', async (data?: { friend?: string }) => {
      const friend = data?.friend
      if (!friend) {
        socket.emit('dm:error', { message: '缺少 friend 参数' })
        return
      }
      if (!(await areFriends(me, friend))) {
        socket.emit('dm:error', { message: '你们还不是好友，无法私信' })
        return
      }
      const conv = convKey(me, friend)
      socket.join('dm:' + conv)
      await markRead(me, friend)
      const store = await loadDm()
      socket.emit('dm:history', store[conv] || [])
    })

    socket.on('dm:message', async (data?: { friend?: string; text?: string }) => {
      const friend = data?.friend
      const text = (data?.text || '').trim()
      if (!friend || !text || text.length > 500) return
      if (!(await areFriends(me, friend))) {
        socket.emit('dm:error', { message: '你们还不是好友，无法私信' })
        return
      }
      const conv = convKey(me, friend)
      const msg: DmMessage = {
        id: genId(),
        conv,
        from: me,
        to: friend,
        text,
        type: 'message',
        timestamp: Date.now(),
        read: false,
      }
      await appendDm(msg)
      io.to('dm:' + conv).emit('dm:message', msg)
    })

    socket.on('dm:read', async (data?: { friend?: string }) => {
      const friend = data?.friend
      if (!friend) return
      await markRead(me, friend)
    })

    socket.on('dm:leave', async (data?: { friend?: string }) => {
      const friend = data?.friend
      if (friend) socket.leave('dm:' + convKey(me, friend))
    })
  })
}

// ============================================
// 私信邀请（REST）：好友一起学 / 好友单词PK 的邀请通过私信送达
// 前端在好友列表/用户页点击「一起学/邀TA PK」时调用，对方在私信里点击即可加入。
// 这样不依赖对方当前是否打开了某个 socket，邀请以私信形式持久化并实时广播到会话房间。
// ============================================
export const dmRouter: Router = Router()
dmRouter.use(authMiddleware)

dmRouter.post('/invite', async (req: Request, res: Response) => {
  const me = (req as Request & { user?: { username: string } }).user?.username
  if (!me) return res.status(401).json({ message: '未登录' })
  const to = String((req.body as { to?: unknown }).to || '').trim()
  const action: 'study' | 'pk' = (req.body as { action?: unknown }).action === 'pk' ? 'pk' : 'study'
  if (!to || to === me) return res.status(400).json({ message: '参数错误' })
  if (!(await areFriends(me, to))) return res.status(403).json({ message: '你们还不是好友，无法邀请' })

  const conv = convKey(me, to)
  const text = action === 'pk' ? `${me} 邀请你一起单词PK` : `${me} 邀请你一起学习`
  const msg: DmMessage = {
    id: genId(),
    conv,
    from: me,
    to,
    text,
    type: 'invite',
    action,
    timestamp: Date.now(),
    read: false,
  }
  await appendDm(msg)
  if (dmIo) dmIo.to('dm:' + conv).emit('dm:message', msg)
  return res.json({ ok: true })
})
