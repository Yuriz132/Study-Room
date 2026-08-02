export interface Phase {
  label: string;
  sub: string;
  startH: number;
  startM: number;
  endH: number;
  endM: number;
  emoji: string;
  color: string;
}

export const PHASES: Phase[] = [
  {
    label: "夜间睡眠", sub: "深度休息", startH: 22, startM: 40, endH: 6, endM: 30,
    emoji: "🌙", color: "text-indigo-400",
  },
  {
    label: "起床洗漱", sub: "迎接新的一天", startH: 6, startM: 30, endH: 7, endM: 20,
    emoji: "🌅", color: "text-orange-400",
  },
  {
    label: "早饭", sub: "补充能量", startH: 7, startM: 20, endH: 7, endM: 40,
    emoji: "🍳", color: "text-yellow-400",
  },
  {
    label: "上午攻坚", sub: "黄金记忆时段", startH: 7, startM: 40, endH: 12, endM: 0,
    emoji: "📖", color: "text-amber-400",
  },
  {
    label: "午餐", sub: "放松休息", startH: 12, startM: 0, endH: 12, endM: 30,
    emoji: "🍽️", color: "text-orange-400",
  },
  {
    label: "午睡窗口", sub: "26分钟充电", startH: 12, startM: 30, endH: 13, endM: 0,
    emoji: "💤", color: "text-sky-400",
  },
  {
    label: "下午攻坚", sub: "专注输出", startH: 13, startM: 0, endH: 17, endM: 30,
    emoji: "📖", color: "text-amber-400",
  },
  {
    label: "傍晚小睡", sub: "26分钟回血", startH: 17, startM: 30, endH: 18, endM: 0,
    emoji: "⚡", color: "text-violet-400",
  },
  {
    label: "晚间黄金档", sub: "高效复习", startH: 18, startM: 0, endH: 22, endM: 40,
    emoji: "🔥", color: "text-rose-400",
  },
];

function toMins(h: number, m: number): number {
  return h * 60 + m;
}

/**
 * 根据当前时间返回所在阶段。夜间睡眠跨日（22:40→06:30）已处理。
 */
export function getCurrentPhase(now: Date): Phase {
  const m = toMins(now.getHours(), now.getMinutes());
  for (const p of PHASES) {
    const s = toMins(p.startH, p.startM);
    const e = toMins(p.endH, p.endM);
    if (s <= e) {
      if (m >= s && m < e) return p;
    } else {
      if (m >= s || m < e) return p; // 跨午夜
    }
  }
  return PHASES[0];
}

/**
 * 距离下一个阶段开始的剩余秒数。
 */
export function getNextMilestone(now: Date): { phase: Phase; remainingSeconds: number } {
  const totalNow = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  for (let cycle = 0; cycle < 2; cycle++) {
    for (const p of PHASES) {
      const startSec = p.startH * 3600 + p.startM * 60 + cycle * 24 * 3600;
      if (startSec > totalNow) {
        return { phase: p, remainingSeconds: startSec - totalNow };
      }
    }
  }
  return { phase: PHASES[0], remainingSeconds: 86400 };
}

/**
 * 格式化秒数为 HH:MM:SS 或 MM:SS。
 */
export function fmtClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
