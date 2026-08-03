import { Server, Socket } from 'socket.io'
import { getUserByToken } from './auth'
import { loadGraph } from './friends'
import { appendDm, markRead, convKey, loadDm, type DmMessage } from './dmStore'

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
