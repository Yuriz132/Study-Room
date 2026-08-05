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
  sysKind?: 'welcome' | 'leave'
}

const MAX_HISTORY = 100
const messages: ChatMessage[] = []
const onlineUsers = new Map<string, { username: string; avatar: string | null; isAdmin: boolean }>()  // socket.id → user info

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
      const isAdmin = joinUser.role === 'admin'

      // 已在房间内则跳过
      if (onlineUsers.has(socket.id)) return

      onlineUsers.set(socket.id, { username, avatar, isAdmin })

      // 发送历史消息
      socket.emit('chat:history', messages.slice(-50))

      // 加入时不再广播「X 加入了聊天室」——已有单独的欢迎须知
      broadcastOnlineCount(io)

      // 向加入者单独推送欢迎须知（多行 system 消息，前端 whitespace-pre-line 渲染）
      const welcomeText =
`欢迎 ${username} 进入聊天室 🎉
—————————————————
聊天室是公共空间，请注意：
· 文明发言，尊重他人隐私
· 保护好个人信息与财产安全
· 请勿随意添加陌生人微信
祝大家学习愉快！`
      const welcomeMsg: ChatMessage = {
        id: genId(),
        type: 'system',
        username,
        avatar,
        text: welcomeText,
        timestamp: Date.now(),
        sysKind: 'welcome',
      }
      socket.emit('chat:message', welcomeMsg)
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

    // 管理员删除单条聊天记录（按 id 删除，广播让所有客户端同步移除）
    socket.on('chat:delete', (data: { id?: string }) => {
      const u = onlineUsers.get(socket.id)
      if (!u || !u.isAdmin) {
        socket.emit('chat:error', { message: '只有管理员可以删除聊天记录' })
        return
      }
      const id = data?.id
      if (!id) return
      const idx = messages.findIndex((m) => m.id === id)
      if (idx === -1) return
      messages.splice(idx, 1)
      io.emit('chat:deleted', { id })
    })

    // 管理员清空全部聊天记录
    socket.on('chat:clear', () => {
      const u = onlineUsers.get(socket.id)
      if (!u || !u.isAdmin) {
        socket.emit('chat:error', { message: '只有管理员可以清空聊天记录' })
        return
      }
      messages.length = 0
      const sysMsg: ChatMessage = {
        id: genId(),
        type: 'system',
        username: u.username,
        avatar: u.avatar,
        text: '管理员已清空聊天记录，请大家文明发言 🧹',
        timestamp: Date.now(),
      }
      addMessage(sysMsg)
      io.emit('chat:cleared')
      io.emit('chat:message', sysMsg)
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
          sysKind: 'leave',
        }
        addMessage(leaveMsg)
        io.emit('chat:message', leaveMsg)
        broadcastOnlineCount(io)
      }
    })
  })
}
