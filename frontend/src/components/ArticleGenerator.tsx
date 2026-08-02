import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, X, BookOpen, FileText, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { aiGenerateArticle } from '@/lib/ai';
import { allWords } from '@/lib/words-data';
import { useKnown, useStarred, useSavedArticles } from '@/hooks/use-storage';
import type { SavedArticle } from '@/lib/authApi';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const TARGETS = [
  { value: 60, label: '短文 ~60词', desc: '快速阅读' },
  { value: 120, label: '中篇 ~120词', desc: '巩固练习' },
  { value: 200, label: '长文 ~200词', desc: '综合运用' },
] as const

/** 生成稳定的文章 id（优先用 crypto.randomUUID） */
function makeArticleId(): string {
  const c: any = (globalThis as any).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** AI 英语文章生成：基于已学（已掌握/已收藏）单词生成可读文章 */
export function ArticleGenerator({ open, onOpenChange }: Props) {
  const { known } = useKnown()
  const { starred } = useStarred()
  const { add: saveArticle } = useSavedArticles()
  const navigate = useNavigate()
  const [target, setTarget] = useState<number>(120)
  const [theme, setTheme] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ title: string; content: string; usedWords: string[] } | null>(null)
  const [err, setErr] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)

  // 收集「已学」单词的 word 字段
  const learnedWords = useMemo(() => {
    const set = new Set<string>()
    // 优先用已掌握
    known.forEach((id) => {
      const w = allWords.find((x) => x.id === id)
      if (w) set.add(w.word)
    })
    // 其次用已收藏（当已知不足 30 个时补充）
    if (set.size < 30) {
      starred.forEach((id) => {
        const w = allWords.find((x) => x.id === id)
        if (w) set.add(w.word)
      })
    }
    return Array.from(set)
  }, [known, starred])

  const generate = async () => {
    if (learnedWords.length < 5) {
      setErr('已学单词太少（至少需要 5 个已掌握或已收藏的单词）。先去浏览或测验掌握一些单词吧～')
      return
    }
    setLoading(true)
    setErr('')
    setResult(null)
    setSavedId(null)
    try {
      const out = await aiGenerateArticle({
        learnedWords,
        targetWords: target,
        title: theme.trim() || undefined,
      })
      setResult(out)
      // 自动存入「我的收藏」（本地 + 已登录时同步云端）
      const article: SavedArticle = {
        id: makeArticleId(),
        title: out.title || 'Untitled',
        content: out.content,
        usedWords: out.usedWords || [],
        target,
        theme: theme.trim() || '无主题',
        createdAt: Date.now(),
      }
      saveArticle(article)
      setSavedId(article.id)
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || '生成失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> AI 英语文章生成
          </DialogTitle>
          <DialogDescription>
            基于你已掌握的 {learnedWords.length} 个单词生成可读英语文章
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 词数选择 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">选择文章词数</label>
            <div className="grid grid-cols-3 gap-2">
              {TARGETS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTarget(t.value)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                    target === t.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'g-border g-panel text-muted-foreground hover:g-panel'
                  }`}
                >
                  <div className="text-sm font-semibold">{t.label}</div>
                  <div className="text-[11px] opacity-70">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 主题可选 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">主题（可选）</label>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="例：my daily life / travel / food"
              className="liquid-glass h-10 w-full rounded-lg g-panel px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
            />
          </div>

          {!result && !loading && (
            <Button onClick={generate} disabled={learnedWords.length < 5} className="w-full">
              <BookOpen className="h-4 w-4" /> 生成文章
            </Button>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 rounded-xl g-panel px-4 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              AI 正在根据你的 {learnedWords.length} 个已学单词写文章（10-20 秒）…
            </div>
          )}

          {err && <p className="text-xs text-destructive">{err}</p>}

          {result && (
            <div className="space-y-3">
              <div className="rounded-xl border g-border g-panel p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-foreground">{result.title}</h3>
                  {savedId && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                      <Check className="h-3 w-3" /> 已存入收藏
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {result.content}
                </p>
              </div>
              {result.usedWords.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">
                    覆盖已学单词 <span className="text-primary">{result.usedWords.length}</span> 个：
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {result.usedWords.map((w) => (
                      <span key={w} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={generate} variant="outline" disabled={loading} className="flex-1">
                  <BookOpen className="h-4 w-4" /> 再生成一篇
                </Button>
                <Button
                  onClick={() => {
                    onOpenChange(false)
                    navigate('/starred?tab=favorites')
                  }}
                  variant="ghost"
                  className="text-primary"
                >
                  <FileText className="h-4 w-4" /> 我的收藏
                </Button>
                <Button onClick={() => onOpenChange(false)} variant="ghost">
                  <X className="h-4 w-4" /> 关闭
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
