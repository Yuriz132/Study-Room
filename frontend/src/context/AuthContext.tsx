import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiLogin, apiRegister, apiGetMe, apiGetProgress, apiSaveProgress, apiSetAvatar, apiRemoveAvatar, apiBanAvatar, type CloudProgress, type SavedArticle, type Note } from '@/lib/authApi'
import { setCloudUploader } from '@/lib/progressSync'
import type { StudyPlan } from '@/lib/studyPlans'
import type { ReviewRecord } from '@/lib/reviews'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

// 与 use-storage 保持一致的三组本地键
const STARRED_KEY = 'liquid-words:starred'
const KNOWN_KEY = 'liquid-words:known'
const PROGRESS_KEY = 'liquid-words:progress'
const REVIEWS_KEY = 'liquid-words:reviews'
const PLANS_KEY = 'liquid-words:plans'
const SAVED_ARTICLES_KEY = 'liquid-words:saved-articles'
const NOTES_KEY = 'liquid-words:notes'

function readPlans(): StudyPlan[] {
  try {
    const raw = localStorage.getItem(PLANS_KEY)
    return raw ? (JSON.parse(raw) as StudyPlan[]) : []
  } catch {
    return []
  }
}
function writePlans(v: StudyPlan[]) {
  localStorage.setItem(PLANS_KEY, JSON.stringify(v))
}
/** 云端进度合并回本地：计划按 id 并集，冲突时云端优先 */
function mergePlansById(local: StudyPlan[], cloud: StudyPlan[]): StudyPlan[] {
  const map = new Map<string, StudyPlan>()
  for (const p of local) map.set(p.id, p)
  for (const p of cloud) map.set(p.id, p)
  return Array.from(map.values())
}

type ProgressMap = Record<string, { reviewed: number; total: number }>

function readArr(key: string): number[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as number[]) : []
  } catch {
    return []
  }
}
function writeArr(key: string, v: number[]) {
  localStorage.setItem(key, JSON.stringify(v))
}
function readProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    return raw ? (JSON.parse(raw) as ProgressMap) : {}
  } catch {
    return {}
  }
}
function writeProgress(v: ProgressMap) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(v))
}
function readSavedArticles(): SavedArticle[] {
  try {
    const raw = localStorage.getItem(SAVED_ARTICLES_KEY)
    return raw ? (JSON.parse(raw) as SavedArticle[]) : []
  } catch {
    return []
  }
}
function writeSavedArticles(v: SavedArticle[]) {
  localStorage.setItem(SAVED_ARTICLES_KEY, JSON.stringify(v))
}
function readReviews(): Record<number, ReviewRecord> {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY)
    return raw ? (JSON.parse(raw) as Record<number, ReviewRecord>) : {}
  } catch {
    return {}
  }
}
function writeReviews(v: Record<number, ReviewRecord>) {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(v))
}
/** 已生成文章：按 id 去重，最新在前 */
function mergeSavedArticles(local: SavedArticle[], cloud: SavedArticle[]): SavedArticle[] {
  const map = new Map<string, SavedArticle>()
  for (const a of local) map.set(a.id, a)
  for (const a of cloud) map.set(a.id, a)
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt)
}

function readNotes(): Note[] {
  try { const raw = localStorage.getItem(NOTES_KEY); return raw ? (JSON.parse(raw) as Note[]) : [] }
  catch { return [] }
}
function writeNotes(v: Note[]) { localStorage.setItem(NOTES_KEY, JSON.stringify(v)) }
/** 个人笔记：按 id 合并，云端更新颖的覆盖本地 */
function mergeNotesById(local: Note[], cloud: Note[]): Note[] {
  const map = new Map<string, Note>()
  for (const n of local) map.set(n.id, n)
  for (const n of cloud) { const cur = map.get(n.id); if (!cur || cur.updatedAt < n.updatedAt) map.set(n.id, n) }
  return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 云端进度合并回本地：集合取并集，进度按列表取最大值（不丢数据） */
function mergeCloudIntoLocal(cloud: CloudProgress) {
  const starred = Array.from(new Set([...readArr(STARRED_KEY), ...(cloud.starred ?? [])]))
  const known = Array.from(new Set([...readArr(KNOWN_KEY), ...(cloud.known ?? [])]))
  const localP = readProgress()
  const cloudP = cloud.progress ?? {}
  const merged: ProgressMap = { ...localP }
  for (const [k, v] of Object.entries(cloudP)) {
    const cur = merged[k] ?? { reviewed: 0, total: v.total }
    merged[k] = { reviewed: Math.max(cur.reviewed, v.reviewed), total: Math.max(cur.total, v.total) }
  }
  writeArr(STARRED_KEY, starred)
  writeArr(KNOWN_KEY, known)
  writeProgress(merged)
  writePlans(mergePlansById(readPlans(), cloud.plans ?? []))
  writeSavedArticles(mergeSavedArticles(readSavedArticles(), cloud.savedArticles ?? []))
  // 复习安排：按 wordId 覆盖合并（同一词以云端为准，避免丢数据）
  writeReviews({ ...readReviews(), ...(cloud.reviews ?? {}) })
  // 个人笔记：按 id 合并，云端更新颖的覆盖
  const localNotes = readNotes()
  const cloudNotes = (cloud.notes ?? []) as Note[]
  if (cloudNotes.length) writeNotes(mergeNotesById(localNotes, cloudNotes))
}

function localSnapshot(): CloudProgress {
  return {
    starred: readArr(STARRED_KEY),
    known: readArr(KNOWN_KEY),
    progress: readProgress(),
    plans: readPlans(),
    savedArticles: readSavedArticles(),
    reviews: readReviews(),
    notes: readNotes(),
  }
}

interface AuthContextValue {
  user: string | null
  isAuthed: boolean
  isAdmin: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string, extra?: { hp?: string; cfTurnstileResponse?: string }) => Promise<void>
  /** 本地游客模式：仅本机，不调用后端、不写 token */
  loginLocal: (name: string) => void
  logout: () => void
  /** 把本地学习进度推送到云端（导入） */
  importLocalToCloud: () => Promise<void>
  avatar: string | null
  avatarBanned: boolean
  setUserAvatar: (dataUri: string) => Promise<void>
  removeUserAvatar: () => Promise<void>
  banUserAvatar: (username: string, banned: boolean) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ADMIN_KEY = 'auth_admin'
const AVATAR_KEY = 'auth_avatar'
const AVATAR_BANNED_KEY = 'auth_avatar_banned'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(() => localStorage.getItem(USER_KEY))
  const [isAdmin, setIsAdmin] = useState<boolean>(() => localStorage.getItem(ADMIN_KEY) === '1')
  const [avatar, setAvatarState] = useState<string | null>(() => localStorage.getItem(AVATAR_KEY) || null)
  const [avatarBanned, setAvatarBannedState] = useState<boolean>(() => localStorage.getItem(AVATAR_BANNED_KEY) === '1')

  // 已登录则注册云端上传器，同时从服务端拉取最新头像状态（封禁即时反映）
  useEffect(() => {
    if (localStorage.getItem(TOKEN_KEY)) {
      setCloudUploader(async (slice) => {
        await apiSaveProgress(slice)
      })
      setUser(localStorage.getItem(USER_KEY))
      apiGetMe().then((me) => {
        const av = me.avatar ?? null
        const banned = !!me.avatarBanned
        localStorage.setItem(AVATAR_KEY, av ?? '')
        localStorage.setItem(AVATAR_BANNED_KEY, banned ? '1' : '0')
        setAvatarState(av)
        setAvatarBannedState(banned)
      }).catch(() => {})
    }
  }, [])

  const login = async (username: string, password: string) => {
    const res = await apiLogin(username, password)
    localStorage.setItem(TOKEN_KEY, res.token)
    localStorage.setItem(USER_KEY, res.username)
    setUser(res.username)
    const admin = res.role === 'admin'
    localStorage.setItem(ADMIN_KEY, admin ? '1' : '0')
    setIsAdmin(admin)
    const av = res.avatar ?? null
    const banned = !!res.avatarBanned
    localStorage.setItem(AVATAR_KEY, av ?? '')
    localStorage.setItem(AVATAR_BANNED_KEY, banned ? '1' : '0')
    setAvatarState(av)
    setAvatarBannedState(banned)
    setCloudUploader(async (slice) => {
      await apiSaveProgress(slice)
    })
    // 把云端进度合并回本地，再刷新让各页面重新读取
    try {
      const cloud = await apiGetProgress()
      mergeCloudIntoLocal(cloud)
    } catch {
      /* 云端不可用时直接用本地 */
    }
    // 跳转回应用首页：兼容 /vs 子路径部署与 IP 根路径部署
    window.location.href = window.location.pathname.startsWith('/vs') ? '/vs/' : '/'
  }

  const register = async (username: string, password: string, extra?: { hp?: string; cfTurnstileResponse?: string }) => {
    const res = await apiRegister(username, password, extra)
    localStorage.setItem(TOKEN_KEY, res.token)
    localStorage.setItem(USER_KEY, res.username)
    setUser(res.username)
    const admin = res.role === 'admin'
    localStorage.setItem(ADMIN_KEY, admin ? '1' : '0')
    setIsAdmin(admin)
    const av = res.avatar ?? null
    const banned = !!res.avatarBanned
    localStorage.setItem(AVATAR_KEY, av ?? '')
    localStorage.setItem(AVATAR_BANNED_KEY, banned ? '1' : '0')
    setAvatarState(av)
    setAvatarBannedState(banned)
    setCloudUploader(async (slice) => {
      await apiSaveProgress(slice)
    })
    try {
      const cloud = await apiGetProgress()
      mergeCloudIntoLocal(cloud)
    } catch {
      /* ignore */
    }
    // 跳转回应用首页：兼容 /vs 子路径部署与 IP 根路径部署
    window.location.href = window.location.pathname.startsWith('/vs') ? '/vs/' : '/'
  }

  /** 本地游客模式：不依赖后端，直接以本机用户名进入 */
  const loginLocal = (name: string) => {
    const clean = (name || '').trim() || '本地游客'
    localStorage.removeItem(TOKEN_KEY)
    localStorage.setItem(USER_KEY, clean)
    localStorage.setItem(ADMIN_KEY, '0')
    setCloudUploader(null)
    setIsAdmin(false)
    setUser(clean)
    // 跳转回应用首页：兼容 /vs 子路径部署与 IP 根路径部署
    window.location.href = window.location.pathname.startsWith('/vs') ? '/vs/' : '/'
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(ADMIN_KEY)
    localStorage.removeItem(AVATAR_KEY)
    localStorage.removeItem(AVATAR_BANNED_KEY)
    setCloudUploader(null)
    setUser(null)
    setIsAdmin(false)
    setAvatarState(null)
    setAvatarBannedState(false)
  }

  const setUserAvatar = async (dataUri: string) => {
    await apiSetAvatar(dataUri)
    localStorage.setItem(AVATAR_KEY, dataUri)
    setAvatarState(dataUri)
  }

  const removeUserAvatar = async () => {
    await apiRemoveAvatar()
    localStorage.setItem(AVATAR_KEY, '')
    setAvatarState(null)
  }

  const banUserAvatar = async (username: string, banned: boolean) => {
    await apiBanAvatar(username, banned)
  }

  const importLocalToCloud = async () => {
    await apiSaveProgress(localSnapshot())
  }

  return (
    <AuthContext.Provider value={{ user, isAuthed: !!user, isAdmin, login, register, loginLocal, logout, importLocalToCloud, avatar, avatarBanned, setUserAvatar, removeUserAvatar, banUserAvatar }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}
