import { Server, Socket } from 'socket.io'
import { getUserByToken } from './auth'

/**
 * 实时聊天室模块
 * - 消息广播到所有在线用户（全局聊天室）
 * - 内存保留最近 100 条历史消息
 * - 用户加入/离开时发送系统消息并广播在线人数
 */

interface ChatMessage {
  id: string
  type: 'message' | 'system'
  username: string
  avatar: string | null
  text: string
  timestamp: number
}

const MAX_HISTORY = 100
const messages: ChatMessage[] = []
const onlineUsers = new Map<string, { username: string; avatar: string | null }>()  // socket.id → user info

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function broadcastOnlineCount(io: Server): void {
  io.emit('chat:online', onlineUsers.size)
}

function addMessage(msg: ChatMessage): void {
  messages.push(msg)
  if (messages.length > MAX_HISTORY) messages.shift()
}

export function registerChat(io: Server): void {
  io.on('connection', async (socket: Socket) => {
    // 等待鉴权
    const token = (socket.handshake.auth && (socket.handshake.auth as Record<string, unknown>).token) as string | undefined
    const user = token ? await getUserByToken(token) : null

    socket.on('chat:join', async (data?: { token?: string }) => {
      // 支持首次连接后通过事件加入（也支持握手时的 token）
      const joinToken = data?.token || token
      const joinUser = joinToken ? await getUserByToken(joinToken) : user
      if (!joinUser) {
        socket.emit('chat:error', { message: '请先登录后再加入聊天室' })
        return
      }

      const username = joinUser.username
      const avatar = joinUser.avatar || null

      // 已在房间内则跳过
      if (onlineUsers.has(socket.id)) return

      onlineUsers.set(socket.id, { username, avatar })

      // 发送历史消息
      socket.emit('chat:history', messages.slice(-50))

      // 系统消息：加入
      const joinMsg: ChatMessage = {
        id: genId(),
        type: 'system',
        username,
        avatar,
        text: `${username} 加入了聊天室`,
        timestamp: Date.now(),
      }
      addMessage(joinMsg)
      io.emit('chat:message', joinMsg)
      broadcastOnlineCount(io)
    })

    socket.on('chat:message', (data: { text: string }) => {
      const u = onlineUsers.get(socket.id)
      if (!u) {
        socket.emit('chat:error', { message: '请先加入聊天室' })
        return
      }
      const text = (data.text || '').trim()
      if (!text || text.length > 500) return

      const msg: ChatMessage = {
        id: genId(),
        type: 'message',
        username: u.username,
        avatar: u.avatar,
        text,
        timestamp: Date.now(),
      }
      addMessage(msg)
      io.emit('chat:message', msg)
    })

    socket.on('disconnect', () => {
      const u = onlineUsers.get(socket.id)
      if (u) {
        onlineUsers.delete(socket.id)
        const leaveMsg: ChatMessage = {
          id: genId(),
          type: 'system',
          username: u.username,
          avatar: u.avatar,
          text: `${u.username} 离开了聊天室`,
          timestamp: Date.now(),
        }
        addMessage(leaveMsg)
        io.emit('chat:message', leaveMsg)
        broadcastOnlineCount(io)
      }
    })
  })
}
