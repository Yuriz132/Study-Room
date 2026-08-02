import { Server, Socket } from 'socket.io'
import { readFileSync } from 'fs'
import path from 'path'
import { getUserByToken, recordPkWin } from './auth'

/**
 * 单词 PK 实时对战（服务器权威）
 * - 出题/计时/计分全部由服务器决定，防作弊、两端天然一致
 * - 支持「真人对战」（匹配队列）与「人机对战」（服务器模拟机器人）
 * - 胜利方（真人对战）累加 pkWins，进入排行榜 PK 榜
 */

interface Word {
  id: number
  part: string
  list: string
  word: string
  phonetic: string
  meaning: string
}

type Side = 'A' | 'B'

interface RoundAnswer {
  choice: number
  correct: boolean
  score: number
}

interface Player {
  socket: Socket | null
  username: string
  isBot: boolean
}

interface Room {
  id: string
  mode: 'human' | 'bot'
  players: Record<Side, Player>
  round: number
  totalRounds: number
  scores: Record<Side, number>
  answerIndex: number
  roundStartedAt: number
  roundDuration: number
  answers: Record<Side, RoundAnswer | null>
  roundTimer: NodeJS.Timeout | null
  gapTimer: NodeJS.Timeout | null
  botTimers: NodeJS.Timeout[]
}

const ROUND_DURATION = 12000
const GAP_MS = 2600
const TOTAL_ROUNDS = 10
const QUEUE_TIMEOUT = 30000
const BOT_ACCURACY = 0.78

let WORDS: Word[] = []

function loadWords(): Word[] {
  if (WORDS.length) return WORDS
  try {
    const p = path.resolve(__dirname, '..', '..', 'data', 'words.json')
    WORDS = JSON.parse(readFileSync(p, 'utf-8')) as Word[]
  } catch {
    WORDS = []
  }
  return WORDS
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

function pickWrong(answerIndex: number, n: number): number {
  let c = Math.floor(Math.random() * n)
  if (c === answerIndex) c = (c + 1) % n
  return c
}

/** 生成一道题：给出中文释义，4 个英文单词选项（含正确答案） */
function buildQuestion(): { meaning: string; phonetic: string; options: string[]; answerIndex: number } | null {
  const words = loadWords()
  if (words.length < 4) return null
  const target = words[Math.floor(Math.random() * words.length)]
  const pool = words.filter((w) => w.id !== target.id && w.word !== target.word)
  const samePart = pool.filter((w) => w.part === target.part)
  const from = samePart.length >= 3 ? samePart : pool
  const distractors: Word[] = []
  for (const w of shuffle(from)) {
    if (distractors.length >= 3) break
    if (!distractors.some((d) => d.word === w.word)) distractors.push(w)
  }
  const options = shuffle([target, ...distractors])
  const answerIndex = options.findIndex((o) => o.id === target.id)
  return { meaning: target.meaning, phonetic: target.phonetic, options: options.map((o) => o.word), answerIndex }
}

// 匹配队列与房间索引
const humanQueue: Socket[] = []
const queueTimers = new Map<Socket, NodeJS.Timeout>()
const socketRoom = new Map<string, Room>()

function other(side: Side): Side {
  return side === 'A' ? 'B' : 'A'
}

function cleanupTimers(room: Room): void {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer)
    room.roundTimer = null
  }
  if (room.gapTimer) {
    clearTimeout(room.gapTimer)
    room.gapTimer = null
  }
  for (const t of room.botTimers) clearTimeout(t)
  room.botTimers = []
}

function emitTo(room: Room, side: Side, event: string, payload: unknown): void {
  const p = room.players[side]
  if (p.socket) p.socket.emit(event, payload)
}

function applyAnswer(io: Server, room: Room, side: Side, choice: number): void {
  if (room.answers[side]) return
  let ans: RoundAnswer
  if (choice < 0) {
    ans = { choice: -1, correct: false, score: 0 }
  } else {
    const correct = choice === room.answerIndex
    let score = 0
    if (correct) {
      const remaining = Math.max(0, room.roundDuration - (Date.now() - room.roundStartedAt))
      score = 100 + Math.round((remaining / room.roundDuration) * 100)
    }
    ans = { choice, correct, score }
  }
  room.answers[side] = ans
  room.scores[side] += ans.score

  if (room.answers.A && room.answers.B) {
    if (room.roundTimer) {
      clearTimeout(room.roundTimer)
      room.roundTimer = null
    }
    for (const t of room.botTimers) clearTimeout(t)
    room.botTimers = []
    resolveRound(io, room)
  }
}

function scheduleBot(io: Server, room: Room): void {
  const delay = 2000 + Math.random() * 7000
  const correct = Math.random() < BOT_ACCURACY
  const choice = correct ? room.answerIndex : pickWrong(room.answerIndex, 4)
  const t = setTimeout(() => applyAnswer(io, room, 'B', choice), delay)
  room.botTimers.push(t)
}

function startRound(io: Server, room: Room): void {
  room.round += 1
  if (room.round > room.totalRounds) {
    endGame(room)
    return
  }
  const q = buildQuestion()
  if (!q) {
    endGame(room)
    return
  }
  room.answerIndex = q.answerIndex
  room.answers = { A: null, B: null }
  room.roundStartedAt = Date.now()

  for (const side of ['A', 'B'] as Side[]) {
    emitTo(room, side, 'pk:round', {
      round: room.round,
      total: room.totalRounds,
      meaning: q.meaning,
      phonetic: q.phonetic,
      options: q.options,
      duration: ROUND_DURATION,
    })
  }

  if (room.mode === 'bot') scheduleBot(io, room)
  room.roundTimer = setTimeout(() => resolveRound(io, room), ROUND_DURATION)
}

function resolveRound(io: Server, room: Room): void {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer)
    room.roundTimer = null
  }
  for (const t of room.botTimers) clearTimeout(t)
  room.botTimers = []

  for (const side of ['A', 'B'] as Side[]) {
    if (!room.answers[side]) applyAnswer(io, room, side, -1)
  }

  for (const side of ['A', 'B'] as Side[]) {
    const p = room.players[side]
    if (!p.socket) continue
    const me = room.answers[side]
    const opp = room.answers[other(side)]
    p.socket.emit('pk:roundEnd', {
      round: room.round,
      answerIndex: room.answerIndex,
      scores: { ...room.scores },
      you: { correct: me?.correct ?? false, score: me?.score ?? 0, choice: me?.choice ?? -1 },
      opponent: { correct: opp?.correct ?? false, score: opp?.score ?? 0 },
    })
  }

  room.gapTimer = setTimeout(() => startRound(io, room), GAP_MS)
}

function endGame(room: Room): void {
  cleanupTimers(room)
  const a = room.scores.A
  const b = room.scores.B
  const winner: Side | 'draw' = a === b ? 'draw' : a > b ? 'A' : 'B'

  if (room.mode === 'human' && winner !== 'draw') {
    const wp = room.players[winner]
    if (wp.socket && wp.username) recordPkWin(wp.username).catch(() => {})
  }

  for (const side of ['A', 'B'] as Side[]) {
    emitTo(room, side, 'pk:result', {
      winner: winner === 'draw' ? 'draw' : winner === side ? 'you' : 'opponent',
      scores: { ...room.scores },
      youAre: side,
    })
  }

  for (const side of ['A', 'B'] as Side[]) {
    const p = room.players[side]
    if (p.socket) socketRoom.delete(p.socket.id)
  }
}

function createRoom(io: Server, aSock: Socket, aName: string, bSock: Socket, bName: string): void {
  const room: Room = {
    id: Math.random().toString(36).slice(2, 10),
    mode: 'human',
    players: {
      A: { socket: aSock, username: aName, isBot: false },
      B: { socket: bSock, username: bName, isBot: false },
    },
    round: 0,
    totalRounds: TOTAL_ROUNDS,
    scores: { A: 0, B: 0 },
    answerIndex: -1,
    roundStartedAt: 0,
    roundDuration: ROUND_DURATION,
    answers: { A: null, B: null },
    roundTimer: null,
    gapTimer: null,
    botTimers: [],
  }
  socketRoom.set(aSock.id, room)
  socketRoom.set(bSock.id, room)
  aSock.emit('pk:matched', { roomId: room.id, mode: 'human', youAre: 'A', opponent: bName })
  bSock.emit('pk:matched', { roomId: room.id, mode: 'human', youAre: 'B', opponent: aName })
  startRound(io, room)
}

function createBotRoom(io: Server, aSock: Socket, aName: string): void {
  const room: Room = {
    id: Math.random().toString(36).slice(2, 10),
    mode: 'bot',
    players: {
      A: { socket: aSock, username: aName, isBot: false },
      B: { socket: null, username: '单词机器人', isBot: true },
    },
    round: 0,
    totalRounds: TOTAL_ROUNDS,
    scores: { A: 0, B: 0 },
    answerIndex: -1,
    roundStartedAt: 0,
    roundDuration: ROUND_DURATION,
    answers: { A: null, B: null },
    roundTimer: null,
    gapTimer: null,
    botTimers: [],
  }
  socketRoom.set(aSock.id, room)
  aSock.emit('pk:matched', { roomId: room.id, mode: 'bot', youAre: 'A', opponent: '单词机器人' })
  startRound(io, room)
}

function enqueue(io: Server, socket: Socket, username: string): void {
  while (humanQueue.length) {
    const opp = humanQueue.shift() as Socket
    const t = queueTimers.get(opp)
    if (t) {
      clearTimeout(t)
      queueTimers.delete(opp)
    }
    if (opp.connected && opp.id !== socket.id) {
      createRoom(io, socket, username, opp, opp.data.username as string)
      return
    }
  }
  humanQueue.push(socket)
  socket.emit('pk:queued', { position: humanQueue.length })
  const timer = setTimeout(() => {
    const idx = humanQueue.indexOf(socket)
    if (idx >= 0) {
      humanQueue.splice(idx, 1)
      socket.emit('pk:timeout')
    }
    queueTimers.delete(socket)
  }, QUEUE_TIMEOUT)
  queueTimers.set(socket, timer)
}

function dequeue(socket: Socket): void {
  const idx = humanQueue.indexOf(socket)
  if (idx >= 0) humanQueue.splice(idx, 1)
  const t = queueTimers.get(socket)
  if (t) {
    clearTimeout(t)
    queueTimers.delete(socket)
  }
}

function leaveRoom(socket: Socket): void {
  const room = socketRoom.get(socket.id)
  if (!room) return
  cleanupTimers(room)
  const side: Side = room.players.A.socket === socket ? 'A' : 'B'
  const opp = room.players[other(side)]
  if (opp.socket) opp.socket.emit('pk:opponentLeft')
  socketRoom.delete(socket.id)
  if (opp.socket) socketRoom.delete(opp.socket.id)
}

export function registerPk(io: Server): void {
  io.on('connection', async (socket: Socket) => {
    const token = (socket.handshake.auth && (socket.handshake.auth as Record<string, unknown>).token) as string | undefined
    const user = token ? await getUserByToken(token) : null
    if (!user) {
      socket.emit('pk:error', { message: '请先登录后再参与单词 PK' })
      return
    }
    const username = user.username
    socket.data.username = username

    socket.on('pk:queue', (data: { mode?: 'human' | 'bot' }) => {
      const mode = data && data.mode === 'bot' ? 'bot' : 'human'
      if (mode === 'bot') createBotRoom(io, socket, username)
      else enqueue(io, socket, username)
    })

    socket.on('pk:answer', (data: { round?: number; choice?: number }) => {
      const room = socketRoom.get(socket.id)
      if (!room) return
      const side: Side = room.players.A.socket === socket ? 'A' : 'B'
      if (typeof data?.round !== 'number' || data.round !== room.round) return
      if (typeof data.choice !== 'number') return
      applyAnswer(io, room, side, data.choice)
    })

    socket.on('pk:cancel', () => {
      dequeue(socket)
      socket.emit('pk:cancelled')
    })

    socket.on('disconnect', () => {
      dequeue(socket)
      leaveRoom(socket)
    })
  })
}
