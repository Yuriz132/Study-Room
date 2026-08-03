import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

/**
 * 实时聊天室 Hook
 * 从 localStorage 读取 auth_token，连接到 Socket.IO 并加入聊天室。
 */

export interface ChatMessage {
  id: string
  type: 'message' | 'system'
  username: string
  avatar: string | null
  text: string
  timestamp: number
  sysKind?: 'welcome' | 'leave'
}

const TOKEN_KEY = 'auth_token'

export function useChat() {
  const socketRef = useRef<Socket | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)

  // 欢迎 / 离开类系统消息 60s 后自动消失
  const expireRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const scheduleExpire = useCallback((msg: ChatMessage) => {
    if (msg.sysKind !== 'welcome' && msg.sysKind !== 'leave') return
    const remaining = Math.max(0, 60000 - (Date.now() - msg.timestamp))
    const t = setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id))
      expireRef.current.delete(msg.id)
    }, remaining)
    expireRef.current.set(msg.id, t)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return

    const socketPath = window.location.pathname.startsWith('/vs') ? '/vs/socket.io' : '/socket.io'
    const socket: Socket = io({
      path: socketPath,
      auth: { token },
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('chat:join')
    })

    socket.on('disconnect', () => {
      setConnected(false)
      setJoined(false)
    })

    socket.on('chat:history', (msgs: ChatMessage[]) => {
      setMessages(msgs)
      msgs.forEach(scheduleExpire)
      setJoined(true)
      setError(null)
    })

    socket.on('chat:message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg])
      scheduleExpire(msg)
    })

    socket.on('chat:online', (count: number) => {
      setOnlineCount(count)
    })

    socket.on('chat:error', (d: { message: string }) => {
      setError(d.message)
      setJoined(false)
    })

    return () => {
      expireRef.current.forEach((t) => clearTimeout(t))
      expireRef.current.clear()
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const send = useCallback((text: string) => {
    if (!text.trim()) return
    socketRef.current?.emit('chat:message', { text: text.trim() })
  }, [])

  return { messages, connected, joined, error, onlineCount, send }
}
