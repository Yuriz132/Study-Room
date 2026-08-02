import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, SkipForward, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "focus" | "short" | "long";

interface PomodoroSettings {
  focus: number;
  short: number;
  long: number;
}

const DEFAULT_SETTINGS: PomodoroSettings = { focus: 25, short: 5, long: 15 };
const STORAGE_KEY = "liquid-words:pomodoro";

interface SavedState {
  settings: PomodoroSettings;
  completedFocus: number;
  cycleCount: number;
}

function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { settings: DEFAULT_SETTINGS, completedFocus: 0, cycleCount: 0, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { settings: DEFAULT_SETTINGS, completedFocus: 0, cycleCount: 0 };
}

const MODE_LABEL: Record<Mode, string> = { focus: "专注", short: "短休息", long: "长休息" };

const MODE_COLOR: Record<Mode, string> = {
  focus: "oklch(0.65 0.18 240)",
  short: "oklch(0.7 0.17 163)",
  long: "oklch(0.6 0.22 340)",
};

function vibrateOnComplete() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([1000, 400, 1000, 400, 1000]);
    }
  } catch {
    /* ignore */
  }
}

/**
 * 倒计时结束短铃声提醒：「滴滴 — 停 0.5s — 滴滴 — 停 0.5s — 滴滴」
 * 用 Web Audio API 现场合成 3 声短促正弦音（880Hz），每声间隔 0.5s。
 * 无需外部音频文件，桌面/移动端通用；不支持时静默忽略。
 */
function playBeepReminder() {
  try {
    const AC: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const beepAt = (t: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      const start = ctx.currentTime + t;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.start(start);
      osc.stop(start + 0.18);
    };
    // 滴滴 — 停 0.5s — 滴滴 — 停 0.5s — 滴滴（3 声，间隔 0.5s）
    beepAt(0);
    beepAt(0.5);
    beepAt(1.0);
    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        /* ignore */
      }
    }, 1400);
  } catch {
    /* ignore */
  }
}

/**
 * 悬浮番茄钟（仿不背单词风格）
 *
 * - 固定在左下角，自动计时（默认 running=true）
 * - 收起时仅显示小圆环进度条（点按展开完整控制）
 * - 展开时显示完整控制面板
 * - 全局组件，不依赖路由页面
 */
export function PomodoroTimer() {
  const initial = useRef(loadState());
  const [settings, setSettings] = useState<PomodoroSettings>(initial.current.settings);
  const [completedFocus, setCompletedFocus] = useState(initial.current.completedFocus);
  const [cycleCount, setCycleCount] = useState(initial.current.cycleCount);

  const [mode, setMode] = useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(settings.focus * 60);
  const [running, setRunning] = useState(true); // 自动开始
  const [expanded, setExpanded] = useState(false); // 默认收起（悬浮态）
  const [showSettings, setShowSettings] = useState(false);

  const intervalRef = useRef<number | null>(null);

  // 持久化
  useEffect(() => {
    const data: SavedState = { settings, completedFocus, cycleCount };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [settings, completedFocus, cycleCount]);

  // 计时器
  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          handleCompleteRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [running]);

  const totalSeconds = settings[mode] * 60;

  const switchMode = useCallback(
    (next: Mode) => {
      setMode(next);
      setSecondsLeft(settings[next] * 60);
      setRunning(true);
    },
    [settings]
  );

  const handleComplete = useCallback(() => {
    setRunning(false);
    if (mode === "focus") {
      const nextCycle = cycleCount + 1;
      setCompletedFocus((c) => c + 1);
      setCycleCount(nextCycle);
      if (nextCycle % 4 === 0) switchMode("long");
      else switchMode("short");
    } else {
      switchMode("focus");
    }
    try {
      playBeepReminder();
    } catch {
      /* ignore */
    }
    vibrateOnComplete();
  }, [mode, cycleCount, switchMode]);

  const handleCompleteRef = useRef(handleComplete);
  useEffect(() => {
    handleCompleteRef.current = handleComplete;
  }, [handleComplete]);

  // 进入沉浸式学习时由 ImmersiveLearn 触发，确保立即开始计时
  useEffect(() => {
    const onStart = () => setRunning(true);
    window.addEventListener("pomodoro:start", onStart);
    return () => window.removeEventListener("pomodoro:start", onStart);
  }, []);

  const toggle = () => setRunning((r) => !r);

  const reset = () => {
    setRunning(false);
    setSecondsLeft(totalSeconds);
  };

  const skip = () => {
    setRunning(false);
    if (mode === "focus") {
      const nextCycle = cycleCount + 1;
      setCycleCount(nextCycle);
      if (nextCycle % 4 === 0) switchMode("long");
      else switchMode("short");
    } else {
      switchMode("focus");
    }
  };

  const updateSetting = (key: keyof PomodoroSettings, value: number) => {
    const v = Math.max(1, Math.min(120, value));
    setSettings((s) => ({ ...s, [key]: v }));
    if (mode === key && !running) setSecondsLeft(v * 60);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const progress = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;
  const color = MODE_COLOR[mode];
  const ringRadius = 36;
  const circumference = 2 * Math.PI * ringRadius;

  return (
    <div className="fixed bottom-20 left-4 z-40">
      {/* ===== 展开面板 ===== */}
      {expanded && (
        <div className="mb-3 w-72 rounded-2xl border g-border g-surface p-4 shadow-2xl backdrop-blur-xl">
          {!showSettings ? (
            <>
              {/* 模式切换 */}
              <div className="mb-3 flex gap-1.5">
                {(["focus", "short", "long"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-xs transition-all active:scale-95",
                      mode === m ? "bg-primary/15 text-primary" : "text-muted-foreground hover:g-panel"
                    )}
                  >
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>

              {/* 圆环进度 */}
              <div className="relative mx-auto mb-3 flex h-28 w-28 items-center justify-center">
                <svg className="h-28 w-28 -rotate-90" viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r={ringRadius} fill="none" stroke="oklch(1 0 0 / 0.08)" strokeWidth="5" />
                  <circle
                    cx="44"
                    cy="44"
                    r={ringRadius}
                    fill="none"
                    stroke={color}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - progress)}
                    style={{ transition: "stroke-dashoffset 0.5s linear" }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="font-mono text-2xl font-bold text-foreground">{mm}:{ss}</span>
                  <span className="text-[11px]" style={{ color }}>{MODE_LABEL[mode]}</span>
                </div>
              </div>

              {/* 控制按钮 */}
              <div className="flex items-center justify-center gap-2">
                <button onClick={toggle} className="flex h-9 w-9 items-center justify-center rounded-full border g-border g-panel text-foreground transition-all active:scale-90" aria-label={running ? "暂停" : "开始"}>
                  {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button onClick={reset} className="flex h-9 w-9 items-center justify-center rounded-full border g-border g-panel text-muted-foreground transition-all active:scale-90" aria-label="重置">
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button onClick={skip} className="flex h-9 w-9 items-center justify-center rounded-full border g-border g-panel text-muted-foreground transition-all active:scale-90" aria-label="跳过">
                  <SkipForward className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setShowSettings(true)} className="flex h-9 w-9 items-center justify-center rounded-full border g-border g-panel text-muted-foreground transition-all active:scale-90" aria-label="设置">
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* 统计 */}
              <div className="mt-2 text-center text-[11px] text-muted-foreground">
                已完成 <span className="font-semibold text-foreground">{completedFocus}</span> 次专注
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">时长设置</span>
              </div>
              {(["focus", "short", "long"] as Mode[]).map((m) => (
                <div key={m} className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{MODE_LABEL[m]}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateSetting(m, settings[m] - 1)} className="flex h-7 w-7 items-center justify-center rounded-full border g-border g-panel text-foreground text-sm transition-all active:scale-90">−</button>
                    <span className="w-10 text-center font-mono text-sm text-foreground">{settings[m]}</span>
                    <button onClick={() => updateSetting(m, settings[m] + 1)} className="flex h-7 w-7 items-center justify-center rounded-full border g-border g-panel text-foreground text-sm transition-all active:scale-90">+</button>
                  </div>
                </div>
              ))}
              <button onClick={() => setShowSettings(false)} className="mt-1 w-full rounded-lg bg-primary/15 py-2 text-sm text-primary transition-all active:scale-95">完成</button>
            </>
          )}
        </div>
      )}

      {/* ===== 收起态：仅保留小圆环进度条 + 圈心极小剩余时间（点按展开完整控制） ===== */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="group relative flex h-8 w-8 items-center justify-center rounded-full border g-border g-panel p-1 shadow-lg backdrop-blur-xl transition-all active:scale-95"
        aria-label="番茄钟（点按展开）"
      >
        <svg className="h-6 w-6 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="32" fill="none" stroke="oklch(1 0 0 / 0.06)" strokeWidth="4" />
          <circle
            cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={201} strokeDashoffset={201 * (1 - progress)}
            style={{ transition: "stroke-dashoffset 0.5s linear" }}
          />
        </svg>
        {/* 圈心极小剩余时间：≥60s 显分钟，最后一分钟显秒数，保证在 24px 圆环内可读 */}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[8px] font-semibold leading-none text-foreground/90">
          {secondsLeft >= 60 ? mm : ss}
        </span>
      </button>
    </div>
  );
}
