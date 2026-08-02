import { useState } from 'react';
import { Sparkles, Loader2, X, Target } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { aiPersonalSummary } from '@/lib/ai';
import { useStarred, useKnown } from '@/hooks/use-storage';
import { useDailyStats } from '@/hooks/use-daily-stats';
import { allWords } from '@/lib/words-data';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** AI 个人学习总结：基于真实数据给出温暖、可执行的中文建议 */
export function PersonalSummary({ open, onOpenChange }: Props) {
  const { starred } = useStarred();
  const { known } = useKnown();
  const { streak, dailyAverage, totalReviewed } = useDailyStats();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const generate = async () => {
    setLoading(true);
    setErr('');
    setText('');
    // 简化：基于 totalReviewed 推断 topPart
    const topPart = totalReviewed > 200
      ? '已进入多章节并行复习阶段'
      : totalReviewed > 50
        ? '已开启系统化学习'
        : '正在起步打基础';

    try {
      const out = await aiPersonalSummary({
        totalWords: allWords.length,
        totalReviewed,
        knownCount: known.size,
        starredCount: starred.size,
        streak,
        dailyAverage,
        topPart,
      });
      setText(out);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || '生成失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> AI 个人学习总结
          </DialogTitle>
          <DialogDescription>
            基于你的真实学习数据（已学 {totalReviewed} 词、掌握 {known.size} 词、连续 {streak} 天）生成建议
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {!text && !loading && (
            <div className="rounded-xl bg-primary/5 p-4 text-center">
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
              <p className="text-sm text-muted-foreground">点击下方按钮，让 AI 根据你的学习情况给出下一步方向</p>
              <Button onClick={generate} className="mt-3">
                <Sparkles className="h-4 w-4" /> 生成我的学习总结
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 rounded-xl g-panel px-4 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              AI 正在分析你的学习数据（5-10 秒）…
            </div>
          )}

          {text && (
            <div className="rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{text}</p>
            </div>
          )}

          {err && <p className="text-xs text-destructive">{err}</p>}

          {text && (
            <div className="flex gap-2">
              <Button onClick={generate} variant="outline" disabled={loading} className="flex-1">
                <Sparkles className="h-4 w-4" /> 重新生成
              </Button>
              <Button onClick={() => onOpenChange(false)} variant="ghost">
                <X className="h-4 w-4" /> 关闭
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
