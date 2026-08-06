import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Check, X, Swords, BookOpen, Search, Loader2, UserMinus, Users, Megaphone } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useFriendIndicators } from '@/context/FriendIndicatorContext'
import { usePresence } from '@/context/PresenceContext'
import { cn } from '@/lib/utils'
import {
  apiGetFriends, apiFriendRequest, apiFriendAccept, apiFriendReject, apiFriendRemove,
  apiGetUser, apiSendDmInvite, type FriendRelations, type PublicUser,
} from '@/lib/authApi'
import { getErrorMessage } from '@/lib/api-client'
import {
  apiListGroups, apiCreateGroup, type GroupSummary, type MyGroupView,
} from '@/lib/group'

function LetterAvatar({ name, size = 40, onClick }: { name: string; size?: number; onClick?: () => void }) {
  return (
    <span
      className={"inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary" + (onClick ? " cursor-pointer" : "")}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      onClick={onClick}
    >
      {name ? name[0] : '?'}
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-5 px-1 text-sm font-semibold text-foreground">{children}</h2>
}

export default function FriendsPage() {
  const navigate = useNavigate()
  const { user, isAuthed } = useAuth()
  const { unreadByFriend } = useFriendIndicators()
  const { isOnline } = usePresence()
  const [confirming, setConfirming] = useState('')
  const [rel, setRel] = useState<FriendRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  // 群聊：公开群 / 我的群聊
  const [publicGroups, setPublicGroups] = useState<GroupSummary[]>([])
  const [myGroups, setMyGroups] = useState<MyGroupView[]>([])
  const [groupBusy, setGroupBusy] = useState('')

  // 创建群聊
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createPublic, setCreatePublic] = useState(false)

  // 搜索添加
  const [q, setQ] = useState('')
  const [found, setFound] = useState<PublicUser | null>(null)
  const [searchErr, setSearchErr] = useState('')
  const [searching, setSearching] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await apiGetFriends()
      setRel(r)
      const g = await apiListGroups()
      setPublicGroups(g.publicGroups)
      setMyGroups(g.myGroups)
    } catch (e) { setErr(getErrorMessage(e)) }
    setLoading(false)
  }, [])

  const createGroup = async () => {
    const name = createName.trim()
    if (name.length < 2) { setErr('群名至少 2 个字'); return }
    setGroupBusy('create')
    try {
      const g = await apiCreateGroup({ name, description: createDesc.trim() || undefined, isPublic: createPublic })
      setShowCreate(false)
      setCreateName('')
      setCreateDesc('')
      setCreatePublic(false)
      navigate('/group/' + encodeURIComponent(g.id))
    } catch (e) { setErr(getErrorMessage(e)) }
    setGroupBusy('')
  }

  useEffect(() => { if (isAuthed) load(); else setLoading(false) }, [isAuthed, load])

  const act = async (fn: () => Promise<unknown>, key: string) => {
    setBusy(key)
    try { await fn(); await load() } catch (e) { setErr(getErrorMessage(e)) }
    setBusy('')
  }

  const doSearch = async () => {
    const name = q.trim()
    if (!name) return
    if (name === user) { setSearchErr('不能添加自己'); return }
    setSearching(true); setSearchErr(''); setFound(null)
    try {
      const p = await apiGetUser(name)
      setFound(p)
    } catch (e: any) {
      if (e?.response?.status === 404) setSearchErr('用户不存在')
      else setSearchErr(getErrorMessage(e))
    }
    setSearching(false)
  }

  // 好友邀请改为「私信送达」：点击后给对方发一条私信邀请，对方在私信里点击即可加入
  const openStudy = (name: string) => { void apiSendDmInvite(name, 'study'); navigate('/study/' + encodeURIComponent(name)) }
  const openPk = (name: string) => { void apiSendDmInvite(name, 'pk'); navigate('/pk?invited=' + encodeURIComponent(name)) }

  if (!isAuthed) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-10">
        <div className="liquid-glass rounded-3xl p-8 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h1 className="text-xl font-bold text-foreground">我的好友</h1>
          <p className="mt-2 text-sm text-muted-foreground">登录后查看好友、互发请求，一起背单词 PK。</p>
          <button onClick={() => navigate('/login')} className="mt-5 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">去登录</button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-2 flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground">我的好友</h1>
      </header>

      {/* 搜索添加 */}
      <div className="liquid-glass rounded-2xl p-3">
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl g-border bg-transparent px-3">
            <Search className="h-4 w-4 text-muted-foreground/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              placeholder="输入用户名添加好友"
              className="flex-1 bg-transparent py-2 text-sm text-foreground outline-none"
            />
          </div>
          <button onClick={doSearch} disabled={searching} className="rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : '搜索'}
          </button>
        </div>
        {searchErr && <p className="mt-2 px-1 text-xs text-destructive">{searchErr}</p>}
        {found && (() => {
          const isFriend = rel?.friends.includes(found.username)
          const isOutgoing = rel?.outgoing.includes(found.username)
          return (
            <div className="mt-3 flex items-center gap-3 rounded-xl g-border g-panel p-3">
              <LetterAvatar name={found.username} onClick={() => navigate('/user/' + encodeURIComponent(found.username))} />
              <span className="flex-1 truncate text-sm font-medium text-foreground">{found.username}</span>              {isFriend ? (
                <span className="text-xs text-muted-foreground">已是好友</span>
              ) : isOutgoing ? (
                <span className="text-xs text-muted-foreground">等待确认…</span>
              ) : (
                <button
                  onClick={() => act(() => apiFriendRequest(found.username), 'req:' + found.username)}
                  disabled={busy === 'req:' + found.username}
                  className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                >
                  <UserPlus className="h-3.5 w-3.5" /> 加好友
                </button>
              )}
            </div>
          )
        })()}
      </div>

      {/* 公开群聊（含固定群「火箭班」）*/}
      <SectionTitle>公开群聊</SectionTitle>
      {publicGroups.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground/60">暂无公开群聊</p>
      ) : (
        <div className="space-y-2">
          {publicGroups.map((g) => (
            <button key={g.id} onClick={() => navigate('/group/' + encodeURIComponent(g.id))} className="flex w-full items-center gap-3 rounded-2xl g-border g-panel p-3 text-left">
              <span className="relative inline-flex shrink-0">
                <LetterAvatar name={g.name} size={36} />
                {g.id === 'rocket' && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-rose-500 ring-2 ring-card" />}
              </span>
              <span className="flex-1 truncate">
                <span className="block text-sm font-medium text-foreground">{g.name}</span>
                <span className="block text-xs text-muted-foreground">{g.memberCount} 名成员{g.pendingCount > 0 ? ` · ${g.pendingCount} 待审核` : ''}</span>
              </span>
              <Megaphone className="h-4 w-4 text-muted-foreground/60" />
            </button>
          ))}
        </div>
      )}

      {/* 我的群聊 */}
      <SectionTitle>我的群聊</SectionTitle>
      <div className="space-y-2">
        <button onClick={() => setShowCreate(true)} className="flex w-full items-center gap-3 rounded-2xl g-border g-panel p-3 text-left">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><UserPlus className="h-4 w-4" /></span>
          <span className="flex-1 text-sm font-medium text-foreground">创建群聊</span>
        </button>
        {myGroups.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground/60">还没有加入任何群聊</p>
        ) : (
          myGroups.map((g) => (
            <button key={g.id} onClick={() => navigate('/group/' + encodeURIComponent(g.id))} className="flex w-full items-center gap-3 rounded-2xl g-border g-panel p-3 text-left">
              <LetterAvatar name={g.name} size={36} />
              <span className="flex-1 truncate">
                <span className="block text-sm font-medium text-foreground">{g.name}</span>
                <span className="block text-xs text-muted-foreground">{g.memberCount} 名成员 · 今日早读 List {g.taskListNumberToday}</span>
              </span>
              {g.unread > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{g.unread > 99 ? '99+' : g.unread}</span>
              )}
            </button>
          ))
        )}
      </div>

      {err && <p className="mt-2 px-1 text-xs text-destructive">{err}</p>}

      {loading ? (
        <div className="pt-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          {/* 好友请求 */}
          {rel && rel.incoming.length > 0 && (
            <>
              <SectionTitle>好友请求（{rel.incoming.length}）</SectionTitle>
              <div className="space-y-2">
                {rel.incoming.map((name) => (
                  <div key={name} className="flex items-center gap-3 rounded-2xl g-border g-panel p-3">
                    <span className="relative inline-flex shrink-0">
                      <LetterAvatar name={name} onClick={() => navigate('/user/' + encodeURIComponent(name))} />
                      <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card', isOnline(name) ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                    </span>
                    <button onClick={() => navigate('/user/' + encodeURIComponent(name))} className="flex-1 truncate text-left text-sm font-medium text-foreground hover:underline">{name}</button>
                    <button onClick={() => act(() => apiFriendAccept(name), 'acc:' + name)} disabled={busy === 'acc:' + name} className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">
                      <Check className="h-3.5 w-3.5" /> 接受
                    </button>
                    <button onClick={() => act(() => apiFriendReject(name), 'rej:' + name)} disabled={busy === 'rej:' + name} className="inline-flex items-center gap-1 rounded-xl g-border g-panel px-3 py-1.5 text-xs text-muted-foreground disabled:opacity-60">
                      <X className="h-3.5 w-3.5" /> 拒绝
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 好友列表 */}
          <SectionTitle>好友（{rel?.friends.length ?? 0}）</SectionTitle>
          {!rel || rel.friends.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground/60">还没有好友，去社区或搜索添加吧～</p>
          ) : (
            <div className="space-y-2">
              {rel.friends.map((name) => {
                const unread = unreadByFriend[name] || 0
                return (
                <div key={name} className="flex items-center gap-3 rounded-2xl g-border g-panel p-3">
                  <button onClick={() => navigate('/dm/' + encodeURIComponent(name))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="relative inline-flex shrink-0">
                      <LetterAvatar name={name} onClick={() => navigate('/user/' + encodeURIComponent(name))} />
                      <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card', isOnline(name) ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                    </span>
                    <span className="relative truncate text-sm font-medium text-foreground">
                      {name}
                      {unread > 0 && (
                        <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white align-middle">{unread > 99 ? '99+' : unread}</span>
                      )}
                    </span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); openStudy(name) }} title="一起学" className="rounded-xl g-border g-panel p-2 text-foreground transition active:scale-95">
                    <BookOpen className="h-4 w-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); openPk(name) }} title="邀TA PK" className="rounded-xl g-border g-panel p-2 text-foreground transition active:scale-95">
                    <Swords className="h-4 w-4" />
                  </button>
                  <button onClick={() => setConfirming(name)} title="移除好友" className="rounded-xl g-border g-panel p-2 text-destructive transition active:scale-95">
                    <UserMinus className="h-4 w-4" />
                  </button>
                </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* 移除好友二次确认 */}
      {confirming && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirming('')}>
          <div className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-foreground">移除好友</h3>
            <p className="mt-2 text-sm text-muted-foreground">确定要删除好友「{confirming}」吗？此操作不可撤销。</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirming('')} className="flex-1 rounded-xl g-border g-panel py-2.5 text-sm text-muted-foreground">取消</button>
              <button onClick={() => { const n = confirming; setConfirming(''); act(() => apiFriendRemove(n), 'del:' + n) }} className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-medium text-white">确认删除</button>
            </div>
          </div>
        </div>
      )}

      {/* 创建群聊 */}
      {showCreate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-foreground">创建群聊</h3>
            <div className="mt-3 space-y-2">
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="群名称（2-20 字）"
                className="w-full rounded-xl g-border bg-transparent px-3 py-2.5 text-sm outline-none"
              />
              <textarea
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="群简介（选填）"
                rows={2}
                className="w-full rounded-xl g-border bg-transparent px-3 py-2 text-sm outline-none"
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={createPublic} onChange={(e) => setCreatePublic(e.target.checked)} className="h-4 w-4" />
                设为公开群（出现在「公开群聊」列表，他人可申请加入）
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 rounded-xl g-border g-panel py-2.5 text-sm text-muted-foreground">取消</button>
              <button onClick={createGroup} disabled={groupBusy === 'create'} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
