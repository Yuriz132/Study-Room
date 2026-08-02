/**
 * 学习进度导入 / 导出
 * 进度保存在浏览器 localStorage（键名见 use-storage.ts），换浏览器会丢失。
 * 这里把 starred / known / progress 打包成 JSON 文件，便于备份与跨浏览器恢复。
 */

const STARRED_KEY = 'liquid-words:starred';
const KNOWN_KEY = 'liquid-words:known';
const PROGRESS_KEY = 'liquid-words:progress';
const PLANS_KEY = 'liquid-words:plans';

export interface ProgressData {
  app: 'liquid-words';
  version: number;
  exportedAt: number;
  starred: number[];
  known: number[];
  progress: Record<string, { reviewed: number; total: number }>;
  plans?: unknown[];
}

function readRaw(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** 导出当前学习进度为 JSON 文件并触发下载 */
export function exportProgress(): void {
  const starredRaw = readRaw(STARRED_KEY);
  const knownRaw = readRaw(KNOWN_KEY);
  const progressRaw = readRaw(PROGRESS_KEY);

  const plansRaw = readRaw(PLANS_KEY);
  const data: ProgressData = {
    app: 'liquid-words',
    version: 1,
    exportedAt: Date.now(),
    starred: Array.isArray(starredRaw) ? (starredRaw as number[]) : [],
    known: Array.isArray(knownRaw) ? (knownRaw as number[]) : [],
    progress:
      progressRaw && typeof progressRaw === 'object' ? (progressRaw as ProgressData['progress']) : {},
    plans: Array.isArray(plansRaw) ? (plansRaw as unknown[]) : [],
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `升本词汇-学习进度-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 从 JSON 文件导入学习进度，写入 localStorage（返回是否成功） */
export async function importProgress(file: File): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text) as Partial<ProgressData>;

  if (!data || typeof data !== 'object') {
    throw new Error('文件格式不正确');
  }

  // 仅写入结构合法的字段，避免脏数据破坏本地状态
  if (Array.isArray(data.starred)) {
    localStorage.setItem(
      STARRED_KEY,
      JSON.stringify(data.starred.filter((n) => typeof n === 'number'))
    );
  }
  if (Array.isArray(data.known)) {
    localStorage.setItem(
      KNOWN_KEY,
      JSON.stringify(data.known.filter((n) => typeof n === 'number'))
    );
  }
  if (data.progress && typeof data.progress === 'object') {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(data.progress));
  }
  if (Array.isArray(data.plans)) {
    localStorage.setItem(PLANS_KEY, JSON.stringify(data.plans));
  }
}
