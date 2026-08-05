import { apiClient } from '@/lib/api-client'

/**
 * 签到领会员 —— 服务器端记账 API
 * 数据以服务器为准（users.json 持久化），浏览器本地记录仅用于一次性迁移。
 */

export interface CheckinStatus {
  today: string
  inWindow: boolean
  alreadyToday: boolean
  dates: string[]
  consecutive: number
  reached: boolean
  firstAt: number | null
}

export interface CheckinLeaderEntry {
  username: string
  avatar?: string | null
  signature?: string | null
  dates: string[]
  consecutive: number
  firstAt: number
}

export async function fetchCheckinStatus(): Promise<CheckinStatus> {
  const { data } = await apiClient.get<CheckinStatus>('/account/checkin')
  return data
}

export async function doCheckin(): Promise<CheckinStatus> {
  const { data } = await apiClient.post<CheckinStatus>('/account/checkin')
  return data
}

/** 一次性迁移浏览器本地签到记录到服务器（仅服务器无记录时生效） */
export async function migrateCheckin(dates: string[]): Promise<CheckinStatus> {
  const { data } = await apiClient.post<CheckinStatus>('/account/checkin/migrate', { dates })
  return data
}

/** 管理员：达标名单（最早达标者在前） */
export async function fetchCheckinLeaderboard(): Promise<CheckinLeaderEntry[]> {
  const { data } = await apiClient.get<{ list: CheckinLeaderEntry[] }>('/account/checkin/admin-list')
  return data.list
}
