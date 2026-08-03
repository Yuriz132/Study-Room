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
}

export interface MeResult {
  username: string
  role?: string
  avatar?: string | null
  avatarBanned?: boolean
}

export async function apiLogin(username: string, password: string): Promise<AuthResult> {
  const { data } = await apiClient.post<AuthResult>('/auth/login', { username, password })
  return data
}

export async function apiRegister(username: string, password: string, extra?: { hp?: string; cfTurnstileResponse?: string }): Promise<AuthResult> {
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
