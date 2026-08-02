// 发音口音偏好（英音 en-GB / 美音 en-US），持久化到 localStorage。
// 不背单词支持英音/美音切换，这里提供全局读写，供 speakWord 与切换按钮共用。

export type Accent = 'us' | 'gb';

const ACCENT_KEY = 'liquid-words:accent';

export function getAccent(): Accent {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    return v === 'gb' ? 'gb' : 'us';
  } catch {
    return 'us';
  }
}

export function setAccent(a: Accent): void {
  try {
    localStorage.setItem(ACCENT_KEY, a);
  } catch {
    /* ignore */
  }
}
