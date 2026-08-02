import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Coffee, HelpCircle, MessageSquare, Send, Loader2,
  ChevronLeft, ChevronRight, Plus, Eye, ThumbsUp, Heart, Trophy, Trash2, Flame, ImagePlus,
  LayoutGrid, GraduationCap, Sun,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import {
  fetchForumPosts, createForumPost, deleteForumPost,
  fetchForumPost, toggleLikePost, getLikeStatus,
  postIdToWordId, type ForumPost,
} from '@/lib/forum'
import { fetchComments, addComment, deleteComment, toggleCommentLike, uploadCommentImage, commentImageUrl, type Comment } from '@/lib/comments'
import { getErrorMessage } from '@/lib/api-client'
import { StaggerContainerEnter, StaggerItemEnter, STAGGER_EASE } from '@/components/MotionPrimitives'
import { ImageLightbox } from '@/components/ImageLightbox'
import { useSettings } from '@/context/SettingsContext'

/* ---- 时间格式化 ---- */
function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  const date = new Date(ts)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

/* ---- 社区 5 大板块（网格视图入口）---- */
const FORUM_MODULES = [
  { key: 'all', label: '全部帖子', icon: LayoutGrid, desc: '社区里的所有帖子' },
  { key: 'entertainment', label: '娱乐', icon: Coffee, desc: '歌曲、段子、趣事分享' },
  { key: 'study', label: '学习', icon: GraduationCap, desc: '记忆妙招、学习方法' },
  { key: 'qa', label: '疑难', icon: HelpCircle, desc: '提问与解答互助' },
  { key: 'daily', label: '日常', icon: Sun, desc: '记录学习的每一天' },
] as const

/* ---- 各分类元信息（用于帖子标签 / 发帖选择）---- */
const CATEGORY_META: Record<string, { label: string; icon: typeof Coffee }> = {
  entertainment: { label: '娱乐', icon: Coffee },
  study: { label: '学习', icon: GraduationCap },
  qa: { label: '疑难', icon: HelpCircle },
  daily: { label: '日常', icon: Sun },
}

// 管理员账号：拥有删除所有评论、回复与帖子的权限
const ADMIN_USERNAME = '20051226'

export default function Community() {
  const { isAuthed, user, isAdmin } = useAuth()
  const { staggerInterval, staggerDistance, staggerEase } = useSettings()
  const staggerOpts = { stagger: staggerInterval, distance: staggerDistance, ease: staggerEase as keyof typeof STAGGER_EASE }
  const [activeModule, setActiveModule] = useState<string>('all')
  const [inModule, setInModule] = useState(false)

  return (
    <StaggerContainerEnter className="min-h-screen pb-24 pt-6" options={staggerOpts}>
      <div className="mx-auto w-full max-w-2xl px-4">
        <StaggerItemEnter>
          <header className="mb-4">
            <h1 className="text-2xl font-bold text-foreground">社区</h1>
            <p className="mt-1 text-xs text-muted-foreground">学习互助，共同进步</p>
          </header>
        </StaggerItemEnter>

        <StaggerItemEnter>
          {inModule ? (
            <ForumView
              category={activeModule}
              onBack={() => setInModule(false)}
              isAuthed={isAuthed} user={user} isAdmin={isAdmin}
            />
          ) : (
            <ModuleGrid onSelect={(k) => { setActiveModule(k); setInModule(true) }} />
          )}
        </StaggerItemEnter>
      </div>
    </StaggerContainerEnter>
  )
}

/* ===================================================================
   板块网格视图（5 个模块卡片，与「全部帖子」一致的横向卡片）
   =================================================================== */
function ModuleGrid({ onSelect }: { onSelect: (key: string) => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const all = await fetchForumPosts('all')
        const c: Record<string, number> = { all: all.length }
        all.forEach((p) => { c[p.category] = (c[p.category] || 0) + 1 })
        setCounts(c)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    })()
  }, [])

  return (
    <div className="flex flex-col gap-3">
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
  const [hotPosts, setHotPosts] = useState<ForumPost[]>([])

  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCat, setNewCat] = useState<string>(category !== 'all' ? category : 'study')
  const [posting, setPosting] = useState(false)

  const [postImages, setPostImages] = useState<{ preview: string; url?: string; uploading: boolean }[]>([])
  const postFileRef = useRef<HTMLInputElement>(null)

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

  // 今日热榜：按浏览量降序取前 10；浏览量相同则发布时间最早优先
  useEffect(() => {
    (async () => {
      try {
        const all = await fetchForumPosts('all')
        const base = category === 'all' ? all : all.filter((p) => p.category === category)
        const sorted = [...base]
          .sort((a, b) => (b.views - a.views) || (a.createdAt - b.createdAt))
          .slice(0, 10)
        setHotPosts(sorted)
      } catch { /* ignore */ }
    })()
  }, [category])

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
          onBack={() => { setDetailPost(null); void load() }}
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
                {Object.entries(CATEGORY_META).map(([key, meta]) => (
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
                {(isAuthed ? posts : posts.slice(0, 1)).map((p) => (
                  <ForumPostRow key={p._id} post={p} onClick={() => setDetailPost(p)} />
                ))}
              </div>
              {hotPosts.length > 0 && (
                <HotRanking posts={hotPosts} onSelect={(p) => setDetailPost(p)} />
              )}
            </>
          )}
        </>
      )}
    </>
  )
}

/* ---- 帖子行（列表版，全宽卡片）---- */
function ForumPostRow({ post, onClick }: { post: ForumPost; onClick: () => void }) {
  const meta = CATEGORY_META[post.category]
  return (
    <button onClick={onClick}
      className="flex w-full flex-col rounded-2xl border g-border g-panel p-3.5 text-left transition active:scale-[0.99] hover:g-panel">
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
        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-foreground/65">{post.content}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
          {post.authorAvatar ? (
            <img src={post.authorAvatar} className="h-4 w-4 rounded-full object-cover" alt="" />
          ) : (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted/40 text-[8px] font-bold text-muted-foreground">
              {(post.author || '?')[0]}
            </span>
          )}
          {post.author} · {timeAgo(post.createdAt)}
        </span>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70">
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
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{current.content}</p>
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
          {current.authorAvatar ? (
            <img src={current.authorAvatar} className="h-5 w-5 rounded-full object-cover" alt="" />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted/40 text-[10px] font-bold text-muted-foreground">
              {(current.author || '?')[0]}
            </span>
          )}
          <span>{current.author}</span><span>·</span><span>{timeAgo(current.createdAt)}</span>
          {canDeletePost && <button onClick={onDelete} className="ml-auto text-destructive hover:underline">删除</button>}
        </div>
        {/* 统计行 + 点赞 */}
        <div className="mt-3 flex items-center gap-4 border-t g-border pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {current.views}</span>
          <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {current.commentCount}</span>
          <button onClick={handleLike} className={cn('inline-flex items-center gap-1 transition', liked ? 'text-rose-500' : 'hover:text-rose-500')}>
            <Heart className={cn('h-4 w-4', liked && 'fill-rose-500')} /> {likeCount}
          </button>
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
      {c.authorAvatar ? (
        <img src={c.authorAvatar} className={cn(
          'mt-0.5 shrink-0 rounded-full object-cover',
          isReply ? 'h-6 w-6' : 'h-7 w-7'
        )} alt={c.author} />
      ) : (
        <div className={cn(
          'mt-0.5 flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
          isReply ? 'h-6 w-6 bg-muted/30 text-muted-foreground' : 'h-7 w-7 bg-primary/20 text-primary'
        )}>
          {(c.author || '?')[0]}
        </div>
      )}
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
