// 云端进度上传器：把"上传到云端"的实现与具体的存储 hook 解耦。
// 已登录时由 AuthProvider 注册真正的上传函数；未登录时为 null，pushToCloud 静默跳过（仅本地）。

import type { StudyPlan } from '@/lib/studyPlans';
import type { SavedArticle, Note } from '@/lib/authApi';
import type { ReviewRecord } from '@/lib/reviews';

export type ProgressSlice =
  | { starred: number[] }
  | { known: number[] }
  | { progress: Record<string, { reviewed: number; total: number }> }
  | { plans: StudyPlan[] }
  | { savedArticles: SavedArticle[] }
  | { reviews: Record<number, ReviewRecord> }
  | { notes: Note[] }

type Uploader = (slice: ProgressSlice) => Promise<void>

let uploader: Uploader | null = null

/** AuthProvider 在登录态注册/注销上传器 */
export function setCloudUploader(fn: Uploader | null): void {
  uploader = fn
}

/** 各存储 hook 在本地写入后调用：已登录则推送对应分片到云端 */
export async function pushToCloud(slice: ProgressSlice): Promise<void> {
  if (!uploader) return
  try {
    await uploader(slice)
  } catch {
    /* 云端暂时不可用：忽略，不影响本地使用 */
  }
}
