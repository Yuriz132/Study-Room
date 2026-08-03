import { Router, type Request, type Response } from 'express'
import { promises as fs } from 'fs'
import path from 'path'
import { authMiddleware, adminMiddleware, loadUsers, saveUsers, verifyPassword } from './auth'
import { loadGraph, saveGraph } from './friends'
import { removeUserMessages } from './dmStore'

// 帖子/评论落盘目录（与 auth.ts 共用同一个 data 目录约定）
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')
const POSTS_FILE = path.join(DATA_DIR, 'forum_posts.json')
const LIKES_FILE = path.join(DATA_DIR, 'forum_likes.json')
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json')

// 与 forum.ts 保持一致：帖子 id -> 评论 wordId 的纯函数映射
function postIdToWordId(postId: string): number {
  let h = 0
  for (let i = 0; i < postId.length; i++) {
    h = ((h << 5) - h + postId.charCodeAt(i)) | 0
  }
  return -(Math.abs(h) + 1_000_000)
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8')
}

/** 删除某用户发布的全部帖子（含点赞与级联评论） */
async function purgeUserPosts(username: string): Promise<void> {
  const posts = await readJson<Array<{ _id: string; author: string }>>(POSTS_FILE, [])
  const removed = posts.filter((p) => p.author === username)
  if (removed.length === 0) return
  const removedIds = new Set(removed.map((p) => p._id))
  const rest = posts.filter((p) => p.author !== username)
  await writeJson(POSTS_FILE, rest)
  // 清理对应点赞记录
  const likes = await readJson<Record<string, string[]>>(LIKES_FILE, {})
  let likesChanged = false
  for (const id of removedIds) {
    if (id in likes) { delete likes[id]; likesChanged = true }
  }
  if (likesChanged) await writeJson(LIKES_FILE, likes)
  // 级联删除这些帖子的评论
  const comments = await readJson<Array<{ wordId: number }>>(COMMENTS_FILE, [])
  const wids = new Set([...removedIds].map((id) => postIdToWordId(id)))
  const restC = comments.filter((c) => !wids.has(c.wordId))
  if (restC.length !== comments.length) await writeJson(COMMENTS_FILE, restC)
}

/** 删除某用户发表的全部评论（含其回复） */
async function purgeUserComments(username: string): Promise<void> {
  const comments = await readJson<Array<{ _id: string; author: string; parentId?: string }>>(COMMENTS_FILE, [])
  const removedIds = new Set(comments.filter((c) => c.author === username).map((c) => c._id))
  if (removedIds.size === 0) return
  const rest = comments.filter((c) => !removedIds.has(c._id) && !(c.parentId && removedIds.has(c.parentId)))
  await writeJson(COMMENTS_FILE, rest)
}

type AuthedReq = Request & { user?: { username: string } }

export const accountRouter: Router = Router()

// 所有账号操作均需登录
accountRouter.use(authMiddleware)

/** 删除用户并清理其好友关系与私信数据 */
async function deleteUser(username: string): Promise<boolean> {
  const users = await loadUsers()
  const idx = users.findIndex((u) => u.username === username)
  if (idx < 0) return false
  users.splice(idx, 1)
  await saveUsers(users)

  // 清理好友关系图
  const g = await loadGraph()
  delete g[username]
  for (const k of Object.keys(g)) {
    const n = g[k]
    if (!n) continue
    n.friends = n.friends.filter((x) => x !== username)
    n.incoming = n.incoming.filter((x) => x !== username)
    n.outgoing = n.outgoing.filter((x) => x !== username)
  }
  await saveGraph(g)

  // 清理私信会话
  await removeUserMessages(username)
  // 清理该用户发布的全部帖子（含点赞与级联评论）
  await purgeUserPosts(username)
  // 清理该用户发表的全部评论（含其回复）
  await purgeUserComments(username)
  return true
}

// 注销当前账号（需输入密码确认）
accountRouter.delete('/', async (req: Request, res: Response) => {
  const me = (req as AuthedReq).user!.username
  const body = (req.body || {}) as { password?: string }
  if (!body.password) {
    return res.status(400).json({ message: '请输入密码' })
  }
  const users = await loadUsers()
  const u = users.find((x) => x.username === me)
  if (!u) return res.status(404).json({ message: '账号不存在' })
  if (!verifyPassword(body.password, u.salt, u.passwordHash)) {
    return res.status(401).json({ message: '密码错误' })
  }
  await deleteUser(me)
  return res.json({ ok: true })
})

// 管理员注销任意用户（无需密码）
accountRouter.delete('/admin/:username', adminMiddleware, async (req: Request, res: Response) => {
  const raw = req.params.username
  const target = decodeURIComponent(Array.isArray(raw) ? raw[0] : raw)
  const ok = await deleteUser(target)
  if (!ok) return res.status(404).json({ message: '用户不存在' })
  return res.json({ ok: true })
})
