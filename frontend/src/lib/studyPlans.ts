// 学习计划数据类型（前端/后端共用结构，后端以 zod 独立定义同构校验）

export type PlanType = 'units' | 'words' | 'custom'

export interface PlanTask {
  id: string
  text: string
  done: boolean
}

export interface StudyPlan {
  id: string
  type: PlanType
  title: string
  /** 目标值：units=选中的list数，words=单词数，custom=子任务数 */
  target: number
  /** type=units 时：选中的 listKey 列表（格式 "PartName::ListName"） */
  selectedLists?: string[]
  /** 仅 type=custom 使用 */
  tasks?: PlanTask[]
  createdAt: number
}

export const PLAN_TYPE_LABEL: Record<PlanType, string> = {
  units: '完成章节',
  words: '单词目标',
  custom: '自定义任务',
}
