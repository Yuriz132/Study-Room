import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

export interface StudyMsg {
  id: string
  from: string
  text: string
  timestamp: number
}

interface PeerProgress {
  type?: string
  payload?: any
}

export function useStudy(token: string | null, friend: string) {
  const socketRef = useRef<Socket | null>(null)
  const [joined, setJoined] = useState(false)
  const [peer, setPeer] = useState('')
  const [peerOnline, setPeerOnline] = useState(false)
  const [messages, setMessages] = useState<StudyMsg[]>([])
  const [peerProgress, setPeerProgress] = useState<PeerProgress | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!token) return
    const socketPath = window.location.pathname.startsWith('/sr') ? '/sr/socket.io' : window.location.pathname.startsWith('/vs') ? '/vs/socket.io' : '/socket.io'
    const sock = io({ path: socketPath, auth: { token }, transports: ['websocket', 'polling'] })
    socketRef.current = sock
    sock.on('study:error', (d: { message?: string }) => setErr(d.message || '出错了'))
    sock.on('study:joined', (d: { peer: string }) => { setJoined(true); setPeer(d.peer) })
    sock.on('study:peerJoined', () => setPeerOnline(true))
    sock.on('study:peerLeft', () => setPeerOnline(false))
    sock.on('study:message', (m: StudyMsg) => setMessages((prev) => [...prev, m]))
    sock.on('study:progress', (pr: PeerProgress) => setPeerProgress({ type: pr.type, payload: pr.payload }))
    sock.emit('study:join', { friendUsername: friend })
    return () => {
      try { sock.emit('study:leave') } catch { /* noop */ }
      sock.disconnect()
      socketRef.current = null
    }
  }, [token, friend])

  const send = useCallback((text: string) => {
    const t = (text || '').trim()
    if (!t) return
    socketRef.current?.emit('study:message', { text: t })
  }, [])

  const sendProgress = useCallback((type: string, payload: any) => {
    socketRef.current?.emit('study:progress', { type, payload })
  }, [])

  return { joined, peer, peerOnline, messages, peerProgress, err, send, sendProgress }
}
