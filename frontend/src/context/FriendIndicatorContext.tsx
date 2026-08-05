import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { apiFriendIndicators, type FriendIndicators } from '@/lib/authApi'
import { fetchForumPosts, type ForumPost } from '@/lib/forum'
import { useAuth } from './AuthContext'

/**
 * 底部导航未读指标
 * - 好友：待处理申请数 + 未读私信数（每 4s 轮询服务端）
 * - 社区：未读帖子数（拉取帖子 + 本机已读记录 hv:readPosts 计算；收到 hv:forum-read 事件立即重算）
 */
const EMPTY: FriendIndicators = { requests: 0, unread: 0, unreadByFriend: {}, has: false }

interface IndicatorCtx extends FriendIndicators {
  communityUnread: number
  refresh: () => void
}

const Ctx = createContext<IndicatorCtx>({ ...EMPTY, communityUnread: 0, refresh: () => {} })

export function useFriendIndicators() {
  return useContext(Ctx)
}

function readForumReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem('hv:readPosts')
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set<string>()
  }
}

export function FriendIndicatorProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<FriendIndicators>(EMPTY)
  const [communityUnread, setCommunityUnread] = useState(0)
  const postsRef = useRef<ForumPost[]>([])

  const computeCommunity = useCallback((posts: ForumPost[]): number => {
    const me = user
    if (!me) return 0
    const readIds = readForumReadIds()
    return posts.filter((p) => p.author !== me && !readIds.has(p._id)).length
  }, [user])

  const refresh = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    if (!token) {
      setState(EMPTY)
      setCommunityUnread(0)
      return
    }
    try {
      const [f, posts] = await Promise.all([apiFriendIndicators(), fetchForumPosts('all')])
      postsRef.current = posts
      setState(f)
      setCommunityUnread(computeCommunity(posts))
    } catch {
      // 帖子拉取失败不阻塞好友指标
      try {
        const f = await apiFriendIndicators()
        setState(f)
      } catch { /* ignore */ }
    }
  }, [computeCommunity])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 4000)
    return () => clearInterval(id)
  }, [refresh])

  // 用户在社区页读了帖子后，立即用缓存帖子重算未读数（无需重新拉取）
  useEffect(() => {
    const onRead = () => setCommunityUnread(computeCommunity(postsRef.current))
    window.addEventListener('hv:forum-read', onRead)
    return () => window.removeEventListener('hv:forum-read', onRead)
  }, [computeCommunity])

  return <Ctx.Provider value={{ ...state, communityUnread, refresh }}>{children}</Ctx.Provider>
}
