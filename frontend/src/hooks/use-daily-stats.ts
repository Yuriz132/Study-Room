import { useState, useCallback, useMemo } from 'react';

const DAILY_KEY = 'liquid-words:daily';

interface DayRecord {
  reviewed: number;
  timestamp: number;
}

type DailyData = Record<string, DayRecord>;

/** 获取今天的日期字符串 (YYYY-MM-DD) */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function readDaily(): DailyData {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeDaily(data: DailyData): void {
  localStorage.setItem(DAILY_KEY, JSON.stringify(data));
}

/** 近30天数据点（含今天） */
export interface DayPoint {
  date: string;
  reviewed: number;
}

export function useDailyStats() {
  const [data, setData] = useState<DailyData>(() => readDaily());

  // 记录今日学习量（去重累加：同一天多次调用只增量，不覆盖）
  const recordDay = useCallback((reviewed: number) => {
    if (reviewed <= 0) return;
    setData((prev) => {
      const day = todayStr();
      const existing = prev[day]?.reviewed ?? 0;
      const next = {
        ...prev,
        [day]: { reviewed: existing + reviewed, timestamp: Date.now() },
      };
      writeDaily(next);
      return next;
    });
  }, []);

  /** 今日复习数 */
  const todayReviewed = data[todayStr()]?.reviewed ?? 0;

  /** 连续学习天数（从今天往前倒推有记录的天数） */
  const streak = useMemo(() => {
    let count = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const key = d.toISOString().slice(0, 10);
      if (data[key] && data[key].reviewed > 0) {
        count++;
        d.setDate(d.getDate() - 1);
      } else if (i === 0) {
        // 今天没记录不算断，继续往前看
        d.setDate(d.getDate() - 1);
      } else {
        break; // 中断了
      }
    }
    return count;
  }, [data]);

  /** 总复习量（所有记录天数的累计） */
  const totalReviewed = useMemo(
    () => Object.values(data).reduce((s, r) => s + r.reviewed, 0),
    [data]
  );

  /** 日均（总复习 / max(连续天数,1)，避免除零） */
  const dailyAverage = Math.round(totalReviewed / Math.max(streak, 1));

  /** 近30天数组（用于折线图），从29天前到今天 */
  const last30days: DayPoint[] = useMemo(() => {
    const points: DayPoint[] = [];
    const d = new Date();
    for (let i = 29; i >= 0; i--) {
      const dd = new Date(d);
      dd.setDate(dd.getDate() - i);
      const key = dd.toISOString().slice(0, 10);
      points.push({
        date: key.slice(5), // MM-DD 格式
        reviewed: data[key]?.reviewed ?? 0,
      });
    }
    return points;
  }, [data]);

  /** 原始每日数据映射（date -> {reviewed, timestamp}），供日历视图使用 */
  const daily = data;

  return { todayReviewed, streak, dailyAverage, totalReviewed, last30days, daily, recordDay };
}
