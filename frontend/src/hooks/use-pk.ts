import { useCallback, useEffect, useRef, useState } from 'react'
import { getPkSocket, onPk, emitPk } from '@/lib/pkSocket'

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

  const scoresRef = useRef(scores)
  useEffect(() => { scoresRef.current = scores }, [scores])

  useEffect(() => {
    if (!token) return
    const sock = getPkSocket(token)
    if (!sock) return
    const offs = [
      onPk('pk:queued', (d: { position: number }) => { setPhase('queuing'); setQueuePos(d.position) }),
      onPk('pk:matched', (d: { mode: string; youAre: 'A' | 'B'; opponent: string }) => {
        setOpponent(d.opponent); setYouAre(d.youAre); setPhase('playing')
        setReveal(null); setResult(null); setScores({ A: 0, B: 0 })
      }),
      onPk('pk:round', (q: PkQuestion) => {
        setQuestion(q); setAnswered(false); setMyChoice(null); setReveal(null)
      }),
      onPk('pk:roundEnd', (d: RoundEnd) => {
        setScores(d.scores)
        setReveal({
          answerIndex: d.answerIndex,
          youCorrect: d.you.correct, youScore: d.you.score,
          oppCorrect: d.opponent.correct, oppScore: d.opponent.score,
        })
      }),
      onPk('pk:result', (r: PkResult) => { setResult(r); setPhase('result') }),
      onPk('pk:timeout', () => { setError('未匹配到对手，稍后再试～'); setPhase('idle') }),
      onPk('pk:opponentLeft', () => {
        setError('对手已离开，对战结束')
        setResult({ winner: 'you', scores: scoresRef.current, youAre })
        setPhase('result')
      }),
      onPk('pk:error', (d: { message: string }) => { setError(d.message); setPhase('error') }),
      onPk('pk:cancelled', () => setPhase('idle')),
      onPk('pk:inviteFailed', (d: { message?: string }) => setError(d.message || '邀请失败，请稍后再试')),
      onPk('pk:inviteDeclined', () => { setError('对方拒绝了你的邀请'); setPhase('idle') }),
    ]
    return () => offs.forEach((off) => off())
  }, [token, youAre])

  const queue = useCallback((mode: 'human' | 'bot') => {
    setError(null); setResult(null); setPhase('queuing')
    emitPk('pk:queue', { mode })
  }, [])

  const answer = useCallback((round: number, choice: number) => {
    if (answered) return
    setAnswered(true); setMyChoice(choice)
    emitPk('pk:answer', { round, choice })
  }, [answered])

  const cancel = useCallback(() => { emitPk('pk:cancel'); setPhase('idle') }, [])

  const reset = useCallback(() => {
    setPhase('idle'); setResult(null); setError(null)
    setQuestion(null); setReveal(null); setMyChoice(null); setScores({ A: 0, B: 0 })
  }, [])

  const invite = useCallback((targetUsername: string) => {
    emitPk('pk:invite', { targetUsername, mode: 'human' })
  }, [])

  const acceptInvite = useCallback((fromUsername: string) => {
    emitPk('pk:acceptInvite', { fromUsername })
  }, [])

  const declineInvite = useCallback((fromUsername: string) => {
    emitPk('pk:declineInvite', { fromUsername })
  }, [])

  return {
    phase, error, opponent, youAre, question, answered, myChoice,
    scores, reveal, result, queuePos,
    queue, answer, cancel, reset, invite, acceptInvite, declineInvite,
  }
}
