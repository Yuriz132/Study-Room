import { Router, type Request, type Response } from 'express'
import { randomBytes } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { z } from 'zod'
import { authMiddleware, loadUsers } from './auth'
import { loadComments, saveComments } from './comments'

export function postIdToWordId(postId: string): number {
  let h = 0
  for (let i = 0; i < postId.length; i++) {
    h = ((h << 5) - h + postId.charCodeAt(i)) | 0
  }
  return -(Math.abs(h) + 1_000_000)
}

export type ForumCategory = 'announcement' | 'entertainment' | 'study' | 'qa' | 'daily'

export interface ForumPost {
  _id: string
  category: ForumCategory
  title: string
  content: string
  author: string
  images?: string[]
  createdAt: number
  updatedAt: number
  hidden?: boolean
  flagReason?: string
  views?: number
  /** 作者头像（被封禁则为 null），由后端按用户表富化 */
  authorAvatar?: string | null
}

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')
const POSTS_FILE = path.join(DATA_DIR, 'forum_posts.json')
const LIKES_FILE = path.join(DATA_DIR, 'forum_likes.json')

let postsCache: ForumPost[] | null = null
let likesCache: Record<string, string[]> | null = null

async function loadPosts(): Promise<ForumPost[]> {
  if (postsCache) return postsCache
  try {
    const raw = await fs.readFile(POSTS_FILE, 'utf-8')
    postsCache = JSON.parse(raw) as ForumPost[]
  } catch {
    postsCache = []
  }
  return postsCache
}

async function savePosts(list: ForumPost[]): Promise<void> {
  postsCache = list
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(POSTS_FILE, JSON.stringify(list, null, 2), 'utf-8')
}

async function loadLikes(): Promise<Record<string, string[]>> {
  if (likesCache) return likesCache
  try {
    const raw = await fs.readFile(LIKES_FILE, 'utf-8')
    likesCache = JSON.parse(raw) as Record<string, string[]>
  } catch {
    likesCache = {}
  }
  return likesCache
}

async function saveLikes(data: Record<string, string[]>): Promise<void> {
  likesCache = data
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(LIKES_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

async function enrichPosts(posts: ForumPost[]): Promise<Array<ForumPost & { commentCount: number; likes: number; authorAvatar?: string | null }>> {
  const likes = await loadLikes()
  const comments = await loadComments()
  const users = await loadUsers()
  const userMap = new Map(users.map((u) => [u.username, u]))
  return posts.map(p => {
    const wid = postIdToWordId(p._id)
    const commentCount = comments.filter(c => c.wordId === wid).length
    const userList = likes[p._id] || []
    const u = userMap.get(p.author)
    const authorAvatar = u && !u.avatarBanned ? (u.avatar ?? null) : null
    return { ...p, views: p.views || 0, likes: userList.length, commentCount, authorAvatar }
  })
}

const postSchema = z.object({
  category: z.enum(['announcement', 'entertainment', 'study', 'qa', 'daily']),
  title: z.string().trim().min(1, '标题不能为空').max(60, '标题最多 60 字'),
  content: z.string().trim().max(5000, '内容最多 5000 字').optional().default(''),
  images: z.array(z.string().regex(/^uploads\/[a-f0-9]{24}\.(jpg|png|webp|gif)$/)).max(9).optional(),
})

export const forumRouter: Router = Router()

forumRouter.get('/forum/posts', async (req: Request, res: Response) => {
  const cat = (req.query.category as string) || 'all'
  const author = (req.query.author as string) || ''
  const all = await loadPosts()
  let list = all.filter(p => !p.hidden).sort((a, b) => b.createdAt - a.createdAt)
  if (cat !== 'all') list = list.filter(p => p.category === cat)
  if (author) list = list.filter(p => p.author === author)
  const enriched = await enrichPosts(list)
  return res.json(enriched)
})

forumRouter.get('/forum/posts/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const all = await loadPosts()
  const idx = all.findIndex(p => p._id === id)
  if (idx < 0) return res.status(404).json({ message: '帖子不存在' })
  all[idx].views = (all[idx].views || 0) + 1
  await savePosts(all)
  const [enriched] = await enrichPosts([all[idx]])
  return res.json(enriched)
})

forumRouter.post('/forum/posts/:id/view', async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const all = await loadPosts()
  const idx = all.findIndex(p => p._id === id)
  if (idx < 0) return res.status(404).json({ message: '帖子不存在' })
  all[idx].views = (all[idx].views || 0) + 1
  await savePosts(all)
  return res.json({ views: all[idx].views })
})

forumRouter.post('/forum/posts/:id/like', authMiddleware, async (req: Request, res: Response) => {
  const u = (req as unknown as Record<string, unknown>).user as { username: string; role?: string } | undefined
  if (!u) return res.status(401).json({ message: '请登录' })
  const id = String(req.params.id)
  const all = await loadPosts()
  const idx = all.findIndex(p => p._id === id)
  if (idx < 0) return res.status(404).json({ message: '帖子不存在' })
  const likes = await loadLikes()
  const list = likes[id] || []
  const liked = list.includes(u.username)
  if (liked) {
    likes[id] = list.filter(x => x !== u.username)
  } else {
    likes[id] = [...list, u.username]
  }
  await saveLikes(likes)
  return res.json({ liked: !liked, likes: likes[id].length })
})

forumRouter.get('/forum/posts/:id/liked', authMiddleware, async (req: Request, res: Response) => {
  const u = (req as unknown as Record<string, unknown>).user as { username: string } | undefined
  if (!u) return res.json({ liked: false })
  const id = String(req.params.id)
  const likes = await loadLikes()
  const list = likes[id] || []
  return res.json({ liked: list.includes(u.username) })
})

forumRouter.post('/forum/posts', authMiddleware, async (req: Request, res: Response) => {
  const parsed = postSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const u = (req as unknown as Record<string, unknown>).user as { username: string; role?: string } | undefined
  const author = u?.username || '匿名'
  const { category, title, content, images } = parsed.data

  // 公告分类仅管理员可发布
  if (category === 'announcement') {
    const isAdminUser = !!u && (u.role === 'admin' || u.username === '20051226')
    if (!isAdminUser) return res.status(403).json({ message: '公告仅限管理员发布' })
  }

  const post: ForumPost = {
    _id: randomBytes(8).toString('hex'),
    category,
    title,
    content: content || '',
    author,
    images,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    hidden: false,
    views: 0,
  }
  const all = await loadPosts()
  all.push(post)
  await savePosts(all)
  return res.status(201).json(post)
})

forumRouter.delete('/forum/posts/:id', authMiddleware, async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const u = (req as unknown as Record<string, unknown>).user as { username: string; role?: string } | undefined
  const all = await loadPosts()
  const idx = all.findIndex(p => p._id === id)
  if (idx < 0) return res.status(404).json({ message: '帖子不存在' })
  // 作者本人或管理员可删（管理员账号 20051226 拥有全部权限）
  const isAdminUser = !!u && (u.role === 'admin' || u.username === '20051226')
  if (!u || (all[idx].author !== u.username && !isAdminUser)) {
    return res.status(403).json({ message: '只能删除自己的帖子' })
  }
  all.splice(idx, 1)
  await savePosts(all)
  const likes = await loadLikes()
  if (likes[id]) {
    delete likes[id]
    await saveLikes(likes)
  }
  // 级联删除该帖子的全部评论与回复
  const wid = postIdToWordId(id)
  const comments = await loadComments()
  const remaining = comments.filter((c) => c.wordId !== wid)
  if (remaining.length !== comments.length) await saveComments(remaining)
  return res.json({ message: '已删除' })
})