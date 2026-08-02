import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useDailyStats, type DayPoint } from "@/hooks/use-daily-stats";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

/** 用 UTC 构造 yyyy-mm-dd，与 use-daily-stats 存储的键完全一致 */
function ymdUTC(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

function cellClass(reviewed: number): string {
  if (reviewed <= 0) return "g-panel text-muted-foreground/40";
  if (reviewed <= 5) return "bg-emerald-500/25 text-emerald-100";
  if (reviewed <= 15) return "bg-emerald-500/55 text-white";
  return "bg-emerald-400 text-emerald-950 font-semibold";
}

function Stat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="rounded-2xl border g-border bg-card p-3 text-center">
      <div className="text-lg">{icon}</div>
      <div className="mt-1 text-xl font-bold text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function CalendarTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="liquid-glass rounded-lg border g-border px-3 py-2 text-xs shadow-xl">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-bold text-primary">{payload[0].value} 词</p>
    </div>
  );
}

/** 学习日历：月视图热力 + 近 30 天折线，数据来自 useDailyStats */
export default function StudyCalendar() {
  const { daily, streak, totalReviewed, dailyAverage, last30days } = useDailyStats();
  const today = new Date();
  const [view, setView] = useState({ y: today.getUTCFullYear(), m: today.getUTCMonth() });

  const grid = useMemo(() => {
    const { y, m } = view;
    const firstWeekday = new Date(Date.UTC(y, m, 1)).getUTCDay(); // 0=Sun
    const lead = (firstWeekday + 6) % 7; // 周一开头
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const cells: Array<{ blank?: boolean; day?: number; reviewed: number; key: string }> = [];
    for (let i = 0; i < lead; i++) cells.push({ blank: true, reviewed: 0, key: `b${i}` });
    for (let d = 1; d <= daysInMonth; d++) {
      const key = ymdUTC(y, m, d);
      cells.push({ day: d, reviewed: daily[key]?.reviewed ?? 0, key });
    }
    return cells;
  }, [view, daily]);

  const monthLabel = `${view.y} 年 ${view.m + 1} 月`;
  const last30Total = last30days.reduce((s: number, d: DayPoint) => s + d.reviewed, 0);

  const shift = (delta: number) => {
    setView((v) => {
      const d = new Date(Date.UTC(v.y, v.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  };

  return (
    <div className="space-y-4">
      {/* 概览 */}
      <div className="grid grid-cols-3 gap-2">
        <Stat icon="🔥" label="连续天数" value={streak} />
        <Stat icon="📚" label="累计学习" value={totalReviewed} />
        <Stat icon="📈" label="日均" value={dailyAverage} />
      </div>

      {/* 月历 */}
      <div className="rounded-2xl border g-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => shift(-1)} className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:g-panel" aria-label="上个月">
              ‹
            </button>
            <h3 className="font-semibold text-foreground">{monthLabel}</h3>
            <button onClick={() => shift(1)} className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:g-panel" aria-label="下个月">
              ›
            </button>
          </div>
          <span className="text-xs text-muted-foreground">{last30Total} 词 / 近30天</span>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
          {WEEKDAYS.map((h) => (
            <div key={h}>{h}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {grid.map((c) =>
            c.blank ? (
              <div key={c.key} />
            ) : (
              <button
                key={c.key}
                title={`${c.key}：${c.reviewed} 词`}
                className={`flex h-9 items-center justify-center rounded-lg text-xs transition-transform active:scale-90 ${cellClass(c.reviewed)}`}
              >
                {c.day}
              </button>
            )
          )}
        </div>

        {/* 图例 */}
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>少</span>
          <span className="h-3 w-3 rounded g-panel" />
          <span className="h-3 w-3 rounded bg-emerald-500/25" />
          <span className="h-3 w-3 rounded bg-emerald-500/55" />
          <span className="h-3 w-3 rounded bg-emerald-400" />
          <span>多</span>
        </div>
      </div>

      {/* 近 30 天折线 */}
      <div className="rounded-2xl border g-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">近 30 天</h3>
          <span className="text-xs text-muted-foreground">日均 {dailyAverage} 词</span>
        </div>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={last30days} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} interval={6} />
              <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip content={<CalendarTooltip />} />
              <Line type="monotone" dataKey="reviewed" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: "var(--primary)" }} animationDuration={700} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
