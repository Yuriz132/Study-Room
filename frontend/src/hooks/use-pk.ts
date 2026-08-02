import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

export type PkPhase = 'idle' | 'queuing' | 'playing' | 'result' | 'error'

export interface PkQuestion {
  round: number
  total: number
  meaning: string
  phonetic: string
  options: string[]
  duration: number
}

export interface PkResult {
  winner: 'you' | 'opponent' | 'draw'
  scores: { A: number; B: number }
  youAre: 'A' | 'B'
}

interface RoundEnd {
  answerIndex: number
  scores: { A: number; B: number }
  you: { correct: boolean; score: number; choice: number }
  opponent: { correct: boolean; score: number }
}

interface Reveal {
  answerIndex: number
  youCorrect: boolean
  youScore: number
  oppCorrect: boolean
  oppScore: number
}

export function usePk(token: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const [phase, setPhase] = useState<PkPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [opponent, setOpponent] = useState<string>('')
  const [youAre, setYouAre] = useState<'A' | 'B'>('A')
  const [question, setQuestion] = useState<PkQuestion | null>(null)
  const [answered, setAnswered] = useState(false)
  const [myChoice, setMyChoice] = useState<number | null>(null)
  const [scores, setScores] = useState<{ A: number; B: number }>({ A: 0, B: 0 })
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const [result, setResult] = useState<PkResult | null>(null)
  const [queuePos, setQueuePos] = useState(0)

  useEffect(() => {
    if (!token) return
    const socketPath = window.location.pathname.startsWith('/vs') ? '/vs/socket.io' : '/socket.io'
    const socket: Socket = io({
      path: socketPath,
      auth: { token },
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('pk:queued', (d: { position: number }) => {
      setPhase('queuing')
      setQueuePos(d.position)
    })
    socket.on('pk:matched', (d: { mode: string; youAre: 'A' | 'B'; opponent: string }) => {
      setOpponent(d.opponent)
      setYouAre(d.youAre)
      setPhase('playing')
      setReveal(null)
      setResult(null)
      setScores({ A: 0, B: 0 })
    })
    socket.on('pk:round', (q: PkQuestion) => {
      setQuestion(q)
      setAnswered(false)
      setMyChoice(null)
      setReveal(null)
    })
    socket.on('pk:roundEnd', (d: RoundEnd) => {
      setScores(d.scores)
      setReveal({
        answerIndex: d.answerIndex,
        youCorrect: d.you.correct,
        youScore: d.you.score,
        oppCorrect: d.opponent.correct,
        oppScore: d.opponent.score,
      })
    })
    socket.on('pk:result', (r: PkResult) => {
      setResult(r)
      setPhase('result')
    })
    socket.on('pk:timeout', () => {
      setError('未匹配到对手，稍后再试～')
      setPhase('idle')
    })
    socket.on('pk:opponentLeft', () => {
      setError('对手已离开，对战结束')
      setResult({ winner: 'you', scores, youAre })
      setPhase('result')
    })
    socket.on('pk:error', (d: { message: string }) => {
      setError(d.message)
      setPhase('error')
    })
    socket.on('pk:cancelled', () => {
      setPhase('idle')
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token])

  const queue = useCallback((mode: 'human' | 'bot') => {
    setError(null)
    setResult(null)
    setPhase('queuing')
    socketRef.current?.emit('pk:queue', { mode })
  }, [])

  const answer = useCallback(
    (round: number, choice: number) => {
      if (answered) return
      setAnswered(true)
      setMyChoice(choice)
      socketRef.current?.emit('pk:answer', { round, choice })
    },
    [answered]
  )

  const cancel = useCallback(() => {
    socketRef.current?.emit('pk:cancel')
    setPhase('idle')
  }, [])

  const reset = useCallback(() => {
    setPhase('idle')
    setResult(null)
    setError(null)
    setQuestion(null)
    setReveal(null)
    setMyChoice(null)
    setScores({ A: 0, B: 0 })
  }, [])

  return {
    phase,
    error,
    opponent,
    youAre,
    question,
    answered,
    myChoice,
    scores,
    reveal,
    result,
    queuePos,
    queue,
    answer,
    cancel,
    reset,
  }
}
