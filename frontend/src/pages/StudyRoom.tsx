import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Circle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { usePresence } from '@/context/PresenceContext'
import { useStudy, type StudyMsg } from '@/hooks/use-study'

function readCount(key: string): number {
  try {
    const raw = localStorage.getItem(key)
    const arr = raw ? (JSON.parse(raw) as number[]) : []
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

function ProgressCard({ title, count, online }: { title: string; count: number; online: boolean }) {
  return (
    <div className="flex flex-1 flex-col rounded-2xl g-border g-panel p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground/70">{title}</span>
        <Circle className={'h-2 w-2 ' + (online ? 'fill-emerald-500 text-emerald-500' : 'fill-muted text-muted')} />
      </div>
      <span className="mt-1 text-2xl font-bold tabular-nums text-foreground">{count}</span>
      <span className="text-[10px] text-muted-foreground/60">已掌握单词</span>
    </div>
  )
}

export default function StudyRoomPage() {
  const { friend = '' } = useParams()
  const navigate = useNavigate()
  const { user, isAuthed } = useAuth()
  const { isOnline } = usePresence()
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const { joined, peer, peerOnline, messages, peerProgress, err, send, sendProgress } = useStudy(token, friend)
  const friendOnline = isOnline(friend)

  const [text, setText] = useState('')
  const [selfCount, setSelfCount] = useState(0)
  const [selfStarred, setSelfStarred] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // 读取本地进度并定期广播给好友
  useEffect(() => {
    const sync = () => {
      const known = readCount('liquid-words:known')
      const starred = readCount('liquid-words:starred')
      setSelfCount(known)
      setSelfStarred(starred)
      if (joined) sendProgress('progress', { known, starred })
    }
    sync()
    const id = setInterval(sync, 3000)
    return () => clearInterval(id)
  }, [joined, sendProgress])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  if (!isAuthed) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-10">
        <div className="liquid-glass rounded-3xl p-8 text-center">
          <p className="text-sm text-muted-foreground">登录后才能和好友一起学习</p>
          <button onClick={() => navigate('/login')} className="mt-4 rounded-xl bg-primary px-5 py-2 text-sm text-primary-foreground">去登录</button>
        </div>
      </div>
    )
  }

  const submit = () => {
    send(text)
    setText('')
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-2rem)] w-full max-w-2xl flex-col px-4 pt-6">
      <header className="mb-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted/40">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-foreground">和 <button onClick={() => navigate('/user/' + encodeURIComponent(friend))} className="hover:underline">{friend}</button> 一起学</h1>
          <p className="text-[11px] text-muted-foreground/70">
            {joined ? (peerOnline ? '对方在线，进度实时同步' : (friendOnline ? '对方在线，等待进入学习房…' : '对方当前不在线，可留言邀请')) : '正在进入学习房…'}
          </p>
        </div>
      </header>

      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}

      {/* 进度对比 */}
      <div className="flex gap-2">
        <ProgressCard title={`我（${user}）`} count={selfCount} online />
        <ProgressCard title={peer || friend} count={peerProgress?.payload?.known ?? 0} online={friendOnline} />
      </div>
      <p className="mt-1 px-1 text-[10px] text-muted-foreground/60">
        我收藏 {selfStarred} · 对方收藏 {peerProgress?.payload?.starred ?? 0}
      </p>

      {/* 聊天区 */}
      <div ref={listRef} className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-2xl g-border g-panel p-3">
        {messages.length === 0 && (
          <p className="pt-6 text-center text-xs text-muted-foreground/60">互相打个招呼，一起加油背单词吧～</p>
        )}
        {messages.map((m: StudyMsg) => {
          const mine = m.from === user
          return (
            <div key={m.id} className={'flex ' + (mine ? 'justify-end' : 'justify-start')}>
              <div className={'max-w-[80%] rounded-2xl px-3 py-1.5 text-[13px] leading-relaxed ' + (mine ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-foreground')}>
                {!mine && <div className="mb-0.5 text-[10px] text-muted-foreground/70">{m.from}</div>}
                <span className="whitespace-pre-wrap break-words">{m.text}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* 输入 */}
      <div className="mt-3 flex items-center gap-2 rounded-2xl g-border bg-transparent p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="给对方发消息…"
          className="flex-1 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none"
        />
        <button onClick={submit} disabled={!text.trim()} className="rounded-xl bg-primary p-2 text-primary-foreground disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
