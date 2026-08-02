// 学习算法引擎（纯函数，可单测，与 UI 解耦）
//
// 设计目标（贴合产品需求）：
//  1. 每个单词「首次出现」只出 4 选 1 选择题（不出认识/不认识/模糊）。
//  2. 选择题答对 => 记一次「已过关(choice pass)」，继续做下一个词。
//  3. 一组 20 词全部过完选择题后，回头把本组词「再考一遍」，题型切换为
//     认识 / 模糊 / 忘记 三态，共做三遍（P2/P3/P4）。
//  4. 三态里只有连续三次都选「认识」才算「熟悉」；任意一次选模糊/忘记则
//     该词回到回头轮重来，直到认识或用户主动退出。
//  5. 进入下一组前，先把上一组里「易错/选错/未熟悉」的词抽出来用三态先考
//     一遍，全部认识后才正式进入下一组新词。
//
// 概念：
//  - Group：每 GROUP_SIZE 个词为一组（默认 20）。
//  - Stage：每个词的学习阶段
//      'choice'   首次选择题
//      'review'   回头三态复习（含 P2/P3/P4 三遍）
//      'mastered' 已熟悉（选择题对 + 三态三遍都认识）
//  - Pass：选择题通过标记；ReviewRounds：三态已做轮数；LastGrade：最近一次三态评级。

export const GROUP_SIZE = 20
/** 三态需要连续「认识」的遍数 */
export const REQUIRED_REVIEW_ROUNDS = 3

export type Stage = 'choice' | 'review' | 'mastered'
export type ReviewGrade = 'good' | 'vague' | 'forget'

export interface WordStudyState {
  /** 单词 id */
  id: number
  /** 当前阶段 */
  stage: Stage
  /** 选择题是否已通过（首次接触答对） */
  choicePassed: boolean
  /** 选择题是否曾经答错（用于组间错题复习判定） */
  choiceWrong: boolean
  /** 三态已完成的轮数（good 才计数） */
  reviewRounds: number
  /** 最近一次三态评级（用于判断是否需要组间重考） */
  lastGrade?: ReviewGrade
  /** 三态里是否曾经选过 vague/forget（易错标记，用于组间复习 + 排序优先） */
  everWeak: boolean
}

export interface QuizOption {
  word: string
  meaning: string
  id: number
  correct: boolean
}

/** 把一批词切成 GROUP_SIZE 大小的组 */
export function chunkIntoGroups<T>(items: T[], size = GROUP_SIZE): T[][] {
  const groups: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size))
  }
  return groups
}

/** 生成选择题选项：正确答案 + 3 个干扰项（来自同池其它词的中文释义） */
export function buildQuizOptions(
  correct: { id: number; word: string; meaning: string },
  pool: { id: number; word: string; meaning: string }[],
  count = 4
): QuizOption[] {
  const distractors = pool
    .filter((w) => w.id !== correct.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, count - 1)
  const options: QuizOption[] = [
    { word: correct.word, meaning: correct.meaning, id: correct.id, correct: true },
    ...distractors.map((d) => ({ word: d.word, meaning: d.meaning, id: d.id, correct: false })),
  ]
  // 洗牌，正确项不固定位置
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[options[i], options[j]] = [options[j], options[i]]
  }
  return options
}

/** 初始化一个词的学习状态 */
export function initWordState(id: number): WordStudyState {
  return { id, stage: 'choice', choicePassed: false, choiceWrong: false, reviewRounds: 0, everWeak: false }
}

/** 处理选择题结果，返回新状态 */
export function applyChoice(state: WordStudyState, correct: boolean): WordStudyState {
  if (correct) {
    return { ...state, choicePassed: true, stage: 'review' }
  }
  // 答错：记错，但仍进入回头轮（用三态再考），不直接标熟悉
  return { ...state, choiceWrong: true, choicePassed: true, stage: 'review' }
}

/**
 * 处理一次三态评级，返回新状态。
 * - good：reviewRounds +1；达到 REQUIRED_REVIEW_ROUNDS 则标 mastered
 * - vague/forget：reviewRounds 清零，标记 everWeak（需重来）
 */
export function applyReview(state: WordStudyState, grade: ReviewGrade): WordStudyState {
  if (grade === 'good') {
    const rounds = state.reviewRounds + 1
    return {
      ...state,
      reviewRounds: rounds,
      lastGrade: 'good',
      stage: rounds >= REQUIRED_REVIEW_ROUNDS ? 'mastered' : 'review',
    }
  }
  // vague / forget：未通过，回到回头轮重来
  return {
    ...state,
    reviewRounds: 0,
    lastGrade: grade,
    everWeak: true,
    stage: 'review',
  }
}

/** 该词是否已熟悉 */
export function isMastered(state: WordStudyState): boolean {
  return state.stage === 'mastered'
}

/**
 * 该词是否需要进入「组间错题复习」（进入下一组前先考）：
 *  - 选择题曾经答错，或
 *  - 三态里曾经选过 vague/forget（易错），或
 *  - 尚未熟悉
 * 换句话说：只要不是「已熟悉」就需要组间复习；已熟悉则无需再考。
 */
export function needsInterGroupReview(state: WordStudyState): boolean {
  return !isMastered(state)
}

/**
 * 计算一组内的「下一词」顺序（用于回看阶段）：
 * 易错（everWeak 或 choiceWrong）/ 未熟悉 的词优先排在前面。
 */
export function sortReviewOrder(states: WordStudyState[]): WordStudyState[] {
  return [...states].sort((a, b) => {
    const weakA = a.everWeak || a.choiceWrong || !isMastered(a) ? 0 : 1
    const weakB = b.everWeak || b.choiceWrong || !isMastered(b) ? 0 : 1
    return weakA - weakB
  })
}

export interface GroupProgress {
  total: number
  choiceDone: number
  mastered: number
  inReview: number
}

/** 统计一组的整体进度 */
export function groupProgress(states: WordStudyState[]): GroupProgress {
  return {
    total: states.length,
    choiceDone: states.filter((s) => s.choicePassed).length,
    mastered: states.filter(isMastered).length,
    inReview: states.filter((s) => s.stage === 'review').length,
  }
}
