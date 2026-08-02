import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageCircle } from 'lucide-react';
import { fetchCommunity, commentImageUrl, type Comment } from '@/lib/comments';
import { ImageLightbox } from '@/components/ImageLightbox';
import { allWords } from '@/lib/words-data';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  const date = new Date(ts);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function wordLabel(wordId: number): { text: string; to: string } {
  if (wordId === -1) return { text: '留言板', to: '/community' };
  if (wordId === -2) return { text: '反馈', to: '/more' };
  if (wordId === -3) return { text: '学习分享', to: '/community' };
  const w = allWords.find((x) => x.id === wordId);
  if (w) return { text: w.word, to: `/browse` };
  return { text: '单词', to: '/browse' };
}

/** 首页「最近动态」：展示全站最新的单词评论，点击可进入对应词库 */
export function CommunityFeed() {
  const [list, setList] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCommunity()
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch((e) => console.error('[community] 加载失败', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const unique = useMemo(() => {
    const seen = new Set<string>();
    const out: Comment[] = [];
    for (const c of list) {
      if (seen.has(c._id)) continue;
      seen.add(c._id);
      out.push(c);
    }
    return out;
  }, [list]);

  return (
    <div className="liquid-glass mt-3 w-full max-w-2xl rounded-2xl p-4">
      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : unique.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground/70">还没有人评论，快来社区广场抢沙发～</p>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {unique.map((c) => {
            const lbl = wordLabel(c.wordId);
            return (
              <div key={c._id} className="flex items-start gap-2 rounded-xl g-panel px-3 py-2 text-sm">
                <Link
                  to={lbl.to}
                  className="mt-0.5 shrink-0 rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary"
                >
                  {lbl.text}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="break-words leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {c.replyToAuthor && (
                      <span className="mr-1 font-medium text-primary/80">回复 @{c.replyToAuthor}</span>
                    )}
                    {c.text}
                  </p>
                  {c.images && c.images.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {c.images.map((img, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setLightbox(commentImageUrl(img))}
                          className="overflow-hidden rounded-lg g-panel ring-1 g-ring"
                        >
                          <img src={commentImageUrl(img)} alt="评论附图" loading="lazy" className="h-20 w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground/60">
                    {c.author} · {timeAgo(c.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-muted-foreground/50">
        <MessageCircle className="h-3 w-3" /> 大家在单词下留下的记忆口诀与近义词
      </p>
      <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
