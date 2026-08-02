import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

const KEYS = {
  pomodoroVisible: "liquid-words:pomodoro-visible",
  proverbEnabled: "liquid-words:proverb-enabled",
  showRoots: "liquid-words:show-roots",
  showSimilar: "liquid-words:show-similar",
  autoSpeak: "liquid-words:auto-speak",
  wakeLock: "liquid-words:wake-lock",
  sound: "liquid-words:sound",
  speechRate: "liquid-words:speech-rate",
  motionEnabled: "liquid-words:motion-enabled",
  staggerInterval: "liquid-words:stagger-interval",
  staggerDistance: "liquid-words:stagger-distance",
  staggerEase: "liquid-words:stagger-ease",
  theme: "liquid-words:theme",
  wallpaper: "liquid-words:wallpaper",
  fontColor: "liquid-words:fontColor",
};

export type Theme = "light" | "dark" | "system";

/** 压缩壁纸到合理大小（最长边 1920，JPEG 0.75） */
export async function compressWallpaper(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 1920;
      let { width, height } = img;
      if (width > max || height > max) {
        if (width > height) { height = Math.round((height * max) / width); width = max; }
        else { width = Math.round((width * max) / height); height = max; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, width, height);
      try { resolve(canvas.toDataURL("image/jpeg", 0.75)); } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** 压缩头像到合理大小（最长边 256，JPEG 0.85） */
export async function compressAvatar(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 256;
      let { width, height } = img;
      if (width > max || height > max) {
        if (width > height) { height = Math.round((height * max) / width); width = max; }
        else { width = Math.round((width * max) / height); height = max; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, width, height);
      try { resolve(canvas.toDataURL("image/jpeg", 0.85)); } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** 将壁纸应用到 body 背景；空字符串则清除，回退到主题自带渐变 */
function applyWallpaper(url: string) {
  if (url) {
    document.body.style.backgroundImage = `url(${url})`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center center";
    document.body.style.backgroundAttachment = "fixed";
    document.body.style.backgroundRepeat = "no-repeat";
  } else {
    document.body.style.backgroundImage = "";
    document.body.style.backgroundSize = "";
    document.body.style.backgroundPosition = "";
    document.body.style.backgroundAttachment = "";
    document.body.style.backgroundRepeat = "";
  }
}

/**
 * 低性能设备探测：弱机首次进入默认关闭 UI 动效，保证手机端流畅度。
 * 用户仍可在「更多」页手动开启。
 */
function isLowEndDevice(): boolean {
  try {
    if (typeof navigator === "undefined" || typeof window === "undefined") return false;
    const cores = navigator.hardwareConcurrency || 8;
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 8;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 380;
    return cores <= 4 || mem <= 2 || (coarse && smallScreen);
  } catch {
    return false;
  }
}

const DEFAULT_MOTION = !isLowEndDevice();

interface SettingsValue {
  pomodoroVisible: boolean; setPomodoroVisible: (v: boolean) => void;
  proverbEnabled: boolean; setProverbEnabled: (v: boolean) => void;
  showRoots: boolean; setShowRoots: (v: boolean) => void;
  showSimilar: boolean; setShowSimilar: (v: boolean) => void;
  autoSpeak: boolean; setAutoSpeak: (v: boolean) => void;
  wakeLock: boolean; setWakeLock: (v: boolean) => void;
  sound: boolean; setSound: (v: boolean) => void;
  speechRate: number; setSpeechRate: (v: number) => void;
  motionEnabled: boolean; setMotionEnabled: (v: boolean) => void;
  /** 交错入场：子项之间的延迟间隔（秒） */
  staggerInterval: number; setStaggerInterval: (v: number) => void;
  /** 交错入场：子项自上而下滑入的位移距离（px） */
  staggerDistance: number; setStaggerDistance: (v: number) => void;
  /** 交错入场：缓动曲线名（harmony/easeOut/easeInOut/linear） */
  staggerEase: string; setStaggerEase: (v: string) => void;
  theme: Theme; setTheme: (v: Theme) => void;
  wallpaper: string; setWallpaper: (v: string) => void;
  fontColor: string; setFontColor: (v: string) => void;
  clearAllCache: () => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

function usePersistedBool(key: string, defaultVal: boolean) {
  const [val, setVal] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? defaultVal : raw === "true";
    } catch { return defaultVal; }
  });
  const set = (v: boolean) => {
    setVal(v);
    try { localStorage.setItem(key, String(v)); } catch {}
  };
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) setVal(e.newValue === "true");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);
  return [val, set] as const;
}

function usePersistedNumber(key: string, defaultVal: number) {
  const [val, setVal] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? defaultVal : Number(raw);
    } catch { return defaultVal; }
  });
  const set = (v: number) => {
    const clamped = Math.max(0.5, Math.min(2, v));
    setVal(clamped);
    try { localStorage.setItem(key, String(clamped)); } catch {}
  };
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) setVal(Number(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);
  return [val, set] as const;
}

function usePersistedString(key: string, defaultVal: string) {
  const [val, setVal] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? defaultVal : raw;
    } catch { return defaultVal; }
  });
  const set = (v: string) => {
    setVal(v);
    try {
      if (v) localStorage.setItem(key, v);
      else localStorage.removeItem(key);
    } catch {}
  };
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setVal(e.newValue ?? defaultVal);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);
  return [val, set] as const;
}

function usePersistedTheme(key: string, defaultVal: Theme) {
  const [val, setVal] = useState<Theme>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === "light" || raw === "dark" || raw === "system" ? raw : defaultVal;
    } catch { return defaultVal; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, val); } catch {}
  }, [key, val]);
  return [val, setVal] as const;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [pomodoroVisible, setPomodoroVisible] = usePersistedBool(KEYS.pomodoroVisible, true);
  const [proverbEnabled, setProverbEnabled] = usePersistedBool(KEYS.proverbEnabled, true);
  const [showRoots, setShowRoots] = usePersistedBool(KEYS.showRoots, true);
  const [showSimilar, setShowSimilar] = usePersistedBool(KEYS.showSimilar, true);
  const [autoSpeak, setAutoSpeak] = usePersistedBool(KEYS.autoSpeak, false);
  const [wakeLock, setWakeLock] = usePersistedBool(KEYS.wakeLock, false);
  const [sound, setSound] = usePersistedBool(KEYS.sound, true);
  const [speechRate, setSpeechRate] = usePersistedNumber(KEYS.speechRate, 1);
  const [motionEnabled, setMotionEnabled] = usePersistedBool(KEYS.motionEnabled, DEFAULT_MOTION);
  const [staggerInterval, setStaggerInterval] = usePersistedNumber(KEYS.staggerInterval, 0.08);
  const [staggerDistance, setStaggerDistance] = usePersistedNumber(KEYS.staggerDistance, 18);
  const [staggerEase, setStaggerEase] = usePersistedString(KEYS.staggerEase, "harmony");
  const [theme, setTheme] = usePersistedTheme(KEYS.theme, "dark");
  const [wallpaper, setWallpaper] = usePersistedString(KEYS.wallpaper, "");
  const [fontColor, setFontColor] = usePersistedString(KEYS.fontColor, "");

  // 将主题应用到 <html>：system 时跟随系统深浅偏好并监听变化
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const isDark = theme === "dark" || (theme === "system" && mq.matches);
      root.classList.toggle("dark", isDark);
      root.style.colorScheme = isDark ? "dark" : "light";
    };
    apply();
    if (theme === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  // 自定义壁纸：覆盖全站 body 背景（空字符串回退到主题渐变）
  useEffect(() => {
    applyWallpaper(wallpaper);
  }, [wallpaper]);

  // 字体颜色：覆盖 shadcn 的 --foreground 令牌，使全站 text-foreground 文本随之变色；
  // 空字符串则移除覆盖，回退到主题默认前景色。
  useEffect(() => {
    const root = document.documentElement;
    if (fontColor) root.style.setProperty("--foreground", fontColor);
    else root.style.removeProperty("--foreground");
  }, [fontColor]);

  const clearAllCache = () => {
    try {
      const keep = new Set(Object.values(KEYS));
      keep.add("auth_token"); keep.add("auth_user");
      const removeKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && !keep.has(k) && k.startsWith("liquid-words:")) removeKeys.push(k);
      }
      removeKeys.forEach((k) => localStorage.removeItem(k));
    } catch {}
  };

  return (
    <SettingsContext.Provider value={{
      pomodoroVisible, setPomodoroVisible,
      proverbEnabled, setProverbEnabled,
      showRoots, setShowRoots,
      showSimilar, setShowSimilar,
      autoSpeak, setAutoSpeak,
      wakeLock, setWakeLock,
      sound, setSound,
      speechRate, setSpeechRate,
      motionEnabled, setMotionEnabled,
      staggerInterval, setStaggerInterval,
      staggerDistance, setStaggerDistance,
      staggerEase, setStaggerEase,
      theme, setTheme,
      wallpaper, setWallpaper,
      fontColor, setFontColor,
      clearAllCache,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings 必须在 SettingsProvider 内使用");
  return ctx;
}
