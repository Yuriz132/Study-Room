import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, UserPlus, Check, X, Swords, BookOpen, Star, Trophy, MessageSquare, Pencil, Loader2, UserMinus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  apiGetUser, apiFriendStatus, apiFriendRequest, apiFriendAccept, apiFriendReject, apiFriendRemove,
  apiUpdateSignature, apiSendDmInvite,
  type PublicUser, type FriendStatus,
} from '@/lib/authApi'
import apiClient from '@/lib/api-client'
import { getErrorMessage } from '@/lib/api-client'

interface ForumPostLite {
  _id: string
  title: string
  category: string
  createdAt: number
  likes: number
  commentCount: number
}

function Avatar({ name, avatar, size = 72 }: { name: string; avatar?: string | null; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {avatar ? <img src={avatar} className="h-full w-full object-cover" alt="" /> : (name || '?')[0]}
    </span>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: number }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-2xl g-border g-panel py-3">
      <Icon className="mb-1 h-4 w-4 text-primary/70" />
      <span className="text-base font-bold text-foreground tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground/70">{label}</span>
    </div>
  )
}

export default function UserPage() {
  const { username = '' } = useParams()
  const navigate = useNavigate()
  const { user, isAuthed } = useAuth()
  const isSelf = !!user && user === username

  const [profile, setProfile] = useState<PublicUser | null>(null)
  const [status, setStatus] = useState<FriendStatus>('none')
  const [posts, setPosts] = useState<ForumPostLite[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // 签名编辑
  const [editing, setEditing] = useState(false)
  const [sigDraft, setSigDraft] = useState('')
  const [sigSaving, setSigSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const p = await apiGetUser(username)
      setProfile(p)
      setNotFound(false)
      const { data } = await apiClient.get<ForumPostLite[]>('/forum/posts?author=' + encodeURIComponent(username))
      setPosts(data || [])
    } catch (e: any) {
      if (e?.response?.status === 404) setNotFound(true)
      else setErr(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => {
    load()
    if (isAuthed && !isSelf) {
      apiFriendStatus(username).then((r) => setStatus(r.status)).catch(() => {})
    } else if (isSelf) {
      setStatus('self')
    } else {
      setStatus('none')
    }
  }, [username, isAuthed, isSelf, load])

  const doRequest = async () => {
    setBusy(true)
    try {
      await apiFriendRequest(username)
      setStatus('outgoing')
    } catch (e) { setErr(getErrorMessage(e)) }
    setBusy(false)
  }
  const doAccept = async () => {
    setBusy(true)
    try {
      await apiFriendAccept(username)
      setStatus('friend')
    } catch (e) { setErr(getErrorMessage(e)) }
    setBusy(false)
  }
  const doReject = async () => {
    setBusy(true)
    try {
      await apiFriendReject(username)
      setStatus('none')
    } catch (e) { setErr(getErrorMessage(e)) }
    setBusy(false)
  }
  const doRemove = async () => {
    setBusy(true)
    try {
      await apiFriendRemove(username)
      setStatus('none')
    } catch (e) { setErr(getErrorMessage(e)) }
    setBusy(false)
  }

  // 好友邀请改为「私信送达」：给对方发一条私信邀请，对方在私信里点击即可加入
  const invitePk = () => {
    void apiSendDmInvite(username, 'pk')
    navigate('/pk?invited=' + encodeURIComponent(username))
  }
  const studyTogether = () => {
    void apiSendDmInvite(username, 'study')
    navigate('/study/' + encodeURIComponent(username))
  }

  const saveSig = async () => {
    setSigSaving(true)
    try {
      const { signature } = await apiUpdateSignature(sigDraft)
      if (profile) setProfile({ ...profile, signature: signature ?? null })
      setEditing(false)
    } catch (e) { setErr(getErrorMessage(e)) }
    setSigSaving(false)
  }

  if (notFound) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-10">
        <div className="liquid-glass rounded-3xl p-8 text-center">
          <p className="text-sm text-muted-foreground">用户「{username}」不存在</p>
          <button onClick={() => navigate(-1)} className="mt-4 rounded-xl bg-primary px-5 py-2 text-sm text-primary-foreground">返回</button>
        </div>
      </div>
    )
  }

  if (loading || !profile) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-10 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted/40">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground">用户主页</h1>
      </header>

      <div className="liquid-glass rounded-3xl p-5">
        <div className="flex items-center gap-4">
          <Avatar name={profile.username} avatar={profile.avatar} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-lg font-bold text-foreground">{profile.username}</span>
              {profile.avatarBanned && <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">头像已封禁</span>}
            </div>
            {profile.signature ? (
              <p className="mt-1 break-words text-[13px] leading-relaxed text-foreground/70">{profile.signature}</p>
            ) : (
              <p className="mt-1 text-[13px] text-muted-foreground/50">{isSelf ? '还没有个性签名，点下方编辑' : '这个人很神秘，什么也没留下'}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Stat icon={BookOpen} label="已掌握" value={profile.stats.known} />
          <Stat icon={Star} label="收藏" value={profile.stats.starred} />
          <Stat icon={Trophy} label="PK胜" value={profile.pkWins} />
          <Stat icon={MessageSquare} label="发帖" value={profile.stats.posts} />
        </div>

        {/* 操作区 */}
        <div className="mt-4 flex flex-wrap gap-2">
          {isSelf ? (
            <button
              onClick={() => { setSigDraft(profile.signature ?? ''); setEditing(true) }}
              className="inline-flex items-center gap-1.5 rounded-xl g-border g-panel px-3.5 py-2 text-sm text-foreground transition active:scale-95"
            >
              <Pencil className="h-4 w-4" /> 编辑签名
            </button>
          ) : status === 'none' && (
            <button onClick={doRequest} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition active:scale-95 disabled:opacity-60">
              <UserPlus className="h-4 w-4" /> {busy ? '发送中…' : '加好友'}
            </button>
          )}
          {status === 'outgoing' && (
            <span className="inline-flex items-center gap-1.5 rounded-xl g-border g-panel px-3.5 py-2 text-sm text-muted-foreground">等待对方确认…</span>
          )}
          {status === 'incoming' && (
            <>
              <button onClick={doAccept} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition active:scale-95 disabled:opacity-60">
                <Check className="h-4 w-4" /> 接受
              </button>
              <button onClick={doReject} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl g-border g-panel px-3.5 py-2 text-sm text-muted-foreground transition active:scale-95 disabled:opacity-60">
                <X className="h-4 w-4" /> 拒绝
              </button>
            </>
          )}
          {status === 'friend' && (
            <>
              <button onClick={studyTogether} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition active:scale-95">
                <BookOpen className="h-4 w-4" /> 一起学
              </button>
              <button onClick={invitePk} className="inline-flex items-center gap-1.5 rounded-xl g-border g-panel px-3.5 py-2 text-sm text-foreground transition active:scale-95">
                <Swords className="h-4 w-4" /> 邀TA PK
              </button>
              <button onClick={doRemove} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl g-border g-panel px-3.5 py-2 text-sm text-destructive transition active:scale-95 disabled:opacity-60">
                <UserMinus className="h-4 w-4" /> 移除好友
              </button>
            </>
          )}
        </div>
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      </div>

      {/* 动态 */}
      <h2 className="mb-2 mt-6 px-1 text-sm font-semibold text-foreground">TA 的动态</h2>
      {posts.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground/60">还没有发布过帖子</p>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <button
              key={p._id}
              onClick={() => navigate('/community')}
              className="flex w-full items-center gap-3 rounded-2xl g-border g-panel p-3 text-left transition active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{p.title || '（无标题）'}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/60">{p.likes} 赞 · {p.commentCount} 评论</p>
              </div>
              <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground/40" />
            </button>
          ))}
        </div>
      )}

      {/* 签名编辑弹窗 */}
      {editing && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4" onClick={() => setEditing(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-semibold text-foreground">编辑个性签名</h3>
            <textarea
              value={sigDraft}
              maxLength={80}
              onChange={(e) => setSigDraft(e.target.value)}
              rows={3}
              placeholder="一句话介绍自己（≤80 字）"
              className="w-full resize-none rounded-xl g-border bg-transparent p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="mt-1 text-right text-[11px] text-muted-foreground/60">{sigDraft.length}/80</div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 rounded-xl g-border g-panel py-2.5 text-sm text-muted-foreground">取消</button>
              <button onClick={saveSig} disabled={sigSaving} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
                {sigSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
