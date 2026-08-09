import { useEffect, useState } from "react";

const REMINDER_KEY = "liquid-words:review-reminder-date";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ReviewReminderProps {
  /** 当前到期待复习词数 */
  dueCount: number;
  /** 点击「去复习」回调 */
  onReview: () => void;
}

/**
 * 首页复习提醒弹窗（液态玻璃风）。英文文案，与首页 Learning/Review 命名一致。
 * 仅当存在到期复习词、且当天尚未弹过时显示；关闭/稍后后当天不再弹。
 */
export default function ReviewReminder({ dueCount, onReview }: ReviewReminderProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (dueCount <= 0) return;
    let shown = "";
    try {
      shown = localStorage.getItem(REMINDER_KEY) ?? "";
    } catch {
      /* ignore */
    }
    if (shown !== todayStr()) setVisible(true);
  }, [dueCount]);

  const dismiss = (goReview: boolean) => {
    try {
      localStorage.setItem(REMINDER_KEY, todayStr());
    } catch {
      /* ignore */
    }
    setVisible(false);
    if (goReview) onReview();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] backdrop-blur-sm sm:items-center">
      <div className="liquid-glass w-full max-w-sm rounded-3xl border g-border p-6 text-center shadow-2xl">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-sky-400/15 text-3xl">
          🔔
        </div>
        <h3 className="text-lg font-bold text-foreground">Time to review</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          You have <strong className="text-sky-300">{dueCount}</strong> words due for review.
          <br />
          Review them now to lock in your memory.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => dismiss(false)}
            className="flex-1 rounded-xl border g-border g-panel py-2.5 text-sm text-muted-foreground transition-all active:scale-95"
          >
            Later
          </button>
          <button
            onClick={() => dismiss(true)}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-all active:scale-95"
          >
            Review now
          </button>
        </div>
      </div>
    </div>
  );
}
