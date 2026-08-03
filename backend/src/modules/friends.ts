import { Router, type Request, type Response } from 'express'
import { promises as fs } from 'fs'
import path from 'path'
import { z } from 'zod'
import { authMiddleware, loadUsers } from './auth'
import { appendDm, convKey, computeUnread, type DmMessage } from './dmStore'

// ============================================
// 好友关系模块（请求 / 确认制）
// 存储：backend/data/friends.json（与 users.json 同级，不入库）
// 结构：{ [username]: { friends: [], incoming: [], outgoing: [] } }
//   friends  — 互为好友
//   incoming — 收到的好友请求（对方请求我）
//   outgoing — 我发出的好友请求
// ============================================

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')
const FRIENDS_FILE = path.join(DATA_DIR, 'friends.json')

interface FriendNode {
  friends: string[]
  incoming: string[]
  outgoing: string[]
}

type FriendGraph = Record<string, FriendNode>

let graphCache: FriendGraph | null = null

export async function loadGraph(): Promise<FriendGraph> {
  if (graphCache) return graphCache
  try {
    const raw = await fs.readFile(FRIENDS_FILE, 'utf-8')
    graphCache = JSON.parse(raw) as FriendGraph
  } catch {
    graphCache = {}
  }
  return graphCache
}

export async function saveGraph(g: FriendGraph): Promise<void> {
  graphCache = g
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(FRIENDS_FILE, JSON.stringify(g, null, 2), 'utf-8')
}

function node(g: FriendGraph, name: string): FriendNode {
  if (!g[name]) g[name] = { friends: [], incoming: [], outgoing: [] }
  return g[name]
}

type AuthedReq = Request & { user?: { username: string } }

const targetSchema = z.object({ friendUsername: z.string().trim().min(1, '用户名不能为空') })

export const friendsRouter: Router = Router()

// 所有好友接口均需登录
friendsRouter.use(authMiddleware)

// 获取我自己的好友关系
friendsRouter.get('/friends', async (req: Request, res: Response) => {
  const me = (req as AuthedReq).user!.username
  const g = await loadGraph()
  const n = g[me] || { friends: [], incoming: [], outgoing: [] }
  return res.json({ friends: n.friends, incoming: n.incoming, outgoing: n.outgoing })
})

// 好友相关红点指标：待处理好友申请数 + 未读私信数（含按好友归类）
friendsRouter.get('/friends/indicators', async (req: Request, res: Response) => {
  const me = (req as AuthedReq).user!.username
  const g = await loadGraph()
  const requests = (g[me]?.incoming || []).length
  const { total, byFriend } = await computeUnread(me)
  return res.json({ requests, unread: total, unreadByFriend: byFriend, has: requests > 0 || total > 0 })
})

// 发送好友请求
friendsRouter.post('/friends/request', async (req: Request, res: Response) => {
  const parsed = targetSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '参数错误' })
  const me = (req as AuthedReq).user!.username
  const target = parsed.data.friendUsername
  if (me === target) return res.status(400).json({ message: '不能添加自己为好友' })

  const users = await loadUsers()
  if (!users.some((u) => u.username === target)) {
    return res.status(404).json({ message: '用户不存在' })
  }

  const g = await loadGraph()
  const mine = node(g, me)
  const theirs = node(g, target)

  // 已互为好友
  if (mine.friends.includes(target)) {
    return res.status(409).json({ message: '已经是好友了' })
  }
  // 对方已先向我发送请求：直接转为互相确认
  if (mine.incoming.includes(target)) {
    mine.incoming = mine.incoming.filter((x) => x !== target)
    theirs.outgoing = theirs.outgoing.filter((x) => x !== me)
    mine.friends.push(target)
    theirs.friends.push(me)
    await saveGraph(g)
    return res.json({ status: 'friend' })
  }
  // 我已经发过请求
  if (mine.outgoing.includes(target)) {
    return res.status(409).json({ message: '好友请求已发送，等待对方确认' })
  }

  mine.outgoing.push(target)
  theirs.incoming.push(me)
  await saveGraph(g)
  return res.json({ status: 'outgoing' })
})

// 接受好友请求
friendsRouter.post('/friends/accept', async (req: Request, res: Response) => {
  const parsed = targetSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '参数错误' })
  const me = (req as AuthedReq).user!.username
  const target = parsed.data.friendUsername

  const g = await loadGraph()
  const mine = node(g, me)
  const theirs = node(g, target)

  const idx = mine.incoming.indexOf(target)
  if (idx < 0) return res.status(404).json({ message: '没有收到该用户的好友请求' })

  mine.incoming.splice(idx, 1)
  theirs.outgoing = theirs.outgoing.filter((x) => x !== me)
  if (!mine.friends.includes(target)) mine.friends.push(target)
  if (!theirs.friends.includes(me)) theirs.friends.push(me)
  await saveGraph(g)
  // 互相成为好友后，在私信会话里插入系统提示
  try {
    const sysMsg: DmMessage = {
      id: Math.random().toString(36).slice(2, 10),
      conv: convKey(me, target),
      from: me,
      to: target,
      text: '🎉 你们已成为好友，可以开始私信聊天啦！',
      type: 'system',
      timestamp: Date.now(),
      read: true,
    }
    await appendDm(sysMsg)
  } catch { /* ignore */ }
  return res.json({ status: 'friend' })
})

// 拒绝好友请求
friendsRouter.post('/friends/reject', async (req: Request, res: Response) => {
  const parsed = targetSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '参数错误' })
  const me = (req as AuthedReq).user!.username
  const target = parsed.data.friendUsername

  const g = await loadGraph()
  const mine = node(g, me)
  const theirs = node(g, target)

  mine.incoming = mine.incoming.filter((x) => x !== target)
  theirs.outgoing = theirs.outgoing.filter((x) => x !== me)
  await saveGraph(g)
  return res.json({ status: 'rejected' })
})

// 删除好友（双向解除）
friendsRouter.delete('/friends/:username', async (req: Request, res: Response) => {
  const me = (req as AuthedReq).user!.username
  const target = String(req.params.username)
  const g = await loadGraph()
  const mine = g[me]
  const theirs = g[target]
  if (mine) mine.friends = mine.friends.filter((x) => x !== target)
  if (theirs) theirs.friends = theirs.friends.filter((x) => x !== me)
  await saveGraph(g)
  return res.json({ status: 'none' })
})

// 查询与目标用户的关系状态
friendsRouter.get('/friends/status/:username', async (req: Request, res: Response) => {
  const me = (req as AuthedReq).user!.username
  const target = String(req.params.username)
  if (me === target) return res.json({ status: 'self' })
  const g = await loadGraph()
  const mine = g[me] || { friends: [], incoming: [], outgoing: [] }
  let status = 'none'
  if (mine.friends.includes(target)) status = 'friend'
  else if (mine.outgoing.includes(target)) status = 'outgoing'
  else if (mine.incoming.includes(target)) status = 'incoming'
  return res.json({ status })
})
