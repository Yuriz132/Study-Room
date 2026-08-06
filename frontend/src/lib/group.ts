import apiClient from './api-client'
import { getErrorMessage } from './api-client'

export type MemberRole = 'owner' | 'admin' | 'member'
export type MemberStatus = 'pending' | 'approved' | 'banned' | 'none'

export interface GroupMemberView {
  username: string
  role: MemberRole
  status: 'pending' | 'approved'
  realName?: string
  joinedAt: number
  banned?: boolean
  banReason?: string
  appeal?: string
  appealAt?: number
  lastReadAt?: number
}

export interface GroupTask {
  id: string
  listNumber: number
  text?: string
  date: string
  publishedAt: number
}

export interface GroupAnnouncement {
  id: string
  text: string
  author: string
  createdAt: number
}

export interface CheckinRule {
  weekdays: number[]
  startMin: number
  endMin: number
  absentThreshold: number
}

export interface GroupSummary {
  id: string
  name: string
  description: string | null
  isPublic: boolean
  owner: string
  memberCount: number
  pendingCount: number
}

export interface MyGroupView extends GroupSummary {
  myRole: MemberRole
  unread: number
  taskListNumberToday: number
}

export interface GroupDetail {
  id: string
  name: string
  description: string | null
  isPublic: boolean
  owner: string
  createdAt: number
  announcement: GroupAnnouncement | null
  checkin: CheckinRule
  myStatus: MemberStatus
  myRole: MemberRole | null
  canManage: boolean
  canChat: boolean
  taskListNumberToday: number
  todayInfo: { date: string; isCheckinDay: boolean; inWindow: boolean; checkedIn: boolean }
  unread: number
  memberCount: number
  tasks: GroupTask[]
  members: GroupMemberView[]
  myAppeal: string | null
}

export interface AttendanceView {
  checkin: CheckinRule
  dates: string[]
  attendance: Record<string, Record<string, 'present' | 'absent'>>
  absenceCount: Record<string, number>
  members: GroupMemberView[]
  appeals: { username: string; appeal?: string; appealAt?: number }[]
  listNumberToday: number
}

// ---------- REST 封装 ----------
export async function apiListGroups(): Promise<{ publicGroups: GroupSummary[]; myGroups: MyGroupView[] }> {
  const { data } = await apiClient.get('/groups')
  return data
}

export async function apiGetGroup(id: string): Promise<GroupDetail> {
  const { data } = await apiClient.get(`/groups/${encodeURIComponent(id)}`)
  return data
}

export async function apiCreateGroup(body: { name: string; description?: string; isPublic?: boolean }): Promise<GroupSummary> {
  const { data } = await apiClient.post('/groups', body)
  return data
}

export async function apiJoinGroup(id: string, note?: string): Promise<{ status: string }> {
  const { data } = await apiClient.post(`/groups/${encodeURIComponent(id)}/join`, { note })
  return data
}

export async function apiLeaveGroup(id: string): Promise<{ status: string }> {
  const { data } = await apiClient.post(`/groups/${encodeURIComponent(id)}/leave`)
  return data
}

export async function apiApproveMember(id: string, username: string): Promise<{ status: string }> {
  const { data } = await apiClient.post(`/groups/${encodeURIComponent(id)}/approve`, { username })
  return data
}

export async function apiRejectMember(id: string, username: string): Promise<{ status: string }> {
  const { data } = await apiClient.post(`/groups/${encodeURIComponent(id)}/reject`, { username })
  return data
}

export async function apiSetAnnouncement(id: string, text: string): Promise<GroupAnnouncement> {
  const { data } = await apiClient.post(`/groups/${encodeURIComponent(id)}/announce`, { text })
  return data
}

export async function apiCheckin(id: string): Promise<{ checkedIn: boolean; date: string }> {
  const { data } = await apiClient.post(`/groups/${encodeURIComponent(id)}/checkin`)
  return data
}

export async function apiGetAttendance(id: string): Promise<AttendanceView> {
  const { data } = await apiClient.get(`/groups/${encodeURIComponent(id)}/attendance`)
  return data
}

export async function apiSetCheckinRule(
  id: string,
  body: { weekdays?: number[]; startMin?: number; endMin?: number; absentThreshold?: number }
): Promise<CheckinRule> {
  const { data } = await apiClient.post(`/groups/${encodeURIComponent(id)}/checkin-rule`, body)
  return data
}

export async function apiPublishTask(id: string, text?: string): Promise<GroupTask> {
  const { data } = await apiClient.post(`/groups/${encodeURIComponent(id)}/task`, { text })
  return data
}

export async function apiAppeal(id: string, text: string): Promise<{ ok: boolean }> {
  const { data } = await apiClient.post(`/groups/${encodeURIComponent(id)}/appeal`, { text })
  return data
}

export async function apiUnban(id: string, username: string): Promise<{ status: string }> {
  const { data } = await apiClient.post(`/groups/${encodeURIComponent(id)}/unban`, { username })
  return data
}

export async function apiRemoveMember(id: string, username: string): Promise<{ status: string }> {
  const { data } = await apiClient.post(`/groups/${encodeURIComponent(id)}/remove`, { username })
  return data
}

export async function apiSetRole(id: string, username: string, role: MemberRole): Promise<{ username: string; role: MemberRole }> {
  const { data } = await apiClient.post(`/groups/${encodeURIComponent(id)}/role`, { username, role })
  return data
}

export { getErrorMessage }
