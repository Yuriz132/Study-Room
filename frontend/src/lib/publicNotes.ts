import { apiClient } from './api-client'

export interface PublicNote {
  _id: string
  title: string
  content: string
  author: string
  createdAt: number
  updatedAt: number
  hidden?: boolean
  flagReason?: string
  /** 附图：本站上传产生的相对路径（如 uploads/ab12....jpg），渲染时拼 API_BASE */
  images?: string[]
}

/** 读取公开笔记列表（按更新时间倒序，最近 50 条） */
export async function fetchPublicNotes(): Promise<PublicNote[]> {
  const { data } = await apiClient.get<PublicNote[]>('/public-notes')
  // 防御：后端异常/502 可能返回非数组（如 HTML 错误页），避免 notes.map 崩溃
  return Array.isArray(data) ? data : []
}

/** 读取单条笔记 */
export async function fetchPublicNote(id: string): Promise<PublicNote> {
  const { data } = await apiClient.get<PublicNote>(`/public-notes/${id}`)
  return data
}

/** 发表一条公共笔记（需登录） */
export async function addPublicNote(title: string, content: string, images?: string[]): Promise<PublicNote> {
  const body: { title: string; content: string; images?: string[] } = { title, content }
  if (images && images.length) body.images = images
  const { data } = await apiClient.post<PublicNote>('/public-notes', body)
  return data
}

/** 编辑笔记（作者或管理员） */
export async function updatePublicNote(
  id: string,
  updates: { title?: string; content?: string; images?: string[] }
): Promise<PublicNote> {
  const { data } = await apiClient.put<PublicNote>(`/public-notes/${id}`, updates)
  return data
}

/** 删除笔记（作者或管理员） */
export async function deletePublicNote(id: string): Promise<void> {
  await apiClient.delete(`/public-notes/${id}`)
}

/** 取消隐藏笔记（仅管理员） */
export async function unhidePublicNote(id: string): Promise<PublicNote> {
  const { data } = await apiClient.patch<PublicNote>(`/public-notes/${id}/unhide`)
  return data
}
