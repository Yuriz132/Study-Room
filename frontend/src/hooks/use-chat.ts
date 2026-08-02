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
}

const TOKEN_KEY = 'auth_token'

export function useChat() {
  const socketRef = useRef<Socket | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)

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
      setJoined(true)
      setError(null)
    })

    socket.on('chat:message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg])
    })

    socket.on('chat:online', (count: number) => {
      setOnlineCount(count)
    })

    socket.on('chat:error', (d: { message: string }) => {
      setError(d.message)
      setJoined(false)
    })

    return () => {
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
