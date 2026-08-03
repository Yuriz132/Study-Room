import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Swords, Bot, Users, Trophy, RotateCcw, ArrowLeft, Check, X, Crown, Loader2 } from 'lucide-react'
import { usePk } from '@/hooks/use-pk'
import { useAuth } from '@/context/AuthContext'

const LETTERS = ['A', 'B', 'C', 'D']

export default function Battle() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [token] = useState<string | null>(() => localStorage.getItem('auth_token'))
  const pk = usePk(token)

  const params = new URLSearchParams(window.location.search)
  const invited = params.get('invited')   // 我是发起方：等待对方接受
  const invite = params.get('invite')     // 我是受邀方：接受即开战

  useEffect(() => {
    if (invite) pk.acceptInvite(invite)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite])

  const [remaining, setRemaining] = useState(0)
  const startRef = useRef(0)

  // 本地倒计时（仅用于进度条展示，计分以服务器为准）
  useEffect(() => {
    if (pk.phase !== 'playing' || !pk.question || pk.reveal) {
      setRemaining(0)
      return
    }
    startRef.current = Date.now()
    setRemaining(pk.question.duration)
    const id = setInterval(() => {
      const left = Math.max(0, pk.question!.duration - (Date.now() - startRef.current))
      setRemaining(left)
      if (left <= 0) clearInterval(id)
    }, 100)
    return () => clearInterval(id)
  }, [pk.phase, pk.question, pk.reveal])

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-10">
        <div className="liquid-glass rounded-3xl p-8 text-center">
          <Swords className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h1 className="text-xl font-bold text-foreground">单词 PK 实时对战</h1>
          <p className="mt-2 text-sm text-muted-foreground">登录后即可与在线对手或单词机器人实时比拼，比谁背得又快又准。</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-5 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all active:scale-95"
          >
            去登录
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-4 flex items-center gap-2">
        <Swords className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">单词 PK</h1>
        <span className="ml-auto text-xs text-muted-foreground">{user ? `玩家：${user}` : ''}</span>
      </header>

      {pk.phase === 'idle' && !invited && !invite && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground/80">选择模式，开始一场 10 回合的单词对决（看释义选单词，又快又准得分更高）。</p>
          <button
            onClick={() => pk.queue('human')}
            className="flex w-full items-center gap-4 rounded-2xl border g-border g-panel p-4 text-left transition-all active:scale-[0.99] hover:border-primary/40"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">实时匹配（真人对战）</div>
              <div className="mt-0.1 text-xs text-muted-foreground">与在线对手实时对战，获胜可登上 PK 榜</div>
            </div>
          </button>
          <button
            onClick={() => pk.queue('bot')}
            className="flex w-full items-center gap-4 rounded-2xl border g-border g-panel p-4 text-left transition-all active:scale-[0.99] hover:border-primary/40"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">人机对战（单词机器人）</div>
              <div className="mt-0.1 text-xs text-muted-foreground">随时开战，机器人约 78% 正确率</div>
            </div>
          </button>
        </div>
      )}

      {invited && pk.phase !== 'playing' && pk.phase !== 'result' && (
        <div className="liquid-glass rounded-3xl p-10 text-center">
          <Loader2 className="mx-auto mb-4 h-9 w-9 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">已邀请 {invited}，等待对方接受…</p>
          <p className="mt-1 text-xs text-muted-foreground">对方同意后即可开始对战</p>
          {pk.error && <p className="mt-3 text-xs text-rose-400">{pk.error}</p>}
          <button
            onClick={() => { pk.cancel(); navigate(-1) }}
            className="mt-5 rounded-xl border g-border g-panel px-5 py-2 text-sm text-foreground transition-all active:scale-95"
          >
            取消
          </button>
        </div>
      )}

      {pk.phase === 'queuing' && (
        <div className="liquid-glass rounded-3xl p-10 text-center">
          <Loader2 className="mx-auto mb-4 h-9 w-9 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">匹配中…{pk.queuePos > 1 ? ` 你是第 ${pk.queuePos} 位` : ''}</p>
          <p className="mt-1 text-xs text-muted-foreground">正在为你寻找对手</p>
          <button
            onClick={pk.cancel}
            className="mt-5 rounded-xl border g-border g-panel px-5 py-2 text-sm text-foreground transition-all active:scale-95"
          >
            取消匹配
          </button>
        </div>
      )}

      {pk.phase === 'playing' && pk.question && (
        <div className="space-y-3">
          {/* 计分板 */}
          <div className="liquid-glass flex items-center justify-between rounded-2xl px-4 py-3">
            <div className="text-left">
              <div className="text-[10px] text-muted-foreground">你</div>
              <div className="font-mono text-lg font-bold text-primary">{pk.scores[pk.youAre]}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">
                第 {pk.question.round} / {pk.question.total} 回合
              </div>
              <div className="text-xs text-foreground">{pk.opponent}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">对手</div>
              <div className="font-mono text-lg font-bold text-rose-400">{pk.scores[pk.youAre === 'A' ? 'B' : 'A']}</div>
            </div>
          </div>

          {/* 倒计时条 */}
          <div className="h-1.5 w-full overflow-hidden rounded-full g-panel">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-100 ease-linear"
              style={{ width: `${pk.question.duration ? (remaining / pk.question.duration) * 100 : 0}%` }}
            />
          </div>

          {/* 题目 */}
          <div className="liquid-glass rounded-2xl p-5 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">选出正确的单词</div>
            <div className="mt-2 text-lg font-medium leading-snug text-foreground">{pk.question.meaning}</div>
          </div>

          {/* 选项 */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {pk.question.options.map((opt, i) => {
              const isCorrect = pk.reveal?.answerIndex === i
              const isMyPick = pk.myChoice === i
              let cls = 'g-border g-panel hover:border-primary/40 text-foreground'
              if (pk.reveal) {
                if (isCorrect) cls = 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                else if (isMyPick) cls = 'border-rose-500/50 bg-rose-500/15 text-rose-300'
              } else if (pk.answered) {
                cls = 'border-primary/50 bg-primary/15 text-primary'
              }
              return (
                <button
                  key={i}
                  disabled={pk.answered || !!pk.reveal}
                  onClick={() => pk.answer(pk.question!.round, i)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all active:scale-[0.98] disabled:cursor-default ${cls}`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md g-panel text-xs font-bold">
                    {LETTERS[i]}
                  </span>
                  <span className="flex-1 truncate">{opt}</span>
                  {pk.reveal && isCorrect && <Check className="h-4 w-4 text-emerald-400" />}
                  {pk.reveal && isMyPick && !isCorrect && <X className="h-4 w-4 text-rose-400" />}
                </button>
              )
            })}
          </div>

          {/* 回合结算提示 */}
          {pk.reveal && (
            <div className="liquid-glass rounded-2xl p-4 text-center text-sm">
              <div className={pk.reveal.youCorrect ? 'font-semibold text-emerald-400' : 'font-semibold text-rose-400'}>
                {pk.reveal.youCorrect ? `答对了 +${pk.reveal.youScore} 分` : '答错了 / 超时'}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                对手{pk.reveal.oppCorrect ? `答对 +${pk.reveal.oppScore} 分` : '未答对'} · 下一题即将开始…
              </div>
            </div>
          )}
        </div>
      )}

      {pk.phase === 'result' && (
        <div className="liquid-glass rounded-3xl p-8 text-center">
          {pk.result?.winner === 'you' && <Crown className="mx-auto mb-3 h-10 w-10 text-yellow-400" />}
          {pk.result?.winner === 'opponent' && <Trophy className="mx-auto mb-3 h-10 w-10 text-zinc-300" />}
          {pk.result?.winner === 'draw' && <Trophy className="mx-auto mb-3 h-10 w-10 text-amber-500" />}
          <h2 className="text-2xl font-bold text-foreground">
            {pk.result?.winner === 'you' ? '你赢了！' : pk.result?.winner === 'opponent' ? '惜败' : '平局'}
          </h2>
          <div className="mt-4 flex items-center justify-center gap-6">
            <div>
              <div className="text-[10px] text-muted-foreground">你</div>
              <div className="font-mono text-2xl font-bold text-primary">{pk.result?.scores[pk.youAre] ?? pk.scores[pk.youAre]}</div>
            </div>
            <span className="text-muted-foreground">VS</span>
            <div>
              <div className="text-[10px] text-muted-foreground">{pk.opponent}</div>
              <div className="font-mono text-2xl font-bold text-rose-400">
                {pk.result?.scores[pk.youAre === 'A' ? 'B' : 'A'] ?? pk.scores[pk.youAre === 'A' ? 'B' : 'A']}
              </div>
            </div>
          </div>
          {pk.error && <p className="mt-3 text-xs text-rose-400">{pk.error}</p>}
          <div className="mt-6 flex gap-2">
            <button
              onClick={pk.reset}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all active:scale-95"
            >
              <RotateCcw className="h-4 w-4" /> 再来一局
            </button>
            <button
              onClick={() => navigate('/community')}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border g-border g-panel px-4 py-2.5 text-sm text-foreground transition-all active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" /> 返回社区
            </button>
          </div>
        </div>
      )}

      {pk.phase === 'error' && (
        <div className="liquid-glass rounded-3xl p-8 text-center">
          <X className="mx-auto mb-3 h-9 w-9 text-rose-400" />
          <p className="text-sm text-foreground">{pk.error}</p>
          <button
            onClick={pk.reset}
            className="mt-5 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all active:scale-95"
          >
            返回
          </button>
        </div>
      )}
    </div>
  )
}
