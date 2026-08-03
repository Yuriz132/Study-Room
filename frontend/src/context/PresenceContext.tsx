import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getPresenceSocket } from '@/lib/presenceSocket'

interface PresenceCtx {
  /** 当前在线用户名数组 */
  onlineList: string[]
  /** 当前在线人数 */
  onlineCount: number
  /** 判断某用户是否在线 */
  isOnline: (name: string) => boolean
}

const EMPTY: PresenceCtx = { onlineList: [], onlineCount: 0, isOnline: () => false }

const Ctx = createContext<PresenceCtx>(EMPTY)

export function usePresence(): PresenceCtx {
  return useContext(Ctx)
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const [onlineList, setOnlineList] = useState<string[]>([])
  const [onlineCount, setOnlineCount] = useState(0)

  useEffect(() => {
    const sock = getPresenceSocket(token)
    const onList = (list: string[]) => setOnlineList(Array.isArray(list) ? list : [])
    const onCount = (c: number) => setOnlineCount(typeof c === 'number' ? c : 0)
    sock.on('presence:list', onList)
    sock.on('presence:count', onCount)
    return () => {
      sock.off('presence:list', onList)
      sock.off('presence:count', onCount)
    }
  }, [token])

  const isOnline = (name: string) => onlineList.includes(name)

  return (
    <Ctx.Provider value={{ onlineList, onlineCount, isOnline }}>
      {children}
    </Ctx.Provider>
  )
}
