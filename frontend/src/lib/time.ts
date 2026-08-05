/**
 * 抖音风格时间显示（全站统一）
 *
 * - 1 分钟内 → 刚刚
 * - 1 小时内 → X分钟前
 * - 24 小时内 → X小时前
 * - 3 天内（含 3 天）→ X天前
 * - 更早 → M-D（如 7-5、7-6）
 */
export function timeAgoShort(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const d = Math.floor(h / 24);
  if (d < 4) return `${d}天前`;
  const date = new Date(ts);
  return `${date.getMonth() + 1}-${date.getDate()}`;
}
