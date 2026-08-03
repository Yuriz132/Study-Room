import apiClient from './api-client';
import type { StudyPlan } from '@/lib/studyPlans';
import type { ReviewRecord } from '@/lib/reviews';

/** 生成的 AI 文章（存入「我的收藏」） */
export interface SavedArticle {
  id: string
  title: string
  content: string
  usedWords: string[]
  target: number
  theme: string
  createdAt: number
}

export interface CloudProgress {
  starred?: number[]
  known?: number[]
  progress?: Record<string, { reviewed: number; total: number }>
  plans?: StudyPlan[]
  savedArticles?: SavedArticle[]
  reviews?: Record<number, ReviewRecord>
  notes?: Note[]
}

/** 个人笔记 */
export interface Note {
  id: string
  title: string
  content: string
  images?: string[]
  /** AI 从笔记图片解析出的单词清单（纯文本，每行一条） */
  analysis?: string
  createdAt: number
  updatedAt: number
}

export interface AuthResult {
  username: string
  token: string
  role?: string
  avatar?: string | null
  avatarBanned?: boolean
  signature?: string | null
}

export interface MeResult {
  username: string
  role?: string
  avatar?: string | null
  avatarBanned?: boolean
  signature?: string | null
}

export async function apiLogin(username: string, password: string): Promise<AuthResult> {
  const { data } = await apiClient.post<AuthResult>('/auth/login', { username, password })
  return data
}

export async function apiRegister(username: string, password: string, extra?: { hp?: string; geetest?: { lot_number: string; captcha_output: string; pass_token: string; gen_time: string } }): Promise<AuthResult> {
  const { data } = await apiClient.post<AuthResult>('/auth/register', { username, password, ...(extra ?? {}) })
  return data
}

export async function apiGetMe(): Promise<MeResult> {
  const { data } = await apiClient.get<MeResult>('/auth/me')
  return data
}

export async function apiChangePassword(oldPassword: string, newPassword: string): Promise<{ message: string; token: string }> {
  const { data } = await apiClient.put<{ message: string; token: string }>('/auth/password', { oldPassword, newPassword })
  return data
}

/** 设置当前用户头像（data URI） */
export async function apiSetAvatar(avatar: string): Promise<{ avatar: string | null; avatarBanned: boolean }> {
  const { data } = await apiClient.put<{ avatar: string | null; avatarBanned: boolean }>('/auth/avatar', { avatar })
  return data
}

/** 清除当前用户头像（回退到默认字母头像） */
export async function apiRemoveAvatar(): Promise<{ avatar: string | null; avatarBanned: boolean }> {
  const { data } = await apiClient.delete<{ avatar: string | null; avatarBanned: boolean }>('/auth/avatar')
  return data
}

/** 管理员封禁 / 解封某用户头像 */
export async function apiBanAvatar(username: string, banned: boolean): Promise<{ username: string; avatarBanned: boolean }> {
  const { data } = await apiClient.post<{ username: string; avatarBanned: boolean }>('/auth/admin/avatar-ban', { username, banned })
  return data
}

export async function apiGetProgress(): Promise<CloudProgress> {
  const { data } = await apiClient.get<CloudProgress>('/progress')
  return data
}

export async function apiSaveProgress(slice: CloudProgress): Promise<CloudProgress> {
  const { data } = await apiClient.put<CloudProgress>('/progress', slice)
  return data
}

// ---------- 好友系统 / 个性签名 / 公开档案 ----------
export interface PublicUser {
  username: string
  avatar: string | null
  avatarBanned: boolean
  signature: string | null
  pkWins: number
  stats: { known: number; starred: number; posts: number }
}

export interface FriendRelations {
  friends: string[]
  incoming: string[]
  outgoing: string[]
}

export type FriendStatus = 'none' | 'outgoing' | 'incoming' | 'friend' | 'self'

export async function apiGetUser(username: string): Promise<PublicUser> {
  const { data } = await apiClient.get<PublicUser>('/users/' + encodeURIComponent(username))
  return data
}

export async function apiUpdateSignature(signature: string): Promise<{ signature: string | null }> {
  const { data } = await apiClient.put<{ signature: string | null }>('/auth/signature', { signature })
  return data
}

export async function apiGetFriends(): Promise<FriendRelations> {
  const { data } = await apiClient.get<FriendRelations>('/friends')
  return data
}

export async function apiFriendRequest(username: string): Promise<{ status: string }> {
  const { data } = await apiClient.post<{ status: string }>('/friends/request', { friendUsername: username })
  return data
}

export async function apiFriendAccept(username: string): Promise<{ status: string }> {
  const { data } = await apiClient.post<{ status: string }>('/friends/accept', { friendUsername: username })
  return data
}

export async function apiFriendReject(username: string): Promise<{ status: string }> {
  const { data } = await apiClient.post<{ status: string }>('/friends/reject', { friendUsername: username })
  return data
}

export async function apiFriendRemove(username: string): Promise<{ status: string }> {
  const { data } = await apiClient.delete<{ status: string }>('/friends/' + encodeURIComponent(username))
  return data
}

export async function apiFriendStatus(username: string): Promise<{ status: FriendStatus }> {
  const { data } = await apiClient.get<{ status: FriendStatus }>('/friends/status/' + encodeURIComponent(username))
  return data
}

// 好友相关红点指标（待处理申请 + 未读私信）
export interface FriendIndicators {
  requests: number
  unread: number
  unreadByFriend: Record<string, number>
  has: boolean
}

export async function apiFriendIndicators(): Promise<FriendIndicators> {
  const { data } = await apiClient.get<FriendIndicators>('/friends/indicators')
  return data
}
