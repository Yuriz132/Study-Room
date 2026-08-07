// SRS 间隔复习：基于开源 FSRS 算法（fsrs.js，Free Spaced Repetition Scheduler，
// Open Spaced Repetition 社区出品，Anki 采用）——纯函数、零外部运行时依赖。
//
// 评级（三级自评）：
//   good  (认识) — 对应 FSRS Rating.Good，按记忆稳定性/难度自适应拉长间隔
//   vague (模糊) — 对应 FSRS Rating.Hard，稍短间隔尽快再见
//   forget(忘记) — 对应 FSRS Rating.Again，当天重学并进入 relearning
//
// 存储：保留 due(下次到期时间戳)/last/grade 便于排序与兼容既有调用方，
// 同时持久化 FSRS 卡片状态（stability/difficulty/elapsed_days/scheduled_days/
// reps/lapses/state）以便跨会话继续调度。旧的 SM-2 lite 记录（无 stability）
// 自动迁移为新卡重新学习。

import { FSRS, Rating, Card } from 'fsrs.js'

export type ReviewGrade = 'good' | 'vague' | 'forget'

export interface ReviewRecord {
  /** 下次复习到期时间戳(ms) */
  due: number
  /** 上次复习时间戳(ms) */
  last: number
  /** 最近一次评级 */
  grade?: ReviewGrade
  /** —— FSRS 卡片状态 —— */
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  state: number // 0=New 1=Learning 2=Review 3=Relearning
  /** 兼容旧 SM-2 lite 记录（仅用于迁移判定，不参与计算） */
  interval?: number
  ease?: number
}

const f = new FSRS()

/** 三态评级 → FSRS 评级 */
const RATING: Record<ReviewGrade, Rating> = {
  forget: Rating.Again,
  vague: Rating.Hard,
  good: Rating.Good,
}

/** 把 FSRS Card 转成可持久化的 ReviewRecord */
function cardToRecord(card: Card, grade: ReviewGrade, now: number): ReviewRecord {
  return {
    due: new Date(card.due).getTime(),
    last: now,
    grade,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
  }
}

/**
 * 根据上一次记录与本次评级，用 FSRS 计算下一次复习安排。
 * @param prev 上一次复习记录（首次或旧版 SM-2 记录为 undefined/无 FSRS 字段）
 * @param grade 本次评级
 * @param now 当前时间戳(ms)
 */
export function computeReview(
  prev: ReviewRecord | undefined,
  grade: ReviewGrade,
  now: number = Date.now()
): ReviewRecord {
  const nowDate = new Date(now)
  const card = new Card()
  if (prev && typeof prev.stability === 'number' && typeof prev.state === 'number') {
    // 已有 FSRS 状态 → 还原卡片继续调度
    card.due = prev.due ? new Date(prev.due) : nowDate
    card.stability = prev.stability
    card.difficulty = prev.difficulty
    card.elapsed_days = prev.elapsed_days ?? 0
    card.scheduled_days = prev.scheduled_days ?? 0
    card.reps = prev.reps
    card.lapses = prev.lapses ?? 0
    card.state = prev.state
    card.last_review = prev.last ? new Date(prev.last) : nowDate
  }
  // 旧 SM-2 记录：以新卡开始（FSRS 会自动从首次学习进入学习/复习曲线）
  const info = f.repeat(card, nowDate)[RATING[grade]]
  return cardToRecord(info.card, grade, now)
}

/** 是否到期需要复习：无记录（新词）或已到 due 时间都算到期 */
export function isReviewDue(record: ReviewRecord | undefined, now: number = Date.now()): boolean {
  return !record || record.due <= now
}

/**
 * 复习队列排序：错词/逾期优先。
 * - 已安排复习且到期的词，按到期时间升序（最久没复习的排最前）
 * - 无记录的新词排在最后
 * 返回排序后的单词 id 列表（仅包含传入的 id）。
 */
export function getDueOrderedIds(
  ids: number[],
  reviews: Record<number, ReviewRecord>,
  now: number = Date.now()
): number[] {
  const due = ids.filter((id) => isReviewDue(reviews[id], now))
  const reviewed = due.filter((id) => reviews[id]) // 有历史记录（真正逾期/待复习）
  const fresh = due.filter((id) => !reviews[id]) // 新词
  reviewed.sort((a, b) => (reviews[a]?.due ?? 0) - (reviews[b]?.due ?? 0))
  return [...reviewed, ...fresh]
}
