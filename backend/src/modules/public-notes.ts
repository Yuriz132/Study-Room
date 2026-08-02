import { Router, type Request, type Response } from 'express'
import { randomBytes } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { z } from 'zod'
import { authMiddleware, adminMiddleware, loadUsers } from './auth'
import { hasForbiddenWord, moderateComment, resolveIsAdmin, type ModerationResult } from './comments'

// ============================================
// 公共笔记模块（共享学习笔记）
// 存储：backend/data/public-notes.json
// 鉴权：登录可发表/编辑/删除自己的，管理员可审核（隐藏/取消隐藏/删除任意）
// 审核：两层 — ① 违禁词硬拦截 ② AI 异步软审核（不阻塞发表）
// ============================================

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')
const NOTES_FILE = path.join(DATA_DIR, 'public-notes.json')

export interface PublicNote {
  _id: string
  title: string
  content: string
  author: string
  createdAt: number
  updatedAt: number
  /** AI 判定为违规内容后自动隐藏；仅管理员可见 */
  hidden?: boolean
  /** 隐藏原因（违规类别 + 说明），仅管理员可见 */
  flagReason?: string
  /** 附图：仅存储本站上传产生的相对路径（如 uploads/ab12....jpg），最多 9 张 */
  images?: string[]
}

let notesCache: PublicNote[] | null = null

async function loadNotes(): Promise<PublicNote[]> {
  if (notesCache) return notesCache
  try {
    const raw = await fs.readFile(NOTES_FILE, 'utf-8')
    notesCache = JSON.parse(raw) as PublicNote[]
  } catch {
    notesCache = []
  }
  return notesCache
}

async function saveNotes(list: PublicNote[]): Promise<void> {
  notesCache = list
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(NOTES_FILE, JSON.stringify(list, null, 2), 'utf-8')
}

// ---------- 校验 schema ----------
const imageSchema = z
  .array(z.string().regex(/^uploads\/[a-f0-9]{24}\.(jpg|png|webp|gif|heic|heif)$/))
  .max(9, '最多 9 张图片')

const createSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(50, '标题最多 50 字'),
  content: z.string().trim().max(5000, '内容最多 5000 字').optional().default(''),
  images: imageSchema.optional(),
}).refine((d) => (d.content ?? '').length > 0 || (d.images && d.images.length > 0), {
  message: '请填写内容或添加图片',
  path: ['content'],
})

const updateSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(50, '标题最多 50 字').optional(),
  content: z.string().trim().max(5000, '内容最多 5000 字').optional(),
  images: imageSchema.optional(),
})

export const publicNotesRouter: Router = Router()

// 读取公开笔记列表（按更新时间倒序，最近 50 条）
// - 普通访客：仅未隐藏的
// - 管理员：全部（含被 AI 隐藏的）
publicNotesRouter.get('/public-notes', async (req: Request, res: Response) => {
  const isAdmin = await resolveIsAdmin(req)
  const all = await loadNotes()
  let list = [...all].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50)
  if (!isAdmin) list = list.filter((n) => !n.hidden)
  return res.json(list)
})

// 读取单条笔记
publicNotesRouter.get('/public-notes/:id', async (req: Request, res: Response) => {
  const isAdmin = await resolveIsAdmin(req)
  const all = await loadNotes()
  const note = all.find((n) => n._id === req.params.id)
  if (!note) {
    return res.status(404).json({ message: '笔记不存在' })
  }
  if (note.hidden && !isAdmin) {
    return res.status(404).json({ message: '笔记不存在' })
  }
  return res.json(note)
})

// 发表公共笔记（需登录）
publicNotesRouter.post('/public-notes', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const { title, content, images } = parsed.data
  // 违禁词硬拦截
  if (hasForbiddenWord(title) || hasForbiddenWord(content ?? '')) {
    return res.status(400).json({ message: '内容包含违禁词汇' })
  }
  // 需要登录（不允许游客发表）
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: '请先登录后再发表公共笔记' })
  }
  const token = header.slice('Bearer '.length).trim()
  const users = await loadUsers()
  const user = users.find((u) => u.token === token)
  if (!user) {
    return res.status(401).json({ message: '登录已过期，请重新登录' })
  }
  const now = Date.now()
  const note: PublicNote = {
    _id: randomBytes(8).toString('hex'),
    title,
    content: content ?? '',
    author: user.username,
    createdAt: now,
    updatedAt: now,
    hidden: false,
  }
  if (images && images.length) note.images = images
  const all = await loadNotes()
  all.push(note)
  await saveNotes(all)
  // 异步 AI 审核
  void moderateAndHideNote(note)
  return res.status(201).json(note)
})

// 编辑笔记（作者本人或管理员）
publicNotesRouter.put('/public-notes/:id', async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const { title, content, images } = parsed.data
  if (!title && !content && !images) {
    return res.status(400).json({ message: '至少修改标题、内容或图片中的一项' })
  }
  // 违禁词拦截
  if ((title && hasForbiddenWord(title)) || (content && hasForbiddenWord(content ?? ''))) {
    return res.status(400).json({ message: '内容包含违禁词汇' })
  }
  // 鉴权
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: '请先登录' })
  }
  const token = header.slice('Bearer '.length).trim()
  const users = await loadUsers()
  const user = users.find((u) => u.token === token)
  if (!user) {
    return res.status(401).json({ message: '登录已过期' })
  }
  const all = await loadNotes()
  const idx = all.findIndex((n) => n._id === req.params.id)
  if (idx < 0) {
    return res.status(404).json({ message: '笔记不存在' })
  }
  const note = all[idx]
  if (note.author !== user.username && user.role !== 'admin') {
    return res.status(403).json({ message: '只能编辑自己的笔记' })
  }
  if (title) note.title = title
  if (content !== undefined) note.content = content
  if (images !== undefined) note.images = images
  note.updatedAt = Date.now()
  await saveNotes(all)
  // 重新 AI 审核
  void moderateAndHideNote(note)
  return res.json(note)
})

// 删除笔记（作者本人或管理员）
publicNotesRouter.delete('/public-notes/:id', async (req: Request, res: Response) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: '请先登录' })
  }
  const token = header.slice('Bearer '.length).trim()
  const users = await loadUsers()
  const user = users.find((u) => u.token === token)
  if (!user) {
    return res.status(401).json({ message: '登录已过期' })
  }
  const all = await loadNotes()
  const idx = all.findIndex((n) => n._id === req.params.id)
  if (idx < 0) {
    return res.status(404).json({ message: '笔记不存在' })
  }
  const note = all[idx]
  if (note.author !== user.username && user.role !== 'admin') {
    return res.status(403).json({ message: '只能删除自己的笔记' })
  }
  all.splice(idx, 1)
  await saveNotes(all)
  return res.json({ message: '已删除' })
})

// 取消隐藏（仅管理员）
publicNotesRouter.patch(
  '/public-notes/:id/unhide',
  authMiddleware,
  adminMiddleware,
  async (req: Request, res: Response) => {
    const all = await loadNotes()
    const idx = all.findIndex((n) => n._id === req.params.id)
    if (idx < 0) {
      return res.status(404).json({ message: '笔记不存在' })
    }
    all[idx].hidden = false
    all[idx].flagReason = undefined
    await saveNotes(all)
    return res.json(all[idx])
  }
)

// 异步审核：命中违规则置为隐藏；失败/无违规/已被处理则保持原样
async function moderateAndHideNote(note: PublicNote): Promise<void> {
  try {
    const combined = `${note.title}：${note.content}`
    const mod: ModerationResult | null = await moderateComment(combined)
    if (!mod?.violation) return
    const list = await loadNotes()
    const idx = list.findIndex((n) => n._id === note._id)
    if (idx < 0 || list[idx].hidden) return
    list[idx].hidden = true
    list[idx].flagReason = [mod.category, mod.reason].filter(Boolean).join('：')
    await saveNotes(list)
  } catch {
    /* 审核异常不影响已发表笔记 */
  }
}
