import { Star, Volume2 } from 'lucide-react';
import type { Word } from '@/types/word';
import { cn } from '@/lib/utils';
import { speakWord } from '@/lib/speak';

interface WordCardProps {
  word: Word;
  starred?: boolean;
  known?: boolean;
  onToggleStar?: (id: number) => void;
  onClick?: (word: Word) => void;
  compact?: boolean;
}

/** 单词展示卡片 — 液态玻璃风格 */
export function WordCard({ word, starred, known, onToggleStar, onClick, compact }: WordCardProps) {
  const speak = (e: React.MouseEvent) => {
    e.stopPropagation();
    speakWord(word.word);
  };

  return (
    <div
      className={cn(
        'liquid-glass liquid-glass-shine group cursor-pointer p-4',
        known && 'liquid-glass-accent'
      )}
      style={{ borderRadius: 'calc(var(--radius) + 4px)' }}
      onClick={() => onClick?.(word)}
    >
      <div className="relative z-[2] mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-foreground transition-colors group-hover:text-primary"
              style={{ fontSize: 'var(--font-size-title)' }}
            >
              {word.word}
            </h3>
            <button
              onClick={speak}
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-all hover:g-panel hover:text-primary active:scale-90"
              aria-label="发音"
            >
              <Volume2 className="h-4 w-4" />
            </button>
          </div>
          {word.phonetic && (
            <p className="mt-0.5 font-mono text-sm text-muted-foreground">{word.phonetic}</p>
          )}
        </div>
        {onToggleStar && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(word.id);
            }}
            className={cn(
              'shrink-0 rounded-md p-1.5 transition-all active:scale-90',
              starred ? 'text-warning' : 'text-muted-foreground hover:g-panel hover:text-warning'
            )}
            aria-label="收藏"
          >
            <Star className={cn('h-5 w-5 transition-transform', starred && 'fill-current scale-110')} />
          </button>
        )}
      </div>
      {!compact && (
        <p className="relative z-[2] text-sm leading-relaxed text-card-foreground/90" style={{ opacity: 0.85 }}>
          {word.meaning}
        </p>
      )}
      <div className="relative z-[2] mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-md g-panel px-2 py-0.5 backdrop-blur-sm">{word.part}</span>
        <span className="rounded-md g-panel px-2 py-0.5 backdrop-blur-sm">{word.list}</span>
      </div>
    </div>
  );
}
