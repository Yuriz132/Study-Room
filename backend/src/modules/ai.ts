import { Router, type Request, type Response } from 'express'
import { z } from 'zod'

// ============================================
// AI 代理模块（持有 Agnes API Key，避免泄露到前端）
// 转发至 https://api.agnes-ai.cn/v1 (OpenAI 兼容协议)
// 文档：https://wiki.agnes-ai.cn/llms.txt
// 可用模型（本账号）：agnes-2.5-flash / agnes-2.5-pro-alpha / agnes-image-2.1-flash / agnes-video-v2.0
//   - agnes-2.5-flash：对话 + 多模态视觉，统一用于 chat 与 vision
// ============================================

// 基础地址可经环境变量覆盖（便于切换网关 / 本地代理）
const AI_BASE = process.env.AI_BASE_URL || 'https://api.agnes-ai.cn/v1'
// 优先使用 Agnes 密钥；旧 Step Fun 密钥作为回退（若仍配置）
const AI_API_KEY = process.env.AGNES_API_KEY || process.env.STEP_API_KEY || ''

// 默认模型：agnes-2.5-flash 同时支持文本对话与图片视觉理解
const CHAT_MODEL = process.env.AI_CHAT_MODEL || 'agnes-2.5-flash'
const VISION_MODEL = process.env.AI_VISION_MODEL || 'agnes-2.5-flash'

// agnes-2.5-flash 为快速模型，使用最低推理预算，直接输出答案，更快更省额度
// 注意：Agnes 仅接受 low / medium / high，不支持 openai 的 "none"
const REASONING_EFFORT = process.env.AI_REASONING_EFFORT || 'low'

// 重试配置：网络抖动 / 上游 5xx 兜底
const MAX_RETRIES = 3
const RETRY_BASE_DELAY = 600 // ms
const FETCH_TIMEOUT_MS = 90_000

/**
 * 模型名归一化：
 * - 未指定 → 使用 CHAT_MODEL
 * - 旧的 step-* / agn-* 模型（如 step-3.5-flash-2603、agnes-2.0-flash）→ 映射到当前 Agnes 模型
 * - 其它（如显式传 agnes-2.5-pro-alpha）→ 原样透传
 */
function normalizeModel(model?: string): string {
  if (!model) return CHAT_MODEL
  if (model.startsWith('step') || model.startsWith('agn')) return CHAT_MODEL
  return model
}

/**
 * 带超时 + 重试的 fetch 封装。
 * 仅对可重试错误重试：网络异常(fetch failed / timeout) 与 5xx 状态码。
 * 4xx（含 400 参数错误）不重试，直接抛出，由调用方处理。
 */
async function fetchAI(
  path: string,
  body: any,
  attempt = 0,
): Promise<globalThis.Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const r = await fetch(`${AI_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    // 5xx 视为可重试（网关抖动 / 过载）；4xx 直接返回，不重试
    if (r.status >= 500) {
      const txt = await r.text().catch(() => '')
      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt)
        await new Promise((res) => setTimeout(res, delay))
        return fetchAI(path, body, attempt + 1)
      }
      const err: any = new Error(`upstream ${r.status}`)
      err.statusCode = 502
      err.detail = txt.slice(0, 400)
      throw err
    }
    return r
  } catch (e: any) {
    const isRetryable =
      !e?.statusCode &&
      (e?.name === 'AbortError' ||
        /fetch failed|timeout|network|ECONN|ENOTFOUND|ETIMEDOUT/i.test(e?.message || ''))
    if (isRetryable && attempt < MAX_RETRIES - 1) {
      const delay = RETRY_BASE_DELAY * Math.pow(2, attempt)
      await new Promise((res) => setTimeout(res, delay))
      return fetchAI(path, body, attempt + 1)
    }
    if (e?.statusCode) throw e
    const wrapped: any = new Error(
      e?.name === 'AbortError' ? 'AI 请求超时' : 'AI 服务连接失败'
    )
    wrapped.statusCode = 502
    wrapped.detail = (e?.message || String(e)).slice(0, 300)
    throw wrapped
  } finally {
    clearTimeout(timer)
  }
}

export const aiRouter: Router = Router()

/** 通用 chat：POST /ai/chat */
const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string().min(1).max(20000),
    })
  ).min(1).max(40),
  model: z.string().optional(),
  max_tokens: z.number().int().min(1).max(4096).optional(),
  temperature: z.number().min(0).max(2).optional(),
  stream: z.boolean().optional(),
})

aiRouter.post('/ai/chat', async (req: Request, res: Response) => {
  if (!AI_API_KEY) {
    return res.status(503).json({ message: 'AI 服务未配置（AGNES_API_KEY 缺失）' })
  }
  const parsed = chatSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const { messages, model, max_tokens, temperature, stream } = parsed.data
  try {
    const body: any = {
      model: normalizeModel(model),
      messages,
      max_tokens: max_tokens || 3000,
      temperature: temperature ?? 0.7,
      reasoning_effort: REASONING_EFFORT,
    }
    if (stream) body.stream = true

    // 重试：偶发把 token 预算耗在思维链上导致 content 为空时，翻倍 max_tokens 重试（上限 4096）
    const MAX_CONTENT_RETRIES = 3
    for (let attempt = 0; attempt < MAX_CONTENT_RETRIES; attempt++) {
      const attemptBody: any = {
        ...body,
        max_tokens: Math.min((body.max_tokens || 3000) * Math.pow(2, attempt), 4096),
      }
      const r = await fetchAI('/chat/completions', attemptBody)

      if (!r.ok) {
        const txt = await r.text().catch(() => '')
        // 上游 5xx 已在 fetchAI 内重试过；仍失败直接报错
        return res.status(502).json({ message: `AI 服务错误：${r.status}`, detail: txt.slice(0, 300) })
      }

      if (stream) {
        // 直接透传上游 SSE（逐字流式）：前端边收边渲染，无需等待整段生成完成
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.flushHeaders()
        const reader = r.body?.getReader()
        if (!reader) { res.end(); return }
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            res.write(Buffer.from(value))
          }
        } catch {
          try { res.write('\n') } catch {}
        }
        res.end()
        return
      }

      const data: any = await r.json()
      const content: string = data?.choices?.[0]?.message?.content || ''
      if (!content.trim()) continue // 空内容，重试
      return res.json({ content, model: data?.model || attemptBody.model })
    }

    // 多次重试仍为空
    return res.status(502).json({ message: 'AI 返回内容为空，请重试', detail: 'empty content after retries' })
  } catch (e: any) {
    const status = e?.statusCode || 500
    return res.status(status).json({
      message: e?.message || 'AI 调用失败',
      detail: e?.detail || '',
    })
  }
})

/** 图片识别：POST /ai/vision/extract-words */
const visionSchema = z.object({
  image: z.string().min(50, '图片数据为空'), // base64 data URL
  hint: z.string().max(200).optional(),
})

aiRouter.post('/ai/vision/extract-words', async (req: Request, res: Response) => {
  if (!AI_API_KEY) {
    return res.status(503).json({ message: 'AI 服务未配置（AGNES_API_KEY 缺失）' })
  }
  const parsed = visionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const { image, hint } = parsed.data
  const sys = `你是一位英语单词整理助手。用户的图片中可能包含：
1. 英文单词表（每行一个或多个英文单词，可能带音标和中文）
2. 英文文章、笔记或短句

任务：
- 提取图中所有英文单词
- 如果原图没有中文释义，为每个英文单词补充准确、简洁的中文释义（1-2 词）
- 如果原图只有短语或文章片段，提取其中可作为学习单元的关键词并补充中文
- 严格以 JSON 数组格式返回：[{"word":"apple","phonetic":"/??pl/","meaning":"苹果"}, ...]
- 只返回 JSON 数组，不要包含任何其他说明文字
- 如果图片中确实没有任何英文内容，返回空数组 []`

  const user = hint
    ? `请识别并整理图片中的英文单词。附加说明：${hint}`
    : '请识别并整理图片中的英文单词。'
  try {
    const r = await fetchAI('/chat/completions', {
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: sys },
        {
          role: 'user',
          content: [
            { type: 'text', text: user },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ],
      max_tokens: 3000,
      temperature: 0.3,
      reasoning_effort: REASONING_EFFORT,
    })
    if (!r.ok) {
      const txt = await r.text()
      return res.status(502).json({ message: `AI 视觉服务错误：${r.status}`, detail: txt.slice(0, 300) })
    }
    const data: any = await r.json()
    const content: string = data?.choices?.[0]?.message?.content || '[]'
    const arr = parseWordsJson(content)
    return res.json({ words: arr.words, raw: content, ...(arr.notes ? { notes: arr.notes } : {}) })
  } catch (e: any) {
    const status = e?.statusCode || 500
    return res.status(status).json({
      message: e?.message || 'AI 视觉调用失败',
      detail: e?.detail || '',
    })
  }
})

/** 笔记图片解析：把图片笔记整理为结构化中文说明（而非仅提取单词） */
const noteSchema = z.object({
  images: z.array(z.string().min(50, '图片数据为空')).min(1).max(6),
  hint: z.string().max(200).optional(),
})

aiRouter.post('/ai/vision/analyze-note', async (req: Request, res: Response) => {
  if (!AI_API_KEY) {
    return res.status(503).json({ message: 'AI 服务未配置（AGNES_API_KEY 缺失）' })
  }
  const parsed = noteSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const { images, hint } = parsed.data
  const sys = `你是一位「学习笔记整理助手」。用户上传了一张或多张笔记图片（可能是手写笔记、课本/文章截图、单词表、中文批注或混合内容）。
请完成：
1. 概览：用 1-2 句话说明这张/这组笔记的整体主题与内容类型。
2. 内容整理：把笔记要点有条理地整理出来（保留原文关键英文单词并给出中文释义；公式/列表保持结构；忽略无关涂鸦）。
3. 学习提示：如有助于理解，补充少量（2-4 条）记忆点或延伸，不要喧宾夺主。
要求：
- 用简体中文、**纯文本**输出，用换行分段；**不要使用任何 markdown 符号**（如 #、-、*、>、\` 等）。
- 可用「一、」「二、」或「1.」「2.」这样的纯文字编号让结构清晰，但不要用 markdown 列表或标题符号。
- 不要编造笔记中不存在的内容；看不清的注明「（无法辨认）」。
- 直接输出整理结果，不要加开场白或结尾客套。`

  const user = hint
    ? `请整理这张笔记。附加说明：${hint}`
    : '请整理这张笔记图片的内容。'
  try {
    const contentParts: any[] = [{ type: 'text', text: user }]
    for (const img of images) {
      contentParts.push({ type: 'image_url', image_url: { url: img } })
    }
    const r = await fetchAI('/chat/completions', {
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: contentParts },
      ],
      max_tokens: 2000,
      temperature: 0.4,
      reasoning_effort: REASONING_EFFORT,
    })
    if (!r.ok) {
      const txt = await r.text()
      return res.status(502).json({ message: `AI 视觉服务错误：${r.status}`, detail: txt.slice(0, 300) })
    }
    const data: any = await r.json()
    const analysis: string = data?.choices?.[0]?.message?.content || ''
    if (!analysis.trim()) {
      return res.status(502).json({ message: 'AI 返回内容为空，请重试', detail: 'empty content' })
    }
    return res.json({ analysis, raw: analysis })
  } catch (e: any) {
    const status = e?.statusCode || 500
    return res.status(status).json({
      message: e?.message || 'AI 笔记解析失败',
      detail: e?.detail || '',
    })
  }
})

/** 容错地从模型输出中提取单词 JSON 数组 */
function parseWordsJson(text: string): { words: Array<{ word: string; phonetic?: string; meaning: string }>; notes?: string } {
  if (!text) return { words: [] }

  // 1) 优先严格 JSON 解析（模型输出规范时走这里）
  const s = text.indexOf('[')
  const e = text.lastIndexOf(']')
  if (s >= 0 && e > s) {
    const slice = text.slice(s, e + 1)
    try {
      const arr = JSON.parse(slice)
      if (Array.isArray(arr)) {
        const words = arr
          .map((x: any) => ({
            word: String(x?.word ?? x?.term ?? '').trim(),
            phonetic: x?.phonetic || x?.ipa || undefined,
            meaning: String(x?.meaning ?? x?.translation ?? x?.cn ?? '').trim(),
          }))
          .filter((w: any) => w.word && w.meaning)
        if (words.length) return { words }
      }
    } catch {
      // 模型偶发输出轻微格式错误（如缺冒号），落到下面的容错正则提取
    }
  }

  // 2) 容错正则提取：按字段名抓取 word / phonetic / meaning，再按下标对齐。
  //    关键：允许字段名后缺失冒号（:?），以兼容模型偶发的格式瑕疵。
  const grab = (key: string): string[] => {
    const re = new RegExp(`"${key}"\\s*:?\\s*"([^"]*)"`, 'g')
    const out: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) out.push(m[1])
    return out
  }
  const ws = grab('word')
  const ms = grab('meaning')
  const ps = grab('phonetic')
  const n = Math.min(ws.length, ms.length)
  if (n > 0) {
    const words: Array<{ word: string; phonetic?: string; meaning: string }> = []
    for (let i = 0; i < n; i++) {
      const word = ws[i].trim()
      const meaning = ms[i].trim()
      if (word && meaning) {
        words.push({ word, phonetic: ps[i] ? ps[i].trim() : undefined, meaning })
      }
    }
    if (words.length) return { words, notes: '已用容错解析修正模型输出' }
  }

  // 3) 行式解析兜底（纯文本「word — 释义」格式）
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const words: Array<{ word: string; phonetic?: string; meaning: string }> = []
  for (const ln of lines) {
    const m = ln.match(/^([A-Za-z][A-Za-z\s\-']+)(?:\s*[\/|]\s*([^|]+?))?\s*[\-|]\s*(.+)$/)
    if (m) {
      const w = m[1].trim()
      const p = m[2]?.trim()
      const cn = m[3].trim()
      if (w && cn) words.push({ word: w, phonetic: p, meaning: cn })
    }
  }
  return { words, notes: words.length ? '已尝试行式解析' : '未能从模型输出中解析出单词' }
}
