import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useDm, type DmMessage } from '@/hooks/use-dm'
import { usePresence } from '@/context/PresenceContext'
import { ChatDisclaimer } from '@/components/ChatDisclaimer'

export default function Dm() {
  const { username = '' } = useParams()
  const navigate = useNavigate()
  const { user, isAuthed } = useAuth()
  const { messages, joined, error, send } = useDm(username)
  const { isOnline } = usePresence()
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!text.trim() || !joined) return
    send(text)
    setText('')
  }

  const fmtTime = (ts: number) => {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  if (!isAuthed) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-10">
        <div className="liquid-glass rounded-3xl p-8 text-center">
          <h1 className="text-xl font-bold text-foreground">私信</h1>
          <p className="mt-2 text-sm text-muted-foreground">登录后才能与好友私信聊天。</p>
          <button onClick={() => navigate('/login')} className="mt-5 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">去登录</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 11rem)' }}>
      {/* 顶栏 */}
      <div className="mb-3 flex items-center gap-2 rounded-2xl border g-border g-panel px-4 py-2.5">
        <button onClick={() => navigate('/friends')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:g-panel hover:text-foreground active:scale-90" aria-label="返回">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button onClick={() => navigate('/user/' + encodeURIComponent(username))} className="text-sm font-semibold text-foreground hover:underline">💬 {username}</button>
        <div className="ml-auto flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1">
          <span className={cn('h-2 w-2 rounded-full', isOnline(username) ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-gray-400')} />
          <span className="text-[11px] tabular-nums text-muted-foreground">{isOnline(username) ? '在线' : '离线'}</span>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border g-border bg-black/[0.02] dark:bg-white/[0.02] p-3 mb-3 space-y-3">
        <ChatDisclaimer />
        {!joined && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            {error ? (
              <>
                <p className="px-4 text-center text-sm text-destructive">{error}</p>
                <button onClick={() => navigate('/friends')} className="mt-2 rounded-xl g-border g-panel px-4 py-1.5 text-xs text-muted-foreground">返回好友</button>
              </>
            ) : (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
                <p className="text-xs text-muted-foreground/60">正在连接私信…</p>
              </>
            )}
          </div>
        )}
        {joined && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <p className="text-sm text-muted-foreground/50">还没有消息，和 {username} 打个招呼吧 👋</p>
          </div>
        )}
        {messages.map((msg: DmMessage) =>
          msg.type === 'system' ? (
            <div key={msg.id} className="flex justify-center my-1">
              <span className="whitespace-pre-line rounded-2xl bg-muted/40 px-3 py-2 text-center text-[11px] leading-relaxed text-muted-foreground/70">{msg.text}</span>
            </div>
          ) : msg.type === 'invite' ? (
            <div key={msg.id} className={cn('flex', msg.from === user ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed', msg.from === user ? 'bg-primary/10 text-foreground rounded-br-sm' : 'bg-muted/40 text-foreground rounded-bl-sm')}>
                <p className="break-words whitespace-pre-wrap">{msg.from === user ? `你邀请 ${msg.to} 一起${msg.action === 'pk' ? '单词PK' : '学习'}` : `${msg.from} 邀请你一起${msg.action === 'pk' ? '单词PK' : '学习'}`}</p>
                {msg.from !== user && (
                  <button
                    onClick={() => navigate(msg.action === 'pk' ? `/pk?invite=${encodeURIComponent(msg.from)}` : `/study/${encodeURIComponent(msg.from)}`)}
                    className="mt-2 w-full rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  >
                    {msg.action === 'pk' ? '接受 PK' : '一起学'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div key={msg.id} className={cn('flex', msg.from === user ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[78%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed', msg.from === user ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted/30 dark:bg-muted/20 text-foreground/85 rounded-bl-sm')}>
                <p className="break-words whitespace-pre-wrap">{msg.text}</p>
                <div className={cn('mt-0.5 text-[10px]', msg.from === user ? 'text-right text-primary-foreground/70' : 'text-muted-foreground/45')}>{fmtTime(msg.timestamp)}</div>
              </div>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* 输入 */}
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            maxLength={500}
            placeholder={joined ? '发私信…' : '连接中…'}
            disabled={!joined}
            className="w-full rounded-2xl border g-border bg-muted/20 dark:bg-muted/10 px-4 py-2.5 pr-12 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 transition focus:border-primary/40 disabled:opacity-50"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/35 tabular-nums">{text.length}/500</span>
        </div>
        <button onClick={handleSend} disabled={!joined || !text.trim()} className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-90', joined && text.trim() ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'cursor-not-allowed bg-muted/20 text-muted-foreground/30')}>
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
