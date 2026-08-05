import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Trash2, MessageCircle, Send, Loader2, EyeOff, Eye, CornerDownRight, X, Image as ImageIcon,
} from 'lucide-react';
import {
  fetchComments, addComment, deleteComment, unhideComment, uploadCommentImage, commentImageUrl, type Comment,
} from '@/lib/comments';
import { ImageLightbox } from '@/components/ImageLightbox';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { compressImageResilient } from '@/lib/image';
import { getErrorMessage } from '@/lib/api-client';
import { timeAgoShort } from '@/lib/time';

interface WordCommentsProps {
  wordId: number;
  wordText?: string;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  emptyText?: string;
  /** 精简模式：去掉外层玻璃卡片，用于沉浸式学习卡片内嵌 */
  bare?: boolean;
  /** 输入框的 data-testid，便于自动化测试区分不同评论区 */
  inputTestId?: string;
}

function timeAgo(ts: number): string {
  return timeAgoShort(ts);
}

/** 递归求一条评论所属的「根评论」ID（用于把任意层级的回复都归到根评论下，避免无限缩进） */
function rootIdOf(c: Comment, byId: Map<string, Comment>): string {
  let cur = c;
  const seen = new Set<string>();
  while (cur.parentId && seen.size < 16) {
    if (seen.has(cur._id)) break;
    seen.add(cur._id);
    const parent = byId.get(cur.parentId);
    if (!parent) break;
    cur = parent;
  }
  return cur._id;
}

const MAX_IMAGES = 9;

/** 评论组件：支持单词短语 / 近义词、网站反馈建议；支持「回复」（抖音式嵌套）与「附图」；鉴权可选（游客也可发表） */
export function WordComments({
  wordId,
  wordText = '',
  title,
  subtitle,
  placeholder,
  emptyText,
  bare = false,
  inputTestId = 'comment-input',
}: WordCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<{ parentId: string; author: string } | null>(null);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const { isAuthed, isAdmin, user } = useAuth();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const headerTitle = title ?? '大家的灵光一现';
  const headerSubtitle = subtitle ?? (wordText ? `关于 “${wordText}” 的短语 / 近义词 / 记忆口诀` : '');
  const inputPlaceholder = placeholder ?? '想到相关短语或近义词？写下来分享给大家…';
  const emptyMsg = emptyText ?? '还没有人评论，来做第一个分享的人吧～';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchComments(wordId);
      setComments(list);
    } catch (e) {
      console.error('[comments] 读取失败', e);
      setError('评论加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [wordId]);

  useEffect(() => {
    void load();
  }, [load]);

  const startReply = useCallback(
    (c: Comment, byId: Map<string, Comment>) => {
      const pid = rootIdOf(c, byId);
      setReplyTarget({ parentId: pid, author: c.author });
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    },
    []
  );

  const cancelReply = useCallback(() => setReplyTarget(null), []);

  const handlePickImages = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_IMAGES - pendingImages.length;
    if (room <= 0) {
      setError(`最多 ${MAX_IMAGES} 张图片`);
      return;
    }
    const picked = Array.from(files).slice(0, room);
    // 逐张韧性压缩：单张失败不影响其余，确保图库/大图也能尽量发出去
    const results = await Promise.allSettled(picked.map((f) => compressImageResilient(f)));
    const ok = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map((r) => r.value);
    const failedN = results.length - ok.length;
    if (ok.length) setPendingImages((prev) => [...prev, ...ok]);
    setError(failedN ? `${failedN} 张图片处理失败已跳过，其余已添加` : null);
  }, [pendingImages.length]);

  const removePending = useCallback((idx: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  /** 把一条（乐观/重试）评论真正提交到服务器：逐张上传图片（失败重试一次），成功用服务器返回替换临时条目，失败标记 failed 可重试 */
  const persistComment = useCallback(
    async (optimistic: Comment): Promise<boolean> => {
      setComments((prev) =>
        prev.map((c) => (c._id === optimistic._id ? { ...c, pending: true, failed: false } : c))
      );
      try {
        let imageUrls: string[] = [];
        if (optimistic.images && optimistic.images.length) {
          imageUrls = await Promise.all(
            optimistic.images.map(async (d) => {
              try {
                return await uploadCommentImage(d);
              } catch {
                return await uploadCommentImage(d); // 上传失败重试一次
              }
            })
          );
        }
        const opts: { parentId?: string; replyToAuthor?: string; images?: string[] } = {};
        if (optimistic.parentId) opts.parentId = optimistic.parentId;
        if (optimistic.replyToAuthor) opts.replyToAuthor = optimistic.replyToAuthor.slice(0, 16);
        if (imageUrls.length) opts.images = imageUrls;
        const saved = await addComment(
          wordId,
          optimistic.text,
          optimistic.author,
          Object.keys(opts).length ? opts : undefined
        );
        // 用服务器返回的真实评论替换临时条目（含真实图片 URL、_id、审核状态）
        setComments((prev) => prev.map((c) => (c._id === optimistic._id ? { ...saved } : c)));
        return true;
      } catch (e) {
        console.error('[comments] 发表失败', e);
        setComments((prev) =>
          prev.map((c) => (c._id === optimistic._id ? { ...c, pending: false, failed: true } : c))
        );
        setError(getErrorMessage(e) || '发送失败，请稍后重试');
        return false;
      }
    },
    [wordId]
  );

  const submit = async () => {
    const value = text.trim();
    if ((!value && pendingImages.length === 0) || posting) return;
    setPosting(true);
    setError(null);
    // 乐观插入：先以「发送中」态本地上屏，服务器确认后再转正，失败可重试且保留图片
    const optimistic: Comment = {
      _id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      wordId,
      text: value,
      author: user || '游客',
      createdAt: Date.now(),
      pending: true,
      parentId: replyTarget?.parentId,
      replyToAuthor: replyTarget?.author,
      images: pendingImages.length ? [...pendingImages] : undefined,
    };
    setComments((prev) => [...prev, optimistic]);
    setText('');
    setPendingImages([]);
    setReplyTarget(null);
    const ok = await persistComment(optimistic);
    setPosting(false);
    if (!ok) inputRef.current?.focus();
  };

  const handleUnhide = async (id: string) => {
    try {
      const updated = await unhideComment(id);
      setComments((prev) => prev.map((c) => (c._id === id ? { ...c, ...updated } : c)));
    } catch {
      alert('取消隐藏失败，请确认管理员权限');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除这条评论吗？')) return;
    try {
      await deleteComment(id);
      setComments((prev) => prev.filter((c) => c._id !== id));
    } catch {
      alert('删除失败，请确认权限');
    }
  };

  // 构建索引：根评论列表 + 根评论下的回复分组
  const { byId, topLevel, repliesByRoot } = useMemo(() => {
    const map = new Map<string, Comment>();
    for (const c of comments) map.set(c._id, c);
    const tops: Comment[] = [];
    const replies = new Map<string, Comment[]>();
    for (const c of comments) {
      if (!c.parentId) {
        tops.push(c);
      } else {
        const rid = rootIdOf(c, map);
        if (!replies.has(rid)) replies.set(rid, []);
        replies.get(rid)!.push(c);
      }
    }
    tops.sort((a, b) => a.createdAt - b.createdAt);
    for (const arr of replies.values()) arr.sort((a, b) => a.createdAt - b.createdAt);
    return { byId: map, topLevel: tops, repliesByRoot: replies };
  }, [comments]);

  const renderImages = (imgs: string[] | undefined) => {
    if (!imgs || imgs.length === 0) return null;
    return (
      <div
        className={cn(
          'mt-2 grid gap-1.5',
          imgs.length === 1 ? 'grid-cols-1 max-w-[240px]' : 'grid-cols-3'
        )}
      >
        {imgs.map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setLightbox(commentImageUrl(img))}
            className="overflow-hidden rounded-lg g-panel ring-1 g-ring transition hover:ring-primary/50"
          >
            <img
              src={commentImageUrl(img)}
              alt="评论附图"
              loading="lazy"
              className="h-24 w-full object-cover"
            />
          </button>
        ))}
      </div>
    );
  };

  const renderItem = (c: Comment, isReply: boolean) => (
    <div
      key={c._id}
      className={cn(
        'flex items-start gap-2 rounded-xl border px-3 py-2 text-sm',
        c.pending && 'opacity-60',
        c.hidden
          ? 'border-destructive/40 bg-destructive/10 text-foreground/70'
          : 'g-border g-panel text-foreground/90'
      )}
    >
      {isReply && <CornerDownRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />}
      <div className="min-w-0 flex-1">
        {c.hidden && (
          <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-destructive">
            <EyeOff className="h-3 w-3" />
            <span>已隐藏（疑似违规）</span>
            {c.flagReason && <span className="text-destructive/70">· {c.flagReason}</span>}
          </div>
        )}
        {c.text && (
          <p className={cn('leading-relaxed break-words whitespace-pre-wrap', c.hidden && 'line-through decoration-destructive/50')}>
            {c.replyToAuthor && (
              <span className="mr-1 font-medium text-primary/80">回复 @{c.replyToAuthor}</span>
            )}
            {c.text}
          </p>
        )}
        {renderImages(c.images)}
        {(c.pending || c.failed) && (
          <div className="mt-1 flex items-center gap-2 text-[11px]">
            {c.pending ? (
              <span className="flex items-center gap-1 text-muted-foreground/70">
                <Loader2 className="h-3 w-3 animate-spin" /> 发送中…
              </span>
            ) : (
              <>
                <span className="font-medium text-destructive">发送失败</span>
                <button
                  type="button"
                  onClick={() => void persistComment(c)}
                  className="rounded px-1 py-0.5 font-medium text-primary transition-colors hover:g-panel"
                >
                  重试
                </button>
                <button
                  type="button"
                  onClick={() => setComments((prev) => prev.filter((x) => x._id !== c._id))}
                  className="rounded px-1 py-0.5 font-medium text-muted-foreground transition-colors hover:g-panel"
                >
                  删除
                </button>
              </>
            )}
          </div>
        )}
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/60">
          <span>{c.author}</span>
          <span>·</span>
          <span>{timeAgo(c.createdAt)}</span>
          <button
            onClick={() => startReply(c, byId)}
            className="ml-1 rounded px-1 py-0.5 font-medium text-primary/70 transition-colors hover:g-panel hover:text-primary"
          >
            回复
          </button>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {isAdmin && c.hidden && (
          <button
            onClick={() => handleUnhide(c._id)}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:g-panel hover:text-primary"
            title="取消隐藏（管理员）"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
        {(isAdmin || c.author === user) && (
          <button
            onClick={() => handleDelete(c._id)}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:g-panel hover:text-destructive"
            title={isAdmin && c.author !== user ? '删除评论（管理员）' : '删除我的评论'}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  const listNode = (
    <div className={cn(bare ? 'max-h-72' : 'max-h-[22rem]', 'space-y-2 overflow-y-auto pr-1')}>
      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : topLevel.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground/70">{emptyMsg}</p>
      ) : (
        <>
          {!isAuthed && topLevel.length > 1 && (
            <Link
              to="/login"
              className="flex items-center justify-center rounded-xl g-panel px-4 py-2.5 text-sm text-muted-foreground"
            >
              登录后查看更多评论
            </Link>
          )}
          {(isAuthed ? topLevel : topLevel.slice(0, 1)).map((c) => (
            <div key={c._id}>
              {renderItem(c, false)}
              {(() => {
                const reps = repliesByRoot.get(c._id);
                if (!reps || reps.length === 0) return null;
                return (
                  <div className="ml-4 mt-1 space-y-1 border-l g-border pl-2">
                    {reps.map((r) => renderItem(r, true))}
                  </div>
                );
              })()}
            </div>
          ))}
        </>
      )}
    </div>
  );

  const inputNode = (
    <div className="mt-3">
      {replyTarget && (
        <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground/80">
          <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
            回复 @{replyTarget.author}
          </span>
          <button
            onClick={cancelReply}
            className="rounded-full p-0.5 text-muted-foreground/60 transition-colors hover:g-panel hover:text-foreground"
            title="取消回复"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {pendingImages.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
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
      <div className="flex items-start gap-2">
        <div className="relative flex-1">
          <textarea
            ref={inputRef}
            value={text}
            data-testid={inputTestId}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl/Cmd + Enter 发送；普通 Enter 保留为换行
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder={replyTarget ? `回复 @${replyTarget.author}…` : inputPlaceholder}
            className="min-h-[2.5rem] w-full resize-none rounded-xl g-panel px-3 py-2 pr-10 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pendingImages.length >= MAX_IMAGES}
            className={cn(
              'absolute bottom-2 right-2 rounded-lg p-1.5 transition-colors',
              pendingImages.length >= MAX_IMAGES
                ? 'cursor-not-allowed text-muted-foreground/30'
                : 'text-muted-foreground hover:g-panel hover:text-primary'
            )}
            title="添加图片"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void handlePickImages(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
        <button
          onClick={submit}
          data-testid="comment-send"
          disabled={posting || (!text.trim() && pendingImages.length === 0)}
          className={cn(
            'flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm transition-all active:scale-95',
            (text.trim() || pendingImages.length > 0) && !posting
              ? 'bg-primary text-primary-foreground'
              : 'cursor-not-allowed g-panel text-muted-foreground/40'
          )}
        >
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          发送
        </button>
      </div>
    </div>
  );

  const headerNode = (
    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
      <MessageCircle className="h-4 w-4 text-primary" />
      <span>{headerTitle}</span>
      {headerSubtitle && <span className="text-xs text-muted-foreground/70">{headerSubtitle}</span>}
    </div>
  );

  return (
    <>
      {bare ? (
        <div className="w-full">
          {headerNode}
          {listNode}
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          {inputNode}
          {!isAuthed && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground/60">
              以游客身份发表 · <Link to="/login" className="text-primary hover:underline">登录</Link> 后显示你的昵称
            </p>
          )}
        </div>
      ) : (
        <div className="liquid-glass liquid-glass-strong mt-6 w-full max-w-2xl rounded-2xl p-5">
          {headerNode}
          {listNode}
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          {inputNode}
          {!isAuthed && (
            <p className="mt-3 text-center text-xs text-muted-foreground/70">
              以游客身份发表 · <Link to="/login" className="text-primary hover:underline">登录</Link> 后显示你的昵称
            </p>
          )}
        </div>
      )}
      <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
