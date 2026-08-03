import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { allWords } from "@/lib/words-data";
import { useKnown, useReviews } from "@/hooks/use-storage";
import { useDailyStats } from "@/hooks/use-daily-stats";
import { aiDailyProverb, PROVERB_FALLBACKS, type Proverb } from "@/lib/ai";
import ReviewReminder from "@/components/ReviewReminder";
import { useSettings } from "@/context/SettingsContext";
import { StaggerContainerEnter, StaggerItemEnter, ANIMATION_PRESETS } from "@/components/MotionPrimitives";

/**
 * 首页 — 极简单屏（不滚动）：顶栏标题 + 中间每日箴言 + 底部今日概览与 Learning/Review 入口。
 * 背景由 body 主题渐变提供（不叠加 DailyWallpaper），浅色/深色都自然美观。
 */
export default function Index() {
  const navigate = useNavigate();
  const { known } = useKnown();
  const { dueToday } = useReviews();
  const { streak, todayReviewed, totalReviewed } = useDailyStats();
  const { proverbEnabled, animationPreset } = useSettings();
  const preset = ANIMATION_PRESETS[animationPreset];
  const staggerOpts = { stagger: preset.stagger, distance: preset.distance, ease: preset.ease };

  const toLearn = useMemo(() => allWords.filter((w) => !known.has(w.id)).length, [known]);
  const dueCount = dueToday();

  const [proverb, setProverb] = useState<Proverb>({ en: "", zh: "" });
  const [proverbLoading, setProverbLoading] = useState(false);

  useEffect(() => {
    if (!proverbEnabled) {
      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      setProverb({ en: "Practice makes perfect.", zh: mm + "·" + dd + " · 今天是新的开始" });
      return;
    }
    const PROVERB_KEY = "liquid-words:proverb";
    let cancelled = false;
    const today = new Date().toISOString().slice(0, 10);
    try {
      const raw = localStorage.getItem(PROVERB_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj.date === today && obj.data?.en) {
          setProverb(obj.data);
          setProverbLoading(false);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setProverbLoading(true);
    aiDailyProverb()
      .then((p) => {
        if (cancelled) return;
        try {
          localStorage.setItem(PROVERB_KEY, JSON.stringify({ date: today, data: p }));
        } catch {
          /* ignore */
        }
        setProverb(p);
      })
      .catch(() => {
        if (!cancelled) setProverb(PROVERB_FALLBACKS[Math.floor(Math.random() * PROVERB_FALLBACKS.length)]);
      })
      .finally(() => {
        if (!cancelled) setProverbLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [proverbEnabled]);

  return (
    <div className="fixed inset-0 z-0 flex flex-col overflow-hidden bg-[var(--background)]">
      <StaggerContainerEnter className="relative z-10 flex h-full flex-col" options={staggerOpts}>
        {/* 顶栏 */}
        <StaggerItemEnter>
          <header className="flex shrink-0 items-center gap-3 px-5 pt-11 pb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border g-border g-panel bg-card text-base shadow-lg">📖</div>
            <div>
              <h1 className="text-lg font-bold text-foreground">英语学习室</h1>
            </div>
          </header>
        </StaggerItemEnter>

        {/* 每日箴言 — 居页面中间（flex-1 吸收上下剩余空间，垂直居中） */}
        <StaggerItemEnter className="flex-1 px-5">
          <section className="flex h-full flex-col items-center justify-center">
            <p className="mb-1.5 text-[10px] tracking-widest text-muted-foreground/60 uppercase">Daily Proverb</p>
            {proverbLoading ? (
              <div className="h-12 w-3/4 animate-pulse rounded-xl g-panel" />
            ) : (
              <>
                <p className="text-center text-xl font-semibold leading-snug text-foreground">{proverb.en}</p>
                <p className="mt-2 text-center text-sm text-muted-foreground/80">{proverb.zh}</p>
              </>
            )}
          </section>
        </StaggerItemEnter>

        {/* 底部区块：今日概览 + 学习/复习入口（贴底，避让导航栏） */}
        <div className="shrink-0 px-5 pb-[max(5rem,calc(env(safe-area-inset-bottom)+4rem))]">
          {/* 今日概览 — 紧凑 4 项 */}
          <StaggerItemEnter>
            <section className="grid grid-cols-4 gap-2">
              <MiniStat label="Streak" value={`${streak}d`} />
              <MiniStat label="Today" value={`${todayReviewed}`} />
              <MiniStat label="Total" value={`${totalReviewed}`} />
              <MiniStat label="Due" value={`${dueCount}`} highlight={dueCount > 0} />
            </section>
          </StaggerItemEnter>

          {/* 学习 + 复习 双卡片（英文命名，文字居中） */}
          <StaggerItemEnter>
            <section className="mt-3 grid grid-cols-2 gap-2.5">
              <button
                onClick={() => navigate("/immersive")}
                className="group flex flex-col items-center justify-center overflow-hidden rounded-2xl border g-border g-panel px-4 py-5 text-center transition-all active:scale-[0.97] hover:g-panel"
              >
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Learning</div>
                <div className="mt-1 text-3xl font-extrabold leading-none text-amber-500 dark:text-amber-300">{toLearn}</div>
                <div className="mt-1.5 text-[11px] font-medium text-muted-foreground/70">words to learn</div>
              </button>

              <button
                onClick={() => navigate("/review")}
                className="group flex flex-col items-center justify-center overflow-hidden rounded-2xl border g-border g-panel px-4 py-5 text-center transition-all active:scale-[0.97] hover:g-panel"
              >
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Review</div>
                <div className="mt-1 text-3xl font-extrabold leading-none text-sky-500 dark:text-sky-300">{dueCount}</div>
                <div className="mt-1.5 text-[11px] font-medium text-muted-foreground/70">words to review</div>
              </button>
            </section>
          </StaggerItemEnter>
        </div>
      </StaggerContainerEnter>

      <ReviewReminder dueCount={dueCount} onReview={() => navigate("/review")} />
    </div>
  );
}

function MiniStat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/plans")}
      className="flex flex-col items-center rounded-xl border g-border g-panel px-1 py-2 transition-all active:scale-[0.97] hover:g-panel"
    >
      <div className={`text-base font-bold leading-none ${highlight ? "text-sky-500 dark:text-sky-300" : "text-foreground"}`}>{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground/60">{sub}</div>}
      <div className="mt-0.5 text-[10px] text-muted-foreground/70">{label}</div>
    </button>
  );
}