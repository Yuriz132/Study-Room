/**
 * 发音工具：优先 Web Speech API（speechSynthesis），英文无语音包时用有道音频兜底。
 *
 * 中文朗读仅依赖浏览器内置 speechSynthesis，不做任何云端 TTS 调用
 * （原先的 CloudBase 云函数代理已移除，避免跨域依赖与控制台噪音）。
 */

import { getAccent, type Accent } from './accent';

let voices: SpeechSynthesisVoice[] = [];
let unlocked = false;
let voiceLoadAttempted = false;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }
    const existing = window.speechSynthesis.getVoices() || [];
    if (existing.length > 0) {
      voices = existing;
      resolve(existing);
      return;
    }
    // 等待 voiceschanged 事件
    let resolved = false;
    const handler = () => {
      if (resolved) return;
      resolved = true;
      voices = window.speechSynthesis.getVoices() || [];
      resolve(voices);
    };
    window.speechSynthesis.onvoiceschanged = handler;
    // 超时兜底：1.5 秒后就算没等到也 resolve
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      voices = window.speechSynthesis.getVoices() || [];
      resolve(voices);
    }, 1500);
  });
}

/** 同步获取已缓存的语音列表 */
function getCachedVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  if (voices.length === 0 && !voiceLoadAttempted) {
    voiceLoadAttempted = true;
    voices = window.speechSynthesis.getVoices() || [];
  }
  return voices;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  voices = window.speechSynthesis.getVoices() || [];
  window.speechSynthesis.onvoiceschanged = () => {
    voices = window.speechSynthesis.getVoices() || [];
  };
  // 首次用户手势解锁 iOS 的音频会话（仅执行一次）
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    try {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

function hasEnglishVoice(): boolean {
  return getCachedVoices().some((v) => /^en/i.test(v.lang));
}

/** 英文兜底：用有道 TTS 音频播放（国内可访问，type=1 英音 / type=2 美音） */
function playYoudaoAudio(text: string, accent: Accent = 'us', onEnd?: () => void) {
  try {
    const youdaoType = accent === 'gb' ? 1 : 2;
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${youdaoType}`;
    const audio = new Audio(url);
    if (onEnd) audio.onended = () => onEnd();
    audio.play().catch((err) => {
      console.warn('[speak] 有道音频播放失败：', err);
      onEnd?.();
    });
  } catch (err) {
    console.warn('[speak] 有道音频创建失败：', err);
    onEnd?.();
  }
}

function buildEnglishUtterance(text: string, accent: Accent = 'us'): SpeechSynthesisUtterance {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = accent === 'gb' ? 'en-GB' : 'en-US';
  utter.rate = 0.9;
  utter.volume = 1;
  utter.pitch = 1;
  const langRe = accent === 'gb' ? /en[-_]GB/i : /en[-_]US/i;
  const voice =
    voices.find((v) => langRe.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang));
  if (voice) utter.voice = voice;
  return utter;
}

/**
 * 朗读单词。务必在用户点击/触摸的回调里调用。
 * 策略：有英文语音 → 用 speechSynthesis，并带「未开始发音则切音频兜底」的保护；
 *       无英文语音/不支持 → 直接用有道音频。
 */
export function speakWord(text: string, accent?: Accent, opts?: { rate?: number; onEnd?: () => void }) {
  if (typeof window === 'undefined') return;
  const ac: Accent = accent ?? getAccent();
  getCachedVoices();
  const synthOk = 'speechSynthesis' in window;

  if (synthOk && hasEnglishVoice()) {
    let fellBack = false;
    const utter = buildEnglishUtterance(text, ac);
    if (opts?.rate != null) utter.rate = opts.rate;
    const guard = window.setTimeout(() => {
      if (!fellBack) {
        fellBack = true;
        console.warn('[speak] 英文 speechSynthesis 未在限定时间内发声，切换有道音频');
        playYoudaoAudio(text, ac, opts?.onEnd);
      }
    }, 800);
    utter.onstart = () => {
      clearTimeout(guard);
      console.log('[speak] 开始英文朗读（speechSynthesis）：', text);
    };
    utter.onend = () => {
      clearTimeout(guard);
      opts?.onEnd?.();
    };
    utter.onerror = (e) => {
      clearTimeout(guard);
      if (!fellBack) {
        fellBack = true;
        console.warn('[speak] 英文 speechSynthesis 出错：', e.error || e, '→ 切换有道音频');
        playYoudaoAudio(text, ac, opts?.onEnd);
      }
    };
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch (err) {
      clearTimeout(guard);
      console.warn('[speak] 英文 speechSynthesis 抛出异常：', err, '→ 切换有道音频');
      playYoudaoAudio(text, ac, opts?.onEnd);
    }
  } else {
    console.log('[speak] 无英文语音包，使用有道音频：', text);
    playYoudaoAudio(text, ac, opts?.onEnd);
  }
}

/**
 * 清理中文释义文本：去掉词性前缀（n. v. adj. 等）、标点符号，只保留中文内容。
 * 例如 "n. 苹果；一种水果" → "苹果 一种水果"
 */
function cleanChineseText(text: string): string {
  if (!text) return '';
  let cleaned = text;
  // 去掉开头的词性标注：n. v. adj. adv. prep. conj. pron. vt. vi. num. art. int.abbr. 等
  cleaned = cleaned.replace(/^[\s]*([a-zA-Z]{1,6}\.)\s*/g, '');
  // 去掉中间的词性标注（如 "n. 苹果 v. 喜欢" 中间也会出现）
  cleaned = cleaned.replace(/\s+[a-zA-Z]{1,6}\.\s*/g, ' ');
  // 中文分号、英文分号换成空格
  cleaned = cleaned.replace(/[；;]/g, ' ');
  // 去掉多余的空格
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  // 百度 TTS 对超长文本可能失败，截断到合理长度
  if (cleaned.length > 60) cleaned = cleaned.slice(0, 60);
  return cleaned;
}

function buildChineseUtterance(text: string): SpeechSynthesisUtterance {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-CN';
  utter.rate = 0.85;
  utter.volume = 1;
  utter.pitch = 1;
  const allVoices = getCachedVoices();
  const voice =
    allVoices.find((v) => /zh[-_]CN/i.test(v.lang)) ||
    allVoices.find((v) => /^zh/i.test(v.lang)) ||
    allVoices.find((v) => /cmn|chinese|mandarin/i.test(v.name));
  if (voice) {
    utter.voice = voice;
    console.log('[speak] 选中中文语音：', voice.name, voice.lang);
  } else {
    console.log('[speak] 未找到专用中文语音，使用默认');
  }
  return utter;
}

/**
 * 尝试用 speechSynthesis 朗读中文，带超时保护。
 * 返回 Promise<boolean>：true 表示已开始发音，false 表示失败。
 */
function trySpeakChinese(text: string, timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve(false);
      return;
    }
    let started = false;
    const utter = buildChineseUtterance(text);
    const guard = window.setTimeout(() => {
      if (!started) {
        try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
        resolve(false);
      }
    }, timeoutMs);

    utter.onstart = () => {
      started = true;
      clearTimeout(guard);
      console.log('[speak] 中文朗读开始：', text);
      resolve(true);
    };
    utter.onerror = (e) => {
      clearTimeout(guard);
      console.warn('[speak] 中文 speechSynthesis 出错：', e.error || e);
      resolve(false);
    };
    utter.onend = () => {
      clearTimeout(guard);
    };

    try {
      window.speechSynthesis.cancel();
      // 给 cancel 一点时间生效
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utter);
        } catch (err) {
          clearTimeout(guard);
          console.warn('[speak] 中文 speechSynthesis.speak 抛出异常：', err);
          resolve(false);
        }
      }, 50);
    } catch (err) {
      clearTimeout(guard);
      console.warn('[speak] 中文 speechSynthesis 初始化异常：', err);
      resolve(false);
    }
  });
}

/**
 * 朗读中文文本。
 * 策略：清理文本 → 仅尝试浏览器内置 speechSynthesis（1500ms 超时）。
 * 不做任何云端 TTS 调用；若浏览器无中文语音引擎则静默跳过（中文靠默写）。
 */
export async function speakChinese(rawText: string) {
  if (typeof window === 'undefined') return;
  const text = cleanChineseText(rawText);
  if (!text) {
    console.warn('[speak] 中文释义为空，无法朗读');
    return;
  }

  console.log('[speak] 准备朗读中文：', rawText, '→ 清理后：', text);

  // 仅尝试浏览器内置语音，不做云端兜底
  await loadVoices();
  const ok = await trySpeakChinese(text, 1500);
  if (ok) return;
  console.log('[speak] 浏览器中文语音不可用，已跳过云端兜底（中文默写即可）');
}

/** 是否有可用的中文语音引擎 */
export function chineseVoiceAvailable(): boolean {
  return getCachedVoices().some((v) => /^zh/i.test(v.lang));
}

// 初始化时加载语音
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  voices = window.speechSynthesis.getVoices() || [];
}
