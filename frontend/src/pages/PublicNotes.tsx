import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Loader2, Send, Trash2, EyeOff, Eye, Plus, Edit3, Image as ImageIcon, X } from 'lucide-react'
import {
  fetchPublicNotes, addPublicNote, updatePublicNote, deletePublicNote,
  unhidePublicNote, type PublicNote,
} from '@/lib/publicNotes'
import { uploadCommentImage, commentImageUrl } from '@/lib/comments'
import { ImageLightbox } from '@/components/ImageLightbox'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { compressImageResilient } from '@/lib/image'
import { getErrorMessage } from '@/lib/api-client'

const MAX_IMAGES = 9

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

export default function PublicNotes() {
  const [notes, setNotes] = useState<PublicNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isAuthed, isAdmin, user } = useAuth()

  // 编辑器状态
  const [editing, setEditing] = useState<PublicNote | 'new' | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [posting, setPosting] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchPublicNotes()
      setNotes(list)
    } catch {
      setError('加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openNew = () => {
    setTitle('')
    setContent('')
    setPendingImages([])
    setEditing('new')
  }

  const openEdit = (n: PublicNote) => {
    setTitle(n.title)
    setContent(n.content)
    setPendingImages(n.images ? [...n.images] : [])
    setEditing(n)
  }

  const closeEditor = () => {
    setEditing(null)
    setTitle('')
    setContent('')
    setPendingImages([])
  }

  const handlePickImages = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const room = MAX_IMAGES - pendingImages.length
    if (room <= 0) {
      setError(`最多 ${MAX_IMAGES} 张图片`)
      return
    }
    const picked = Array.from(files).slice(0, room)
    // 逐张韧性压缩：单张失败不影响其余，确保图库/大图也能尽量发出去
    const results = await Promise.allSettled(picked.map((f) => compressImageResilient(f)))
    const ok = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map((r) => r.value)
    const failedN = results.length - ok.length
    if (ok.length) setPendingImages((prev) => [...prev, ...ok])
    setError(failedN ? `${failedN} 张图片处理失败已跳过，其余已添加` : null)
  }, [pendingImages.length])

  const removePending = useCallback((idx: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const submit = async () => {
    const t = title.trim()
    const c = content.trim()
    if (!t || (!c && pendingImages.length === 0) || posting) return
    setPosting(true)
    setError(null)
    try {
      // 先上传图片，拿到相对路径；再连同文字一起提交（避免孤儿文件）
      let imageUrls: string[] = []
      if (pendingImages.length) {
        imageUrls = await Promise.all(
          pendingImages.map(async (d) => {
            try {
              return await uploadCommentImage(d)
            } catch {
              return await uploadCommentImage(d) // 上传失败重试一次
            }
          })
        )
      }
      if (editing === 'new') {
        await addPublicNote(t, c, imageUrls)
      } else if (editing && typeof editing !== 'string') {
        await updatePublicNote(editing._id, { title: t, content: c, images: imageUrls })
      }
      closeEditor()
      await load()
    } catch (e) {
      setError(getErrorMessage(e) || '操作失败，请稍后重试')
    } finally {
      setPosting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除这条笔记吗？')) return
    try {
      await deletePublicNote(id)
      setNotes((prev) => prev.filter((n) => n._id !== id))
    } catch {
      alert('删除失败，请确认权限')
    }
  }

  const handleUnhide = async (id: string) => {
    try {
      const updated = await unhidePublicNote(id)
      setNotes((prev) => prev.map((n) => (n._id === id ? { ...n, ...updated } : n)))
    } catch {
      alert('取消隐藏失败，请确认管理员权限')
    }
  }

  // 编辑器 JSX
  const editorNode = editing !== null && (
    <div className="liquid-glass liquid-glass-strong mb-4 rounded-2xl p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={50}
        placeholder="笔记标题"
        className="mb-3 w-full rounded-xl border g-border g-panel px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={5000}
        rows={5}
        placeholder="分享你的学习方法、记忆口诀或备考心得…"
        className="w-full resize-none rounded-xl border g-border g-panel px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50"
      />
      {/* 图片选择 + 缩略图预览 */}
      {pendingImages.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {pendingImages.map((img, i) => (
            <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg ring-1 g-ring">
              <img src={img} alt="待发送" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePending(i)}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white transition hover:bg-black/80"
                title="移除"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pendingImages.length >= MAX_IMAGES}
          className={cn(
            'flex items-center gap-1.5 rounded-xl border g-border px-3 py-2 text-sm transition active:scale-95',
            pendingImages.length >= MAX_IMAGES
              ? 'cursor-not-allowed text-muted-foreground/30'
              : 'text-muted-foreground hover:g-panel'
          )}
          title="添加图片"
        >
          <ImageIcon className="h-4 w-4" />
          图片
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void handlePickImages(e.target.files)
            e.target.value = ''
          }}
        />
        <div className="flex-1" />
        <button
          onClick={closeEditor}
          className="rounded-xl border g-border g-panel px-4 py-2 text-sm text-muted-foreground transition active:scale-95"
        >
          取消
        </button>
        <button
          onClick={submit}
          disabled={posting || !title.trim() || (!content.trim() && pendingImages.length === 0)}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition active:scale-95',
            title.trim() && (content.trim() || pendingImages.length > 0) && !posting
              ? 'bg-primary text-primary-foreground'
              : 'cursor-not-allowed g-panel text-muted-foreground/40'
          )}
        >
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {editing === 'new' ? '发表' : '保存'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="hv-fade space-y-3 pt-2">
      <header className="mb-1">
        <h1 className="text-xl font-bold text-foreground">公共笔记</h1>
        <p className="text-xs text-muted-foreground/70">大家的学习方法、记忆口诀与备考心得，登录后可分享</p>
      </header>

      {/* 发表按钮 */}
      {isAuthed && !editing && (
        <button
          onClick={openNew}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed g-border py-3 text-sm text-muted-foreground transition-all hover:g-panel active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" />
          分享我的笔记
        </button>
      )}

      {/* 未登录提示 */}
      {!isAuthed && (
        <div className="rounded-2xl border g-border bg-card px-4 py-3 text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">登录</Link> 后可以分享自己的学习笔记
        </div>
      )}

      {editorNode}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* 笔记列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-2xl border g-border bg-card px-4 py-10 text-center text-sm text-muted-foreground/70">
          <BookOpen className="mx-auto mb-2 h-6 w-6 text-muted-foreground/30" />
          还没有人分享笔记，来做第一个贡献者吧～
        </div>
      ) : (
        <>
          {!isAuthed && notes.length > 1 && (
            <Link
              to="/login"
              className="flex items-center justify-center rounded-xl g-panel px-4 py-2.5 text-sm text-muted-foreground"
            >
              登录后查看更多笔记
            </Link>
          )}
          <div className="space-y-3">
            {(isAuthed ? notes : notes.slice(0, 1)).map((n) => (
              <div
                key={n._id}
                className={cn(
                  'rounded-2xl border p-4 transition',
                  n.hidden
                    ? 'border-destructive/40 bg-destructive/10'
                    : 'g-border bg-card'
                )}
              >
                {/* 隐藏标记（管理员可见） */}
                {n.hidden && isAdmin && (
                  <div className="mb-2 flex items-center gap-1 text-[11px] font-medium text-destructive">
                    <EyeOff className="h-3 w-3" />
                    <span>已隐藏（疑似违规）</span>
                    {n.flagReason && <span className="text-destructive/70">· {n.flagReason}</span>}
                  </div>
                )}
                <h3 className={cn('text-sm font-semibold', n.hidden && 'line-through decoration-destructive/50')}>
                  {n.title}
                </h3>
                <p className={cn(
                  'mt-1.5 line-clamp-3 text-xs leading-relaxed text-foreground/75',
                  n.hidden && 'line-through decoration-destructive/50'
                )}>
                  {n.content}
                </p>
                {Array.isArray(n.images) && n.images.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {n.images.map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setLightbox(commentImageUrl(img))}
                        className="overflow-hidden rounded-lg g-panel ring-1 g-ring"
                      >
                        <img src={commentImageUrl(img)} alt="笔记附图" loading="lazy" className="h-20 w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground/60">
                    {n.author} · {timeAgo(n.updatedAt)}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {isAdmin && n.hidden && (
                      <button
                        onClick={() => handleUnhide(n._id)}
                        className="rounded-lg p-1 text-muted-foreground transition-colors hover:g-panel hover:text-primary"
                        title="取消隐藏（管理员）"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {(isAdmin || n.author === user) && (
                      <>
                        <button
                          onClick={() => openEdit(n)}
                          className="rounded-lg p-1 text-muted-foreground transition-colors hover:g-panel hover:text-primary"
                          title="编辑"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(n._id)}
                          className="rounded-lg p-1 text-muted-foreground transition-colors hover:g-panel hover:text-destructive"
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  )
}
