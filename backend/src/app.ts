import express, { Application } from 'express'
import cors from 'cors'
import compression from 'compression'
import 'express-async-errors'
import { env } from './config/env'
import { errorHandler } from './middleware/errorHandler'
import { httpLogger } from './middleware/logger'
import { systemRouter } from './modules/system'
import { authRouter } from './modules/auth'
import { commentsRouter } from './modules/comments'
import { aiRouter } from './modules/ai'
import { leaderboardRouter } from './modules/leaderboard'
import { publicNotesRouter } from './modules/public-notes'
import { forumRouter } from './modules/forum'
import { friendsRouter } from './modules/friends'
import { accountRouter } from './modules/account'
import { dmRouter } from './modules/dm'
import { wrongbookRouter } from './modules/wrongbook'
import { checkinRouter } from './modules/checkin'
// ============================================
// Add your domain module imports here
// ============================================
// Example: Product Module
// import { productRouter } from './modules/product.js'

export const createApp = (): Application => {
  const app = express()

  // 信任前置 nginx 反代，使 req.ip 取到真实客户端 IP（用于按 IP 限流/封禁）
  app.set('trust proxy', 1)

  // HTTP request logging
  app.use(httpLogger)

  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN,
      credentials: env.CORS_ORIGIN !== '*',
    })
  )

  // Body parsing and compression (AI 图片 base64 较大，放宽到 20mb)
  app.use(express.json({ limit: '20mb' }))
  app.use(express.urlencoded({ extended: true, limit: '20mb' }))
  app.use(compression())

  // API routes - System & Health
  app.use(env.API_PREFIX, systemRouter)

  // 账户 + 云端学习进度
  app.use(env.API_PREFIX, authRouter)

  // 评论（仅登录可发表，读取公开）
  app.use(env.API_PREFIX, commentsRouter)

  // AI 代理（持有 AGNES_API_KEY）
  app.use(env.API_PREFIX, aiRouter)

  // 排行榜（公开）
  app.use(env.API_PREFIX, leaderboardRouter)

  // 公共笔记（登录可发表，读取公开）
  app.use(env.API_PREFIX, publicNotesRouter)

  // 论坛帖子（登录可发表，读取公开）
  app.use(env.API_PREFIX, forumRouter)

  // 好友关系（均需登录）
  app.use(env.API_PREFIX, friendsRouter)

  // 账号注销（自注销需密码 + 管理员注销任意用户）
  app.use(`${env.API_PREFIX}/account`, accountRouter)

  // 私信（含好友邀请 REST 接口）
  app.use(`${env.API_PREFIX}/dm`, dmRouter)

  // 错题合集（拍照/文本收集 + 每个合集隔离的 AI 分析）
  app.use(`${env.API_PREFIX}/wrongbook`, wrongbookRouter)

  // 签到领会员（服务端记账 + 达标时间戳排序）
  app.use(`${env.API_PREFIX}/account/checkin`, checkinRouter)

  // ============================================
  // Add your domain module routes here
  // ============================================
  // Example: Product Module
  // app.use(`${env.API_PREFIX}/products`, productRouter)

  // Error handling
  app.use(errorHandler)

  return app
}
