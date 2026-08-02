import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, TrendingUp, Calendar, Crown, Medal, Swords, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { API_BASE } from '@/lib/api-client'

interface Entry {
  username: string
  knownCount: number
  todayReviewed: number
  weekReviewed: number
  totalReviewed: number
  pkWins: number
  lastActive: number
}

interface Board {
  totalWords: number
  today: Entry[]
  week: Entry[]
  allTime: Entry[]
  pk: Entry[]
}

type Tab = 'today' | 'week' | 'allTime' | 'pk'

const TOP_N = 5

export function Leaderboard() {
  const { user: me, isAuthed } = useAuth()
  const [data, setData] = useState<Board | null>(null)
  const [tab, setTab] = useState<Tab>('allTime')
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/leaderboard`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false))
    const i = setInterval(() => {
      fetch(`${API_BASE}/leaderboard`).then((r) => r.json()).then((d) => setData(d)).catch(() => {})
    }, 60_000)
    return () => clearInterval(i)
  }, [])

  if (loading) return <div className="liquid-glass rounded-2xl p-6 text-center text-sm text-muted-foreground">加载排行榜…</div>
  if (!data) return <div className="liquid-glass rounded-2xl p-6 text-center text-sm text-muted-foreground">暂无数据</div>

  const tabs: { key: Tab; label: string; icon: any; sub: (e: Entry) => number; unit: string }[] = [
    { key: 'today', label: '今日', icon: Calendar, sub: (e) => e.todayReviewed, unit: '词' },
    { key: 'week', label: '本周', icon: TrendingUp, sub: (e) => e.weekReviewed, unit: '词' },
    { key: 'allTime', label: '全部', icon: Trophy, sub: (e) => e.knownCount, unit: '词' },
    { key: 'pk', label: 'PK', icon: Swords, sub: (e) => e.pkWins, unit: '胜' },
  ]
  const fullList = tab === 'today' ? data.today : tab === 'week' ? data.week : tab === 'pk' ? data.pk : data.allTime
  const t = tabs.find((x) => x.key === tab)!

  // 显示规则：未登录 → 第 1 名 + 「登录后查看完整排行榜」
  //         登录 + 折叠 → 前 5 名
  //         登录 + 展开 → 前 15 名
  const visibleCount = isAuthed ? (expanded ? 15 : TOP_N) : 1
  const visibleList = fullList.slice(0, visibleCount)

  // 找当前用户在完整榜单中的位置
  const myIdx = isAuthed && me ? fullList.findIndex(e => e.username === me) : -1
  const myEntry = myIdx >= 0 ? fullList[myIdx] : null
  // 当前用户不在 visibleList 内时，额外展示底部我的排名
  const showMyRank = isAuthed && myEntry && myIdx >= visibleCount

  return (
    <div className="liquid-glass rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <Trophy className="h-4 w-4 text-primary" />
        学习进度排行榜
        <span className="ml-auto text-[10px] font-normal text-muted-foreground">共 {data.totalWords} 词</span>
      </div>

      <div className="mb-3 flex gap-1 rounded-full g-panel p-1 text-xs">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setExpanded(false) }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 py-1.5 transition-all',
              tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
          </button>
        ))}
      </div>

      {fullList.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground/70">暂无排名</p>
      ) : (
        <>
          {!isAuthed && fullList.length > 1 && (
            <Link
              to="/login"
              className="mb-2 flex items-center justify-center rounded-xl g-panel px-4 py-2.5 text-sm text-muted-foreground"
            >
              登录后查看完整排行榜
            </Link>
          )}
          <ol className="space-y-1.5">
            {visibleList.map((e, i) => {
              const isMe = me === e.username
              const rank = i + 1
              const TopIcon = rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Medal : null
              const color = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-zinc-300' : rank === 3 ? 'text-amber-600' : 'text-muted-foreground'
              return (
                <li
                  key={e.username}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
                    isMe ? 'bg-primary/15 ring-1 ring-primary/30' : 'g-panel'
                  )}
                >
                  <span className={cn('w-6 shrink-0 text-center text-xs font-bold tabular-nums', color)}>
                    {TopIcon ? <TopIcon className={cn('mx-auto h-4 w-4', color)} /> : rank}
                  </span>
                  <span className={cn('flex-1 truncate', isMe ? 'text-primary font-semibold' : 'text-foreground')}>
                    {e.username}{isMe && '（我）'}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {t.sub(e)} <span className="text-[10px] opacity-70">{t.unit}</span>
                  </span>
                </li>
              )
            })}
          </ol>

          {/* 展开/收起（仅登录后可展开） */}
          {isAuthed && fullList.length > TOP_N && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border g-border g-panel py-2 text-xs text-muted-foreground transition-all active:scale-[0.99] hover:g-panel"
            >
              {expanded ? <>收起 <ChevronUp className="h-3.5 w-3.5" /></> : <>展开剩余 {Math.min(fullList.length, 15) - TOP_N} 名 <ChevronDown className="h-3.5 w-3.5" /></>}
            </button>
          )}

          {/* 我的排名：未在前 5（未展开时）/ 前 15（展开时）内 */}
          {showMyRank && myEntry && (
            <div className="mt-2 rounded-xl border border-primary/30 bg-primary/5 p-2">
              <div className="mb-1 text-[10px] font-medium text-muted-foreground">我的排名</div>
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-2 py-1.5 text-sm ring-1 ring-primary/30">
                <span className="w-6 shrink-0 text-center text-xs font-bold tabular-nums text-primary">#{myIdx + 1}</span>
                <span className="flex-1 truncate font-semibold text-primary">{me}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {t.sub(myEntry)} <span className="text-[10px] opacity-70">{t.unit}</span>
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}