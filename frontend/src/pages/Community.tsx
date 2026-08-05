import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import {
  Coffee, HelpCircle, MessageSquare, Send, Loader2,
  ChevronLeft, ChevronRight, Plus, Eye, ThumbsUp, Heart, Trophy, Trash2, Flame, ImagePlus,
  LayoutGrid, GraduationCap, Sun, Megaphone,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { RequireLogin } from '@/components/RequireLogin'
import { cn } from '@/lib/utils'
import {
  fetchForumPosts, createForumPost, deleteForumPost,
  fetchForumPost, toggleLikePost, getLikeStatus,
  postIdToWordId, type ForumPost,
} from '@/lib/forum'
import { fetchComments, addComment, deleteComment, toggleCommentLike, uploadCommentImage, commentImageUrl, type Comment } from '@/lib/comments'
import { getErrorMessage } from '@/lib/api-client'
import { StaggerContainerEnter, StaggerItemEnter, ANIMATION_PRESETS } from '@/components/MotionPrimitives'
import { ImageLightbox } from '@/components/ImageLightbox'
import { useSettings } from '@/context/SettingsContext'
import { ChatDisclaimer } from '@/components/ChatDisclaimer'
import { useChat } from '@/hooks/use-chat'
import { usePresence } from '@/context/PresenceContext'
import { timeAgoShort } from '@/lib/time'

/* ---- 时间格式化（抖音风格：刚刚 / X分钟前 / X小时前 / X天前，更早显示 M-D） ---- */
function timeAgo(ts: number): string {
  return timeAgoShort(ts)
}

// 头像点击跳转用户主页（聊天 / 帖子 / 评论通用）
function AvatarLink({ name, avatar, size, className }: { name: string; avatar?: string | null; size: number; className?: string }) {
  const navigate = useNavigate()
  return (
    <span
      className={'inline-flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full ' + (className || '')}
      style={{ width: size, height: size }}
      onClick={(e) => { e.stopPropagation(); navigate('/user/' + encodeURIComponent(name)) }}
      title={`查看 ${name} 的主页`}
    >
      {avatar ? (
        <img src={avatar} className="h-full w-full object-cover" alt="" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {(name || '?')[0]}
        </span>
      )}
    </span>
  )
}

/* ---- 自动识别文本中的链接并渲染为可点击蓝字 ---- */
function AutoLinkText({ text }: { text: string }) {
  const segments = text.split(/(https?:\/\/[^\s]+)/g)
  return (
    <>
      {segments.map((seg, i) =>
        /^https?:\/\//.test(seg) ? (
          <a
            key={i}
            href={seg}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {seg}
          </a>
        ) : (
          <span key={i}>{seg}</span>
        )
      )}
    </>
  )
}

/* ---- 社区 5 大板块（网格视图入口）---- */
const FORUM_MODULES = [
  { key: 'all', label: '全部帖子', icon: LayoutGrid, desc: '社区里的所有帖子' },
  { key: 'announcement', label: '公告', icon: Megaphone, desc: '社区公告与通知' },
  { key: 'entertainment', label: '娱乐', icon: Coffee, desc: '歌曲、段子、趣事分享' },
  { key: 'study', label: '学习', icon: GraduationCap, desc: '记忆妙招、学习方法' },
  { key: 'qa', label: '疑难', icon: HelpCircle, desc: '提问与解答互助' },
  { key: 'daily', label: '日常', icon: Sun, desc: '记录学习的每一天' },
] as const

/* ---- 各分类元信息（用于帖子标签 / 发帖选择）---- */
const CATEGORY_META: Record<string, { label: string; icon: typeof Coffee }> = {
  announcement: { label: '公告', icon: Megaphone },
  entertainment: { label: '娱乐', icon: Coffee },
  study: { label: '学习', icon: GraduationCap },
  qa: { label: '疑难', icon: HelpCircle },
  daily: { label: '日常', icon: Sun },
}

// 管理员账号：拥有删除所有评论、回复与帖子的权限
const ADMIN_USERNAME = '20051226'

export default function Community() {
  const { isAuthed, user, isAdmin } = useAuth()
  const { onlineCount } = usePresence()
  const { animationPreset } = useSettings()
  const preset = ANIMATION_PRESETS[animationPreset]
  const staggerOpts = { stagger: preset.stagger, distance: preset.distance, ease: preset.ease }
  const [activeModule, setActiveModule] = useState<string>('all')
  const [inModule, setInModule] = useState(false)
  const [showChat, setShowChat] = useState(false)

  return (
    <StaggerContainerEnter className="min-h-screen pb-24 pt-6" options={staggerOpts}>
      <div className="mx-auto w-full max-w-2xl px-4">
        <StaggerItemEnter>
          <header className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-foreground">社区</h1>
              <p className="mt-1 text-xs text-muted-foreground">学习互助，共同进步</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1.5">
              <span className={cn('h-2 w-2 rounded-full', onlineCount > 0 ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-gray-400')} />
              <span className="text-[11px] tabular-nums text-muted-foreground">{onlineCount} 人在线</span>
            </div>
          </header>
        </StaggerItemEnter>

        <StaggerItemEnter>
          {showChat ? (
            <RequireLogin feature="聊天室">
              <ChatRoom onBack={() => setShowChat(false)} />
            </RequireLogin>
          ) : inModule ? (
            <ForumView
              category={activeModule}
              onBack={() => setInModule(false)}
              isAuthed={isAuthed} user={user} isAdmin={isAdmin}
            />
          ) : (
            <ModuleGrid onSelect={(k) => { setActiveModule(k); setInModule(true) }} onChat={() => setShowChat(true)} isAuthed={isAuthed} />
          )}
        </StaggerItemEnter>
      </div>
    </StaggerContainerEnter>
  )
}

/* ===================================================================
   板块网格视图（5 个模块卡片，与「全部帖子」一致的横向卡片）
   =================================================================== */
function ModuleGrid({ onSelect, onChat, isAuthed }: {
  onSelect: (key: string) => void; onChat: () => void; isAuthed: boolean
}) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [hotPosts, setHotPosts] = useState<ForumPost[]>([])

  useEffect(() => {
    (async () => {
      try {
        const all = await fetchForumPosts('all')
        const c: Record<string, number> = { all: all.length }
        all.forEach((p) => { c[p.category] = (c[p.category] || 0) + 1 })
        setCounts(c)
        const sorted = [...all].sort((a, b) => (b.views - a.views) || (a.createdAt - b.createdAt)).slice(0, 10)
        setHotPosts(sorted)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    })()
  }, [])

  return (
    <div className="flex flex-col gap-3">
      {/* 实时聊天室入口 — 抖音风格 */}
      <button
        onClick={onChat}
        className="group flex items-center gap-3 rounded-2xl border g-border g-panel p-4 text-left transition active:scale-[0.98] hover:border-primary/40 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.04] to-transparent" />
        <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-violet-500 text-white shadow-lg shadow-rose-500/20">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div className="relative z-10 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[15px] font-semibold text-foreground">实时聊天室</span>
            {isAuthed ? (
              <span className="shrink-0 rounded-full bg-rose-500 text-white px-2 py-0.5 text-[10px] font-bold animate-pulse">LIVE</span>
            ) : (
              <span className="shrink-0 rounded-full bg-muted-foreground/20 text-muted-foreground px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
                <Lock className="h-3 w-3" /> 需登录
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{isAuthed ? '和在线学友一起聊天' : '登录后即可进入聊天室'}</p>
        </div>
        <ChevronRight className="relative z-10 h-4 w-4 shrink-0 text-muted-foreground/40" />
      </button>

      {FORUM_MODULES.map((m) => {
        const Icon = m.icon
        return (
          <button
            key={m.key}
            onClick={() => onSelect(m.key)}
            className={cn(
              'group flex items-center gap-3 rounded-2xl border g-border g-panel p-4 text-left transition active:scale-[0.98] hover:border-primary/40'
            )}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition group-hover:bg-primary/25">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-[15px] font-semibold text-foreground">{m.label}</span>
                <span className="shrink-0 rounded-full g-icon px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {loading ? '···' : (counts[m.key] ?? 0)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{m.desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
          </button>
        )
      })}

      {/* 今日热榜 —— 挨着分类卡片下面 */}
      {hotPosts.length > 0 && (
        <HotRanking posts={hotPosts} onSelect={() => onSelect('all')} />
      )}
    </div>
  )
}

/* ===================================================================
   板块帖子列表视图（原列表布局）
   =================================================================== */
function ForumView({
  category, onBack, isAuthed, user, isAdmin,
}: {
  category: string; onBack: () => void
  isAuthed: boolean; user: string | null; isAdmin: boolean
}) {
  const [posts, setPosts] = useState<ForumPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailPost, setDetailPost] = useState<ForumPost | null>(null)

  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCat, setNewCat] = useState<string>(category !== 'all' ? category : 'study')
  const [posting, setPosting] = useState(false)

  // 已读帖子追踪（本机 localStorage，跨会话保存）：未读帖子显示编号红点，打开后消失
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('hv:readPosts')
      return new Set(raw ? (JSON.parse(raw) as string[]) : [])
    } catch {
      return new Set<string>()
    }
  })
  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev
      const n = new Set(prev)
      n.add(id)
      try {
        localStorage.setItem('hv:readPosts', JSON.stringify(Array.from(n)))
        // 通知底部导航的「社区」未读徽标立即重算
        window.dispatchEvent(new Event('hv:forum-read'))
      } catch {
        /* noop */
      }
      return n
    })
  }, [])

  const [postImages, setPostImages] = useState<{ preview: string; url?: string; uploading: boolean }[]>([])
  const postFileRef = useRef<HTMLInputElement>(null)

  // 进入帖子详情时 push history，返回时 popstate 回到列表
  useEffect(() => {
    if (!detailPost) return
    const onPop = () => { setDetailPost(null); load() }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailPost])

  const handlePostImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    if (f.size > 10 * 1024 * 1024) { alert('图片不能超过 10MB'); return }
    const idx = postImages.length
    const preview = URL.createObjectURL(f)
    setPostImages((prev) => [...prev, { preview, uploading: true }])
    e.target.value = ''
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.onerror = reject
        fr.readAsDataURL(f)
      })
      const url = await uploadCommentImage(dataUrl)
      setPostImages((prev) => prev.map((x, i) => (i === idx ? { ...x, url, uploading: false } : x)))
    } catch {
      setPostImages((prev) => prev.filter((_, i) => i !== idx))
      alert('图片上传失败')
    }
  }
  const removePostImage = (i: number) => setPostImages((prev) => prev.filter((_, j) => j !== i))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchForumPosts(category)
      setPosts(list)
    } catch { setError('加载失败') }
    finally { setLoading(false) }
  }, [category])

  useEffect(() => { void load() }, [load])

  const moduleMeta = FORUM_MODULES.find((m) => m.key === category)

  const handleCreate = async () => {
    const t = newTitle.trim()
    if (!t || posting) return
    const stillUploading = postImages.some((x) => x.uploading)
    if (stillUploading) { alert('请等待图片上传完成'); return }
    setPosting(true)
    try {
      const imageUrls = postImages.filter((x) => x.url).map((x) => x.url!)
      await createForumPost({ category: newCat, title: t, content: newContent.trim(), images: imageUrls.length ? imageUrls : undefined })
      setShowNew(false); setNewTitle(''); setNewContent(''); setNewCat(category !== 'all' ? category : 'study')
      setPostImages([])
      await load()
    } catch (e) { setError(getErrorMessage(e) || '发表失败') }
    finally { setPosting(false) }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除？')) return
    try { await deleteForumPost(id); setDetailPost(null); await load() }
    catch { alert('删除失败') }
  }

  return (
    <>
      <button onClick={onBack} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> 返回社区
      </button>

      <div className="mb-3 flex items-center gap-2">
        {moduleMeta && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <moduleMeta.icon className="h-4 w-4" />
          </span>
        )}
        <h2 className="text-lg font-bold text-foreground">{moduleMeta?.label ?? '帖子'}</h2>
      </div>

      {detailPost ? (
        <ForumPostDetail
          post={detailPost}
          onBack={() => window.history.back()}
          onDelete={() => handleDelete(detailPost._id)}
          isAuthed={isAuthed} user={user} isAdmin={isAdmin}
        />
      ) : (
        <>
          {isAuthed && !showNew && (
            <button onClick={() => setShowNew(true)}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed g-border py-3 text-sm text-muted-foreground transition-all hover:g-panel active:scale-[0.99]">
              <Plus className="h-4 w-4" /> 发布新帖子
            </button>
          )}

          {showNew && (
            <div className="mb-4 rounded-2xl border g-border g-panel p-4">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {Object.entries(CATEGORY_META)
                .filter(([key]) => key !== 'announcement' || isAdmin || user === ADMIN_USERNAME)
                .map(([key, meta]) => (
                  <button key={key} onClick={() => setNewCat(key)}
                    className={cn('rounded-lg px-3 py-1 text-xs font-medium transition', newCat === key ? 'bg-primary text-primary-foreground' : 'g-panel text-muted-foreground')}>
                    {meta.label}
                  </button>
                ))}
              </div>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={60} placeholder="帖子标题（60字内）"
                className="mb-2 w-full rounded-xl border g-border g-panel px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50" />
              <div className="relative">
                <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} maxLength={5000} rows={3} placeholder="分享内容…"
                  className="w-full resize-none rounded-xl border g-border g-panel px-3 pb-7 pt-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50" />
                {postImages.length < 9 && (
                  <button onClick={() => postFileRef.current?.click()}
                    className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-lg g-panel px-2 py-1 text-xs text-muted-foreground transition hover:text-primary">
                    <ImagePlus className="h-3.5 w-3.5" /> {postImages.length > 0 ? `${postImages.length}/9` : ''}
                  </button>
                )}
                <input ref={postFileRef} type="file" accept="image/*" onChange={handlePostImage} className="hidden" />
              </div>
              {/* 图片上传预览 */}
              {postImages.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {postImages.map((img, i) => (
                    <div key={i} className="relative h-20 w-20">
                      {img.uploading ? (
                        <div className="flex h-full w-full items-center justify-center rounded-lg g-panel">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <img src={img.preview} className="h-full w-full rounded-lg object-cover" alt="" />
                      )}
                      <button onClick={() => { URL.revokeObjectURL(img.preview); removePostImage(i) }}
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white text-xs">×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setShowNew(false)} className="rounded-xl g-panel px-4 py-2 text-sm text-muted-foreground">取消</button>
                <button onClick={handleCreate} disabled={posting || !newTitle.trim()}
                  className={cn('rounded-xl px-4 py-2 text-sm font-medium transition', newTitle.trim() && !posting ? 'bg-primary text-primary-foreground' : 'cursor-not-allowed g-panel text-muted-foreground/40')}>
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : '发布'}
                </button>
              </div>
            </div>
          )}

          {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

          {loading ? (
            <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border g-border g-panel py-10 text-center text-sm text-muted-foreground/70">
              <MessageSquare className="mx-auto mb-2 h-6 w-6 text-muted-foreground/30" />
              暂无帖子，登录后来发第一帖吧～
            </div>
          ) : (
            <>
              {!isAuthed && posts.length > 1 && (
                <Link to="/login" className="mb-3 flex items-center justify-center rounded-xl g-panel px-4 py-2.5 text-sm text-muted-foreground">
                  登录后查看更多帖子
                </Link>
              )}
              {/* 列表布局：单列，保持原布局样式 */}
              <div className="flex flex-col gap-2.5">
                {(() => {
                  const displayed = isAuthed ? posts : posts.slice(0, 1)
                  // 仅登录用户显示未读红点；按顺序给未读帖子编号 1、2、3、4……
                  const unreadNum = new Map<string, number>()
                  if (isAuthed) {
                    let seq = 0
                    for (const p of displayed) {
                      if (p.author !== user && !readIds.has(p._id)) {
                        seq += 1
                        unreadNum.set(p._id, seq)
                      }
                    }
                  }
                  return displayed.map((p) => (
                    <ForumPostRow
                      key={p._id}
                      post={p}
                      unreadNumber={unreadNum.get(p._id)}
                      onClick={() => { markRead(p._id); setDetailPost(p); window.history.pushState({ postDetail: true }, ''); }}
                    />
                  ))
                })()}
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}

/* ---- 帖子行（列表版，全宽卡片）---- */
function ForumPostRow({ post, onClick, unreadNumber }: { post: ForumPost; onClick: () => void; unreadNumber?: number }) {
  const meta = CATEGORY_META[post.category]
  return (
    <button onClick={onClick}
      className="relative flex w-full flex-col rounded-2xl border g-border g-panel p-3.5 text-left transition active:scale-[0.99] hover:g-panel">
      {unreadNumber ? (
        <span className="absolute right-2 top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
          {unreadNumber}
        </span>
      ) : null}
      <div className="flex items-center gap-2">
        {meta && (
          <span className="inline-flex w-fit items-center gap-1 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-500 dark:text-sky-400">
            <meta.icon className="h-2.5 w-2.5" /> {meta.label}
          </span>
        )}
        {post.title && (
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{post.title}</h3>
        )}
      </div>
      {post.content && (
        <p className="mt-1 line-clamp-2 break-words text-[12px] leading-relaxed text-foreground/65">
          <AutoLinkText text={post.content} />
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[10px] text-muted-foreground/60">
          <AvatarLink name={post.author} avatar={post.authorAvatar} size={16} />
          <span className="truncate">{post.author} · {timeAgo(post.createdAt)}</span>
        </span>
        <div className="flex shrink-0 items-center gap-2.5 rounded-lg bg-muted/35 px-2 py-1 text-[10px] tabular-nums text-muted-foreground/75">
          <span className="inline-flex items-center gap-0.5"><Eye className="h-3 w-3" />{post.views}</span>
          <span className="inline-flex items-center gap-0.5"><ThumbsUp className="h-3 w-3" />{post.likes}</span>
          <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{post.commentCount}</span>
        </div>
      </div>
    </button>
  )
}

/* ---- 今日热榜（列表底部：按浏览量 Top10，浏览量相同则发布时间最早优先）---- */
function HotRanking({ posts, onSelect }: { posts: ForumPost[]; onSelect: (p: ForumPost) => void }) {
  if (posts.length === 0) return null
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Flame className="h-4 w-4 text-rose-500" /> 今日热榜
        <span className="text-[10px] font-normal text-muted-foreground/50">浏览量 Top 10</span>
      </div>
      <div className="flex flex-col gap-2">
        {posts.map((p, i) => (
          <button key={p._id} onClick={() => onSelect(p)}
            className="flex items-center gap-3 rounded-2xl border g-border g-panel p-3 text-left transition active:scale-[0.99] hover:g-panel">
            <span className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
              i === 0 ? 'bg-rose-500 text-white'
                : i === 1 ? 'bg-orange-500 text-white'
                : i === 2 ? 'bg-amber-500 text-white'
                : 'bg-muted/40 text-muted-foreground'
            )}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{p.title || CATEGORY_META[p.category]?.label || '帖子'}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground/60">
                <span className="truncate">{p.author}</span>
                <span className="inline-flex items-center gap-0.5"><Eye className="h-3 w-3" />{p.views}</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---- 帖子详情（含浏览量统计 + 点赞 + 抖音风评论）---- */
function ForumPostDetail({ post, onBack, onDelete, isAuthed, user, isAdmin }: {
  post: ForumPost; onBack: () => void; onDelete: () => void
  isAuthed: boolean; user: string | null; isAdmin: boolean
}) {
  const [current, setCurrent] = useState<ForumPost>(post)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likes)
  const [comments, setComments] = useState<Comment[]>([])
  const [cLoading, setCLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const commentFileRef = useRef<HTMLInputElement>(null)
  const [commentImages, setCommentImages] = useState<{ preview: string; url?: string; uploading: boolean }[]>([])

  const handleCommentImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    if (f.size > 10 * 1024 * 1024) { alert('图片不能超过 10MB'); return }
    const idx = commentImages.length
    const preview = URL.createObjectURL(f)
    setCommentImages((prev) => [...prev, { preview, uploading: true }])
    e.target.value = ''
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.onerror = reject
        fr.readAsDataURL(f)
      })
      const url = await uploadCommentImage(dataUrl)
      setCommentImages((prev) => prev.map((x, i) => (i === idx ? { ...x, url, uploading: false } : x)))
    } catch {
      setCommentImages((prev) => prev.filter((_, i) => i !== idx))
      alert('图片上传失败')
    }
  }
  const removeCommentImage = (i: number) => setCommentImages((prev) => prev.filter((_, j) => j !== i))

  const wordId = postIdToWordId(post._id)
  const cat = CATEGORY_META[current.category]
  const isAdminUser = isAdmin || user === ADMIN_USERNAME
  const canDeletePost = user === post.author || isAdminUser

  // 进入详情即触发浏览量 +1，并刷新最新统计
  useEffect(() => {
    let alive = true
    fetchForumPost(post._id)
      .then((p) => { if (alive) { setCurrent(p); setLikeCount(p.likes) } })
      .catch(() => {})
    return () => { alive = false }
  }, [post._id])

  useEffect(() => {
    void getLikeStatus(post._id).then((s) => setLiked(s.liked)).catch(() => {})
  }, [post._id])

  const loadComments = useCallback(async () => {
    setCLoading(true)
    try { setComments(await fetchComments(wordId)) }
    catch { /* ignore */ }
    finally { setCLoading(false) }
  }, [wordId])

  useEffect(() => { void loadComments() }, [loadComments])

  const handleLike = async () => {
    if (!isAuthed) { window.location.href = '/login'; return }
    try {
      const r = await toggleLikePost(post._id)
      setLiked(r.liked); setLikeCount(r.likes)
    } catch { /* ignore */ }
  }

  const handleLikeComment = async (c: Comment) => {
    if (!isAuthed) { window.location.href = '/login'; return }
    try {
      const r = await toggleCommentLike(c._id)
      setComments((prev) => prev.map((x) => x._id === c._id ? { ...x, liked: r.liked, likes: r.likes } : x))
    } catch { /* ignore */ }
  }

  const handleDeleteComment = async (id: string) => {
    if (!window.confirm('确认删除该评论？')) return
    try { await deleteComment(id); await loadComments() }
    catch { alert('删除失败') }
  }

  const send = async () => {
    const val = text.trim()
    if ((!val && commentImages.length === 0) || sending) return
    const stillUploading = commentImages.some((x) => x.uploading)
    if (stillUploading) { alert('请等待图片上传完成'); return }
    setSending(true)
    try {
      const urls = commentImages.filter((x) => x.url).map((x) => x.url!)
      const opts: any = {}
      if (replyTo) opts.parentId = replyTo
      if (urls.length > 0) opts.images = urls
      await addComment(wordId, val, user || '游客', Object.keys(opts).length ? opts : undefined)
      setText(''); setReplyTo(null); setCommentImages([]); await loadComments()
    } catch { /* ignore */ }
    finally { setSending(false) }
  }

  const { topComments, replyMap } = (() => {
    const byId = new Map<string, Comment>()
    comments.forEach((c) => byId.set(c._id, c))
    const top: Comment[] = []
    const repl = new Map<string, Comment[]>()
    comments.forEach((c) => {
      if (!c.parentId) { top.push(c) }
      else {
        let root = c.parentId
        for (let i = 0; i < 20; i++) {
          const p = byId.get(root)
          if (!p || !p.parentId) break
          root = p.parentId
        }
        if (!repl.has(root)) repl.set(root, [])
        repl.get(root)!.push(c)
      }
    })
    top.sort((a, b) => a.createdAt - b.createdAt)
    repl.forEach((v) => v.sort((a, b) => a.createdAt - b.createdAt))
    return { topComments: top, replyMap: repl }
  })()

  return (
    <>
    <div className="space-y-3">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> 返回列表
      </button>

      {/* 帖子正文 */}
      <div className="rounded-2xl border g-border g-panel p-5">
        {cat && (
          <span className="mb-2 inline-flex items-center gap-1 rounded-lg bg-sky-500/10 px-2.5 py-1 text-[12px] font-medium text-sky-500 dark:text-sky-400">
            <cat.icon className="h-3.5 w-3.5" /> {cat.label}
          </span>
        )}
        {current.title && <h1 className="text-lg font-bold text-foreground">{current.title}</h1>}
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/80">
          <AutoLinkText text={current.content} />
        </p>
        {current.images && current.images.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {current.images.map((img, i) => (
              <img key={i} src={commentImageUrl(img)}
                onClick={() => setLightboxSrc(commentImageUrl(img))}
                className="h-24 w-24 cursor-pointer rounded-xl object-cover transition active:scale-95" alt="" />
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground/60">
          <AvatarLink name={current.author} avatar={current.authorAvatar} size={20} />
          <span>{current.author}</span><span>·</span><span>{timeAgo(current.createdAt)}</span>
          {canDeletePost && <button onClick={onDelete} className="ml-auto text-destructive hover:underline">删除</button>}
        </div>
        {/* 统计行 — 右下角药丸 */}
        <div className="mt-3 flex items-center justify-end border-t g-border pt-3">
          <div className="flex shrink-0 items-center gap-2.5 rounded-lg bg-muted/35 px-2 py-1 text-[10px] tabular-nums text-muted-foreground/75">
            <span className="inline-flex items-center gap-0.5"><Eye className="h-3 w-3" />{current.views}</span>
            <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{current.commentCount}</span>
            <button onClick={handleLike} className={cn('inline-flex items-center gap-0.5 transition', liked ? 'text-rose-500' : 'hover:text-rose-500')}>
              <Heart className={cn('h-3 w-3', liked && 'fill-rose-500')} />{likeCount}
            </button>
          </div>
        </div>
      </div>

      {/* 评论区（抖音风格：头像 + 昵称 + 正文 + 右侧点赞 + 删除） */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          <MessageSquare className="h-4 w-4 text-primary" /> 评论（{comments.length}）
        </div>

        {cLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : topComments.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground/70">暂无评论，来抢沙发吧～</p>
        ) : (
          <div className="space-y-4">
            {!isAuthed && topComments.length > 1 && (
              <Link to="/login" className="flex justify-center rounded-xl g-panel px-4 py-2 text-xs text-muted-foreground">
                登录后查看更多评论
              </Link>
            )}
            {(isAuthed ? topComments : topComments.slice(0, 1)).map((c) => {
              const replies = replyMap.get(c._id) || []
              const showAll = expandedReplies.has(c._id)
              const visibleReplies = showAll ? replies : replies.slice(0, 1)
              return (
                <div key={c._id} className="space-y-3">
                  <CommentItem
                    c={c} isAdmin={isAdminUser} postAuthor={post.author} currentUser={user}
                    onReply={() => { setReplyTo(c._id); inputRef.current?.focus() }}
                    onDelete={() => handleDeleteComment(c._id)}
                    onLike={() => handleLikeComment(c)}
                    liked={!!c.liked} likes={c.likes ?? 0}
                    onImageClick={(src) => setLightboxSrc(src)}
                  />
                  {visibleReplies.map((r) => (
                    <div key={r._id} className="ml-9">
                      <CommentItem
                        c={r} isAdmin={isAdminUser} postAuthor={post.author} currentUser={user} isReply
                        onReply={() => { setReplyTo(c._id); inputRef.current?.focus() }}
                        onDelete={() => handleDeleteComment(r._id)}
                        onLike={() => handleLikeComment(r)}
                        liked={!!r.liked} likes={r.likes ?? 0}
                        onImageClick={(src) => setLightboxSrc(src)}
                      />
                    </div>
                  ))}
                  {replies.length > 1 && (
                    <button onClick={() => {
                      setExpandedReplies((prev) => { const n = new Set(prev); showAll ? n.delete(c._id) : n.add(c._id); return n })
                    }} className="ml-9 text-[11px] text-muted-foreground/60 hover:text-primary">
                      {showAll ? '收起回复' : `查看全部 ${replies.length} 条回复`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-3">
          {replyTo && (
            <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground/80">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">回复中</span>
              <button onClick={() => setReplyTo(null)} className="rounded-full p-0.5 text-xs hover:text-foreground">✕</button>
            </div>
          )}
          {/* 评论图片预览 */}
          {commentImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {commentImages.map((img, i) => (
                <div key={i} className="relative h-16 w-16">
                  {img.uploading ? (
                    <div className="flex h-full w-full items-center justify-center rounded-lg g-panel">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <img src={img.preview} className="h-full w-full rounded-lg object-cover" alt="" />
                  )}
                  <button onClick={() => { URL.revokeObjectURL(img.preview); removeCommentImage(i) }}
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white text-[10px]">×</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-start gap-2">
            <div className="relative flex-1">
              <textarea ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() } }}
                rows={2} maxLength={2000} placeholder={isAuthed ? '写评论…（Ctrl+Enter 发送）' : '登录后可写评论…'}
                className="min-h-[2.5rem] w-full resize-none rounded-xl g-panel px-3 pb-7 pt-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50" />
              {commentImages.length > 0 && (
                <span className="absolute bottom-1.5 left-2 text-[10px] text-muted-foreground/50 tabular-nums">{commentImages.length}/9</span>
              )}
              {commentImages.length < 9 && (
                <button onClick={() => commentFileRef.current?.click()}
                  className="absolute bottom-1.5 left-8 flex items-center gap-1 rounded-lg g-panel px-1.5 py-0.5 text-xs text-muted-foreground transition hover:text-primary">
                  <ImagePlus className="h-3.5 w-3.5" />
                </button>
              )}
              <input ref={commentFileRef} type="file" accept="image/*" onChange={handleCommentImage} className="hidden" />
            </div>
            <button onClick={send} disabled={!isAuthed || sending || (!text.trim() && commentImages.length === 0)}
              className={cn('flex h-10 shrink-0 items-center gap-1 rounded-xl px-4 text-sm transition active:scale-95',
                isAuthed && (text.trim() || commentImages.length > 0) && !sending ? 'bg-primary text-primary-foreground' : 'cursor-not-allowed g-panel text-muted-foreground/40')}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </>
  )
}

/* ---- 评论项（抖音风格：头像 + 昵称 + 正文 + 右侧点赞 + 删除）---- */
function CommentItem({ c, isAdmin, postAuthor, currentUser, isReply, onReply, onDelete, onLike, liked, likes, onImageClick }: {
  c: Comment; isAdmin: boolean; postAuthor: string; currentUser: string | null
  isReply?: boolean; onReply: () => void; onDelete: () => void; onLike: () => void
  liked: boolean; likes: number; onImageClick?: (src: string) => void
}) {
  const isMine = c.author === currentUser
  const isPostOwner = c.author === postAuthor
  const canDelete = isAdmin || isMine

  return (
    <div className="flex gap-2.5">
      <AvatarLink name={c.author} avatar={c.authorAvatar} size={isReply ? 24 : 28} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className={cn('text-xs font-medium', isReply ? 'text-foreground/60' : 'text-foreground/70')}>
            {c.author}
          </span>
          {isPostOwner && !isReply && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400">
              <Trophy className="h-2.5 w-2.5" /> 楼主
            </span>
          )}
          {isAdmin && c.author !== currentUser && (
            <span className="inline-flex items-center rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium text-violet-500">
              管理员
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/50">{timeAgo(c.createdAt)}</span>
        </div>
        <p className={cn('mt-0.5 leading-relaxed', isReply ? 'text-xs text-foreground/75' : 'text-sm text-foreground/85')}>
          {c.text}
        </p>
        {c.images && c.images.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {c.images.map((img, i) => (
              <img key={i} src={commentImageUrl(img)}
                onClick={() => onImageClick?.(commentImageUrl(img))}
                className={cn('cursor-pointer rounded-lg object-cover transition active:scale-95',
                  isReply ? 'h-16 w-16' : 'h-20 w-20')} alt="" />
            ))}
          </div>
        )}
        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground/60">
          <button onClick={onReply} className="hover:text-primary">回复</button>
          {canDelete && (
            <button onClick={onDelete} className="inline-flex items-center gap-0.5 hover:text-destructive">
              <Trash2 className="h-3 w-3" /> 删除
            </button>
          )}
        </div>
      </div>
      {/* 右侧：点赞（抖音风格） */}
      <button
        onClick={onLike}
        className={cn('flex shrink-0 flex-col items-center justify-center pt-1 transition', liked ? 'text-rose-500' : 'text-muted-foreground/50 hover:text-rose-500')}
      >
        <Heart className={cn('h-4 w-4', liked && 'fill-rose-500')} />
        <span className="text-[10px] tabular-nums">{likes}</span>
      </button>
    </div>
  )
}

/* ===================================================================
   抖音风格实时聊天室
   =================================================================== */
function ChatRoom({ onBack }: { onBack: () => void }) {
  const { messages, connected, joined, error, onlineCount, send, deleteMessage, clearMessages } = useChat()
  const { isAdmin } = useAuth()
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 自动滚到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 进入聊天室时聚焦输入框
  useEffect(() => {
    if (joined) inputRef.current?.focus()
  }, [joined])

  const handleSend = () => {
    if (!text.trim() || !joined) return
    send(text)
    setText('')
  }

  // 聊天消息时间（抖音风格）
  const fmtTime = (ts: number) => timeAgoShort(ts)

  // 用户颜色哈希（稳定色板）
  const userColor = (name: string) => {
    const palette = [
      'text-rose-400', 'text-sky-400', 'text-emerald-400', 'text-amber-400',
      'text-violet-400', 'text-cyan-400', 'text-pink-400', 'text-lime-400',
      'text-orange-400', 'text-blue-400', 'text-fuchsia-400', 'text-teal-400',
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return palette[Math.abs(hash) % palette.length]
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 11rem)' }}>
      {/* 顶栏：返回 + 在线人数 */}
      <div className="mb-3 flex items-center justify-between rounded-2xl border g-border g-panel px-4 py-2.5">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition">
          <ChevronLeft className="h-4 w-4" /> 返回
        </button>
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-foreground">💬 聊天室</span>
          {isAdmin && (
            <button
              onClick={() => {
                if (window.confirm('确定要清空全部聊天记录吗？此操作不可恢复。')) clearMessages()
              }}
              title="清空全部聊天记录（管理员）"
              className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive transition hover:bg-destructive/20"
            >
              <Trash2 className="h-3 w-3" /> 清空
            </button>
          )}
          <div className="flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1">
            <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-gray-400')} />
            <span className="text-[11px] tabular-nums text-muted-foreground">{onlineCount} 人在线</span>
          </div>
        </div>
      </div>

      {/* 消息列表：半透明毛玻璃风格 */}
      <div className="flex-1 overflow-y-auto rounded-2xl border g-border bg-black/[0.02] dark:bg-white/[0.02] p-3 mb-3"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.01) 100%)',
        }}
      >
        <ChatDisclaimer />

        {!joined && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            {error ? (
              <>
                <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground/60">{error}</p>
                <Link to="/login" className="rounded-xl bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground">去登录</Link>
              </>
            ) : (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
                <p className="text-xs text-muted-foreground/60">正在连接聊天室…</p>
              </>
            )}
          </div>
        )}

        {joined && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <MessageSquare className="h-8 w-8 text-muted-foreground/25" />
            <p className="text-sm text-muted-foreground/50">还没有消息，来打破沉默吧 🎉</p>
          </div>
        )}

        {messages.map((msg) =>
          msg.type === 'system' ? (
            <div key={msg.id} className="flex justify-center my-2.5">
              <span className="whitespace-pre-line rounded-2xl bg-muted/40 px-3 py-2 text-center text-[11px] leading-relaxed text-muted-foreground/70">
                {msg.text}
              </span>
            </div>
          ) : (
            <div key={msg.id} className="flex gap-2.5 mb-3 group">
              {/* 头像 */}
              <AvatarLink name={msg.username} avatar={msg.avatar} size={32} className="mt-0.5" />
              {/* 消息内容 */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5 mb-0.5">
                  <span className={cn('text-[12px] font-semibold', userColor(msg.username))}>
                    {msg.username}
                  </span>
                  <span className="text-[10px] text-muted-foreground/45">{fmtTime(msg.timestamp)}</span>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (window.confirm(`确定删除 ${msg.username} 的这条消息吗？`)) deleteMessage(msg.id)
                      }}
                      title="删除此消息（管理员）"
                      className="ml-0.5 inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] text-muted-foreground/50 opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="inline-block max-w-full rounded-2xl rounded-tl-sm bg-muted/30 dark:bg-muted/20 px-3 py-1.5">
                  <p className="text-[13px] leading-relaxed text-foreground/85 break-words whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* 底部输入框：抖音风格 */}
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            maxLength={500}
            placeholder={joined ? '说点什么…' : '连接中…'}
            disabled={!joined}
            className="w-full rounded-2xl border g-border bg-muted/20 dark:bg-muted/10 px-4 py-2.5 pr-12 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 transition focus:border-primary/40 disabled:opacity-50"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/35 tabular-nums">
            {text.length}/500
          </span>
        </div>
        <button
          onClick={handleSend}
          disabled={!joined || !text.trim()}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-90',
            joined && text.trim()
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
              : 'cursor-not-allowed bg-muted/20 text-muted-foreground/30'
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
