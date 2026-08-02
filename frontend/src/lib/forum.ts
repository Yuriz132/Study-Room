import { API_BASE } from './api-client'

/** 将论坛帖子 hex _id 映射为评论系统的 wordId */
export function postIdToWordId(postId: string): number {
  let h = 0
  for (let i = 0; i < postId.length; i++) {
    h = ((h << 5) - h + postId.charCodeAt(i)) | 0
  }
  return -(Math.abs(h) + 1_000_000)
}

export type ForumCategory = 'all' | 'entertainment' | 'study' | 'qa' | 'daily'

export interface ForumPost {
  _id: string
  category: Exclude<ForumCategory, 'all'>
  title: string
  content: string
  author: string
  images?: string[]
  createdAt: number
  updatedAt: number
  views: number
  likes: number
  commentCount: number
  hidden?: boolean
  /** 作者头像（被封禁则为 null），由后端富化 */
  authorAvatar?: string | null
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('auth_token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchForumPosts(category: string = 'all'): Promise<ForumPost[]> {
  const r = await fetch(`${API_BASE}/forum/posts?category=${category}`)
  if (!r.ok) throw new Error('加载帖子失败')
  return r.json()
}

export async function fetchForumPost(id: string): Promise<ForumPost> {
  const r = await fetch(`${API_BASE}/forum/posts/${id}`)
  if (!r.ok) throw new Error('帖子不存在')
  return r.json()
}

export async function createForumPost(data: {
  category: string
  title: string
  content: string
  images?: string[]
}): Promise<ForumPost> {
  const r = await fetch(`${API_BASE}/forum/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(data),
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({ message: '发表失败' }))
    throw new Error(e.message || '发表失败')
  }
  return r.json()
}

export async function deleteForumPost(id: string): Promise<void> {
  const r = await fetch(`${API_BASE}/forum/posts/${id}`, {
    method: 'DELETE',
    headers: { ...authHeader() },
  })
  if (!r.ok) throw new Error('删除失败')
}

export async function toggleLikePost(id: string): Promise<{ liked: boolean; likes: number }> {
  const r = await fetch(`${API_BASE}/forum/posts/${id}/like`, {
    method: 'POST',
    headers: { ...authHeader() },
  })
  if (!r.ok) throw new Error('操作失败')
  return r.json()
}

export async function getLikeStatus(id: string): Promise<{ liked: boolean }> {
  try {
    const r = await fetch(`${API_BASE}/forum/posts/${id}/liked`, { headers: { ...authHeader() } })
    if (!r.ok) return { liked: false }
    return r.json()
  } catch { return { liked: false } }
}