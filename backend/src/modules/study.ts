import { Server, Socket } from 'socket.io'
import { getUserByToken } from './auth'

/**
 * 双人学习房（好友一起学）
 * - 进入房间后双方可见彼此的实时进度（前端通过 Socket 广播，后端不存储学习数据）
 * - 房内切小聊天，消息实时互达
 * 房间名取两位用户名排序拼接，保证唯一且双方指向同一房间。
 */

interface StudyMessage {
  id: string
  from: string
  text: string
  timestamp: number
}

function roomKey(a: string, b: string): string {
  return [a, b].sort().join('__')
}

export function registerStudy(io: Server): void {
  io.on('connection', async (socket: Socket) => {
    const token = (socket.handshake.auth && (socket.handshake.auth as Record<string, unknown>).token) as string | undefined
    const user = token ? await getUserByToken(token) : null
    if (!user) {
      socket.emit('study:error', { message: '请先登录后再进入学习房' })
      return
    }
    const username = user.username

    socket.on('study:join', (data: { friendUsername?: string }) => {
      const friend = data?.friendUsername
      if (!friend || friend === username) {
        socket.emit('study:error', { message: '请选择一位好友一起学习' })
        return
      }
      const room = roomKey(username, friend)
      socket.join(room)
      socket.data.studyRoom = room
      socket.data.studyPeer = friend
      socket.to(room).emit('study:peerJoined', { username })
      socket.emit('study:joined', { room, peer: friend })
    })

    socket.on('study:message', (data: { text?: string }) => {
      const room = socket.data.studyRoom as string | undefined
      if (!room) return
      const text = (data.text || '').trim()
      if (!text || text.length > 500) return
      const msg: StudyMessage = {
        id: Math.random().toString(36).slice(2, 10),
        from: username,
        text,
        timestamp: Date.now(),
      }
      io.to(room).emit('study:message', msg)
    })

    socket.on('study:progress', (data: { type?: string; payload?: unknown }) => {
      const room = socket.data.studyRoom as string | undefined
      if (!room) return
      socket.to(room).emit('study:progress', { from: username, type: data.type, payload: data.payload })
    })

    socket.on('study:leave', () => {
      const room = socket.data.studyRoom as string | undefined
      if (room) {
        socket.to(room).emit('study:peerLeft', { username })
        socket.leave(room)
        socket.data.studyRoom = undefined
      }
    })

    socket.on('disconnect', () => {
      const room = socket.data.studyRoom as string | undefined
      if (room) {
        socket.to(room).emit('study:peerLeft', { username })
      }
    })
  })
}
