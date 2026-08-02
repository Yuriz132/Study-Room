import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { DayPoint } from '@/hooks/use-daily-stats';

interface StudyChartProps {
  data: DayPoint[];
  /** 图表标题 */
  title: string;
  /** 是否打开 */
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** 自定义 tooltip 样式（匹配暗色液态玻璃风格） */
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="liquid-glass rounded-lg border g-border px-3 py-2 text-xs shadow-xl">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-bold text-primary">{payload[0].value} 词</p>
    </div>
  );
}

export function StudyChart({ data, title, open, onOpenChange }: StudyChartProps) {
  const avg = useMemo(
    () => Math.round(data.reduce((s, d) => s + d.reviewed, 0) / Math.max(data.length, 1)),
    [data]
  );
  const maxVal = useMemo(() => Math.max(...data.map((d) => d.reviewed), 1), [data]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
    >
      <div className="liquid-glass w-full max-w-2xl rounded-2xl border g-border p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:g-panel hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* 统计摘要 */}
        <div className="mb-4 flex gap-4 text-sm text-muted-foreground">
          <span>📊 近30天日均：<strong className="text-foreground">{avg}</strong> 词</span>
          <span>🔥 单日最高：<strong className="text-foreground">{maxVal}</strong> 词</span>
        </div>

        {/* 折线图 */}
        <div className="h-56 w-full sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.45)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.45)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="reviewed"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--primary)', strokeWidth: 2 }}
                animationDuration={800}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-2 text-center text-[11px] text-muted-foreground/50">
          每次浏览或标记单词后自动累计当日学习量
        </p>
      </div>
    </div>
  );
}
