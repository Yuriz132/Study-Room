import { useState } from 'react';
import confusables from '@/assets/confusables.json';
import type { Confusable } from '@/types/word';
import { cn } from '@/lib/utils';
import { FlyIn, Stagger } from '@/components/MotionPrimitives';

const data = confusables as Confusable[];

function ConfusableCard({ item }: { item: Confusable }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div
      className={cn('flip-card h-72 w-full cursor-pointer', flipped && 'flipped')}
      onClick={() => setFlipped((f) => !f)}
    >
      <div className="flip-card-inner">
        {/* 正面：易混词 */}
        <div className="flip-card-face liquid-glass flex flex-col p-6" style={{ borderRadius: 'calc(var(--radius) + 12px)' }}>
          <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">易混词</div>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            {item.words.map((w, i) => (
              <div key={w}>
                <span className="text-2xl font-bold text-foreground text-gradient">{w}</span>
                {i < item.words.length - 1 && <span className="mx-2 text-muted-foreground">/</span>}
              </div>
            ))}
          </div>
          <p className="pt-2 text-center text-xs text-muted-foreground/60">点击查看辨析</p>
        </div>
        {/* 背面：辨析 + 例句 */}
        <div className="flip-card-face flip-card-back liquid-glass-accent liquid-glass flex flex-col p-6" style={{ borderRadius: 'calc(var(--radius) + 12px)' }}>
          <p className="flex-1 overflow-y-auto text-sm leading-relaxed text-foreground/90">{item.distinction}</p>
          {item.examples && item.examples.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t g-border pt-3">
              {item.examples.map((ex) => (
                <p key={ex.word} className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-primary">{ex.word}</span>：{ex.text}
                </p>
              ))}
            </div>
          )}
          <p className="pt-2 text-center text-xs text-muted-foreground/60">点击翻回</p>
        </div>
      </div>
    </div>
  );
}

export default function Confusables() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <FlyIn>
        <h1 className="mb-1 font-bold text-foreground" style={{ fontSize: 'var(--font-size-headline)' }}>
          近义词 / 形近词辨析
        </h1>
        <p className="mb-6 text-muted-foreground">英语学习室常考的易混词，点击卡片查看区别与例句</p>
      </FlyIn>
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.08}>
        {data.map((item, i) => (
          <ConfusableCard key={i} item={item} />
        ))}
      </Stagger>
    </div>
  );
}
