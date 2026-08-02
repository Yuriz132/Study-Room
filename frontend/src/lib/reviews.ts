// SRS 间隔复习：类型定义 + SM-2 lite 算法（纯函数，无外部依赖，前后端共用结构）
//
// 评级（不背单词式三级）：
//   good  (认识) — 完全掌握，间隔按遗忘曲线拉长，并标记「已掌握」
//   vague (模糊) — 有点印象但吃不准，压短到 1 天后复习，难度系数略降
//   forget(忘记) — 完全不认识，立即（当天）重学，连续答对计数清零

export type ReviewGrade = 'good' | 'vague' | 'forget'

export interface ReviewRecord {
  /** 连续答对次数（用于决定间隔档位） */
  reps: number
  /** 难度系数（easiness factor），下限 1.3 */
  ease: number
  /** 当前间隔天数 */
  interval: number
  /** 下次复习到期时间戳(ms) */
  due: number
  /** 上次复习时间戳(ms) */
  last: number
  /** 最近一次评级 */
  grade?: ReviewGrade
}

const DAY = 86_400_000

// SM-2 的质量分映射：good=5 / vague=3 / forget=1
const QUALITY: Record<ReviewGrade, number> = { good: 5, vague: 3, forget: 1 }

/**
 * 根据上一次记录与本次评级，计算下一次复习安排（SM-2 lite）。
 * @param prev 上一次复习记录（首次为 undefined）
 * @param grade 本次评级
 * @param now 当前时间戳(ms)
 */
export function computeReview(
  prev: ReviewRecord | undefined,
  grade: ReviewGrade,
  now: number = Date.now()
): ReviewRecord {
  const q = QUALITY[grade]
  let reps = prev?.reps ?? 0
  let ease = prev?.ease ?? 2.5
  let interval = prev?.interval ?? 0

  if (q >= 3) {
    // 通过：连续答对 +1，间隔按遗忘曲线平缓拉长（贴近不背单词式节奏）
    reps += 1
    if (reps === 1) interval = 1
    else if (reps === 2) interval = 2
    else if (reps === 3) interval = 4
    else if (reps === 4) interval = 7
    else if (reps === 5) interval = 15
    else interval = Math.round(interval * 1.8) // 之后每轮约 ×1.8
    // 模糊：即使通过，也把间隔压到最多 1 天，尽快再见面
    if (grade === 'vague') interval = Math.min(interval, 1)
  } else {
    // 忘记：清零连续答对，立即（当天）重学
    reps = 0
    interval = 0
  }

  // 难度系数更新（SM-2 公式），并夹紧到 [1.3, ∞)
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))

  return {
    reps,
    ease: Math.round(ease * 100) / 100,
    interval,
    due: now + interval * DAY,
    last: now,
    grade,
  }
}

/** 是否到期需要复习：无记录（新词）或已到 due 时间都算到期 */
export function isReviewDue(record: ReviewRecord | undefined, now: number = Date.now()): boolean {
  return !record || record.due <= now
}

/**
 * 不背单词式复习队列排序：错词/逾期优先。
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
