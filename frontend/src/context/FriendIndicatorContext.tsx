import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { apiFriendIndicators, type FriendIndicators } from '@/lib/authApi'

const EMPTY: FriendIndicators = { requests: 0, unread: 0, unreadByFriend: {}, has: false }

interface IndicatorCtx extends FriendIndicators {
  refresh: () => void
}

const Ctx = createContext<IndicatorCtx>({ ...EMPTY, refresh: () => {} })

export function useFriendIndicators() {
  return useContext(Ctx)
}

export function FriendIndicatorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FriendIndicators>(EMPTY)

  const refresh = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    if (!token) {
      setState(EMPTY)
      return
    }
    try {
      const d = await apiFriendIndicators()
      setState(d)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 4000)
    return () => clearInterval(id)
  }, [refresh])

  return <Ctx.Provider value={{ ...state, refresh }}>{children}</Ctx.Provider>
}
