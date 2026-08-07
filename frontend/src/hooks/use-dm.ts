import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuth } from '@/context/AuthContext'

export interface DmMessage {
  id: string
  conv?: string
  from: string
  to: string
  text: string
  type: 'message' | 'system' | 'invite'
  action?: 'study' | 'pk'
  timestamp: number
  read?: boolean
}

export function useDm(friend: string) {
  const { user } = useAuth()
  const me = user || ''
  const socketRef = useRef<Socket | null>(null)
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [connected, setConnected] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token || !friend) return
    const socketPath = window.location.pathname.startsWith('/sr') ? '/sr/socket.io' : window.location.pathname.startsWith('/vs') ? '/vs/socket.io' : '/socket.io'
    const socket: Socket = io({ path: socketPath, auth: { token }, transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('dm:join', { friend })
    })
    socket.on('disconnect', () => {
      setConnected(false)
      setJoined(false)
    })
    socket.on('dm:history', (msgs: DmMessage[]) => {
      setMessages(msgs)
      setJoined(true)
      setError(null)
    })
    socket.on('dm:message', (msg: DmMessage) => {
      setMessages((prev) => [...prev, msg])
      if (msg.to === me) socket.emit('dm:read', { friend })
    })
    socket.on('dm:error', (d: { message: string }) => {
      setError(d.message)
      setJoined(false)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [friend, me])

  const send = (text: string) => {
    if (!text.trim() || !friend) return
    socketRef.current?.emit('dm:message', { friend, text: text.trim() })
  }

  return { messages, connected, joined, error, send }
}
