import { Router, type Request, type Response } from 'express'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { authMiddleware, loadUsers, saveUsers, type User, type WrongCollection, type WrongItem } from './auth'
import { fetchAI, AI_API_KEY, VISION_MODEL, REASONING_EFFORT } from './ai'

// ============================================
// 错题合集模块（错题拍照/文本收集 + 每个合集隔离的 AI 分析）
// 数据持久化在 users.json 的 user.wrongCollections，随账号云端保存、跨设备同步。
// ============================================

const CHAT_MODEL = process.env.AI_CHAT_MODEL || 'agnes-2.5-flash'
const MAX_COLLECTIONS = 50
const MAX_MESSAGES = 50

// ---------- 校验 schema ----------
const createSchema = z.object({
  name: z.string().trim().min(1, '请输入合集名称').max(30, '名称最多 30 字'),
})

const addItemSchema = z.object({
  text: z.string().trim().max(5000).optional(),
  image: z.string().min(50, '图片数据为空').optional(), // base64 data URL
})

const chatMsgSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().min(1).max(20000) }))
    .min(1)
    .max(40),
})

// ---------- 取当前登录用户在 users 数组中的记录 ----------
async function getUserRecord(req: Request): Promise<{ users: User[]; user: User } | null> {
  const authUser = (req as any).user as User | undefined
  if (!authUser) return null
  const users = await loadUsers()
  const user = users.find((u) => u.username === authUser.username)
  return user ? { users, user } : null
}

// ---------- 图片识别：把错题图片提取为题目原文（保留中英文/公式） ----------
async function extractWrongQuestion(image: string): Promise<string> {
  const sys = `你是一位「错题整理助手」。用户上传一张错题/题目图片（可能是试卷、练习册、手写题、英文或中文题目）。
请：
1. 尽量逐条提取图片中的题目原文，保留英文单词、中文、公式与符号，不要改写；
2. 若一张图含多道题，用「第1题」「第2题」分段；
3. 文字无法辨认处标注（无法辨认）；
4. 纯文本输出，不要使用 markdown 代码块或标题符号（#）。
仅输出提取到的题目文本。`
  const r = await fetchAI('/chat/completions', {
    model: VISION_MODEL,
    messages: [
      { role: 'system', content: sys },
      {
        role: 'user',
        content: [
          { type: 'text', text: '请提取这张错题图片中的题目内容。' },
          { type: 'image_url', image_url: { url: image } },
        ],
      },
    ],
    max_tokens: 3000,
    temperature: 0.3,
    reasoning_effort: REASONING_EFFORT,
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    const err: any = new Error(`AI 视觉服务错误：${r.status}`)
    err.statusCode = 502
    err.detail = txt.slice(0, 300)
    throw err
  }
  const data: any = await r.json()
  return (data?.choices?.[0]?.message?.content || '').trim()
}

// ---------- 隔离的 AI 系统提示词（只携带当前合集的错题） ----------
function buildSystemPrompt(name: string, items: WrongItem[]): string {
  const list = items.length
    ? items.map((it, i) => `${i + 1}. ${it.text}`).join('\n')
    : '（该合集暂无错题，请引导用户先添加错题，再据此给出通用复习建议）'
  return `你是一位专注「错题分析」的 AI 学习教练。下面只提供【当前错题合集】的内容，请严格基于这些错题作答，不要编造合集之外的题目。

【当前错题合集：${name}】
${list}

你的职责：
1. 分析用户的知识薄弱点与易错类型；
2. 针对错题提炼关键知识点（词汇/语法/句型），给出记忆要点；
3. 根据薄弱点生成针对性的新练习题（附答案与解析）；
4. 给出可落地的复习建议与学习计划。
回答用简体中文，条理清晰；必要时用「1. 2. 3.」分点，不要使用 markdown 标题符号（#）。`
}

export const wrongbookRouter: Router = Router()

// 所有接口均需登录
wrongbookRouter.use(authMiddleware)

// 列出当前用户的所有错题合集
wrongbookRouter.get('/', async (req: Request, res: Response) => {
  const rec = await getUserRecord(req)
  if (!rec) return res.status(401).json({ message: '登录已过期，请重新登录' })
  return res.json({ collections: rec.user.wrongCollections || [] })
})

// 新建错题合集
wrongbookRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const rec = await getUserRecord(req)
  if (!rec) return res.status(401).json({ message: '登录已过期，请重新登录' })
  const { users, user } = rec
  if (!user.wrongCollections) user.wrongCollections = []
  if (user.wrongCollections.length >= MAX_COLLECTIONS) {
    return res.status(400).json({ message: `错题合集数量已达上限（${MAX_COLLECTIONS}）` })
  }
  const coll: WrongCollection = {
    id: randomBytes(8).toString('hex'),
    name: parsed.data.name,
    createdAt: Date.now(),
    items: [],
    messages: [],
  }
  user.wrongCollections.push(coll)
  await saveUsers(users)
  return res.status(201).json({ collection: coll })
})

// 删除错题合集
wrongbookRouter.delete('/:id', async (req: Request, res: Response) => {
  const rec = await getUserRecord(req)
  if (!rec) return res.status(401).json({ message: '登录已过期，请重新登录' })
  const { users, user } = rec
  if (!user.wrongCollections) user.wrongCollections = []
  const before = user.wrongCollections.length
  user.wrongCollections = user.wrongCollections.filter((c) => c.id !== req.params.id)
  if (user.wrongCollections.length === before) {
    return res.status(404).json({ message: '错题合集不存在' })
  }
  await saveUsers(users)
  return res.json({ collections: user.wrongCollections })
})

// 向合集添加错题（text 手动输入 / image 拍照识别）
wrongbookRouter.post('/:id/items', async (req: Request, res: Response) => {
  const parsed = addItemSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const { text, image } = parsed.data
  if (!text && !image) {
    return res.status(400).json({ message: '请提供错题文本或图片' })
  }
  const rec = await getUserRecord(req)
  if (!rec) return res.status(401).json({ message: '登录已过期，请重新登录' })
  const { users, user } = rec
  const coll = (user.wrongCollections || []).find((c) => c.id === req.params.id)
  if (!coll) return res.status(404).json({ message: '错题合集不存在' })

  let itemText = text?.trim() || ''
  let imageUrl: string | undefined
  if (image) {
    if (!AI_API_KEY) {
      return res.status(503).json({ message: 'AI 服务未配置，无法识别图片，请手动输入错题' })
    }
    try {
      const extracted = await extractWrongQuestion(image)
      if (!extracted.trim()) {
        return res.status(400).json({ message: '未能从图片中识别到题目，请重试或手动输入' })
      }
      itemText = extracted.trim()
      imageUrl = image
    } catch (e: any) {
      const status = e?.statusCode || 502
      return res.status(status).json({ message: e?.message || '图片识别失败', detail: e?.detail || '' })
    }
  }

  const item: WrongItem = {
    id: randomBytes(8).toString('hex'),
    text: itemText,
    source: image ? 'photo' : 'text',
    imageUrl,
    createdAt: Date.now(),
  }
  coll.items.push(item)
  await saveUsers(users)
  return res.json({ collection: coll })
})

// 删除合集中的某条错题
wrongbookRouter.delete('/:id/items/:itemId', async (req: Request, res: Response) => {
  const rec = await getUserRecord(req)
  if (!rec) return res.status(401).json({ message: '登录已过期，请重新登录' })
  const { users, user } = rec
  const coll = (user.wrongCollections || []).find((c) => c.id === req.params.id)
  if (!coll) return res.status(404).json({ message: '错题合集不存在' })
  const before = coll.items.length
  coll.items = coll.items.filter((it) => it.id !== req.params.itemId)
  if (coll.items.length === before) {
    return res.status(404).json({ message: '该错题不存在' })
  }
  await saveUsers(users)
  return res.json({ collection: coll })
})

// 隔离的 AI 对话（仅基于当前合集的错题作答）
wrongbookRouter.post('/:id/chat', async (req: Request, res: Response) => {
  if (!AI_API_KEY) {
    return res.status(503).json({ message: 'AI 服务未配置（AGNES_API_KEY 缺失）' })
  }
  const parsed = chatMsgSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const rec = await getUserRecord(req)
  if (!rec) return res.status(401).json({ message: '登录已过期，请重新登录' })
  const { users, user } = rec
  const coll = (user.wrongCollections || []).find((c) => c.id === req.params.id)
  if (!coll) return res.status(404).json({ message: '错题合集不存在' })

  const history = parsed.data.messages
  const messages = [
    { role: 'system' as const, content: buildSystemPrompt(coll.name, coll.items) },
    ...history.map((m) => ({ role: m.role, content: m.text })),
  ]

  try {
    const r = await fetchAI('/chat/completions', {
      model: CHAT_MODEL,
      messages,
      max_tokens: 3000,
      temperature: 0.7,
      reasoning_effort: REASONING_EFFORT,
    })
    if (!r.ok) {
      const txt = await r.text().catch(() => '')
      return res.status(502).json({ message: `AI 服务错误：${r.status}`, detail: txt.slice(0, 300) })
    }
    const data: any = await r.json()
    const content: string = data?.choices?.[0]?.message?.content || ''
    if (!content.trim()) {
      return res.status(502).json({ message: 'AI 返回内容为空，请重试' })
    }
    // 持久化对话（保留最近 MAX_MESSAGES 条），实现跨设备续聊
    const stamped = [
      ...history.map((m) => ({ role: m.role, text: m.text, createdAt: Date.now() })),
      { role: 'assistant' as const, text: content, createdAt: Date.now() },
    ].slice(-MAX_MESSAGES)
    coll.messages = stamped
    await saveUsers(users)
    return res.json({ content })
  } catch (e: any) {
    const status = e?.statusCode || 500
    return res.status(status).json({ message: e?.message || 'AI 调用失败', detail: e?.detail || '' })
  }
})
