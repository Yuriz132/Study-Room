import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { GroupAnnouncement, GroupTask } from '@/lib/group'

export interface GroupMessage {
  id: string
  type: 'message' | 'system'
  username: string
  avatar: string | null
  text: string
  timestamp: number
  sysKind?: string
}

const TOKEN_KEY = 'auth_token'

export function useGroupChat(groupId: string | undefined) {
  const socketRef = useRef<Socket | null>(null)
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [connected, setConnected] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState<GroupAnnouncement | null>(null)
  const [latestTask, setLatestTask] = useState<GroupTask | null>(null)
  const [checkinEvents, setCheckinEvents] = useState<{ username: string; date: string }[]>([])
  const [disbanded, setDisbanded] = useState(false)

  useEffect(() => {
    if (!groupId) return
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
      socket.emit('group:join', { groupId })
    })

    socket.on('disconnect', () => {
      setConnected(false)
      setJoined(false)
    })

    socket.on('group:history', (msgs: GroupMessage[]) => {
      setMessages(msgs)
      setJoined(true)
      setError(null)
    })

    socket.on('group:meta', (meta: { announcement?: GroupAnnouncement | null }) => {
      if (meta?.announcement) setAnnouncement(meta.announcement)
    })

    socket.on('group:message', (msg: GroupMessage) => {
      setMessages((prev) => [...prev, msg])
    })

    socket.on('group:announcement', (ann: GroupAnnouncement) => {
      setAnnouncement(ann)
    })

    socket.on('group:task', (task: GroupTask) => {
      setLatestTask(task)
    })

    socket.on('group:event', (e: { type: string; username: string; date: string }) => {
      if (e?.type === 'checkin') {
        setCheckinEvents((prev) => [...prev.slice(-20), { username: e.username, date: e.date }])
      }
    })

    socket.on('group:error', (d: { message: string }) => {
      setError(d?.message || '连接失败')
    })

    socket.on('group:deleted', (d: { id: string }) => {
      const id = d?.id
      if (!id) return
      setMessages((prev) => prev.filter((m) => m.id !== id))
    })

    socket.on('group:disbanded', () => {
      setDisbanded(true)
    })

    return () => {
      socket.emit('group:leave', { groupId })
      socket.disconnect()
      socketRef.current = null
    }
  }, [groupId])

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || !groupId) return
      socketRef.current?.emit('group:message', { groupId, text: text.trim() })
    },
    [groupId]
  )

  const deleteMessage = useCallback(
    (id: string) => {
      if (!groupId) return
      socketRef.current?.emit('group:delete', { groupId, id })
    },
    [groupId]
  )

  return { messages, connected, joined, error, announcement, latestTask, checkinEvents, disbanded, send, deleteMessage }
}
