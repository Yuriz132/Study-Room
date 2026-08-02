import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Moon } from "lucide-react";
import {
  getCurrentPhase,
  getNextMilestone,
  fmtClock,
  PHASES,
  type Phase,
} from "@/lib/study-phases";

const AUDIO_PATH = `${window.location.pathname.startsWith("/vs") ? "/vs" : ""}/audio/2_merged_converted.mp3`;
const NAP_SECS = 26 * 60; // 26分钟
const RING_R = 85;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

type NapType = "midday" | "evening";

export default function SearchPage() {
  // ── 实时时钟 ──
  const [now, setNow] = useState(new Date());

  // ── 午睡状态 ──
  const [napType, setNapType] = useState<NapType | null>(null);
  const [napEnd, setNapEnd] = useState<number>(0); // Date.now() 毫秒
  const [wakeUp, setWakeUp] = useState<NapType | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* 每秒刷新时钟 + 小睡倒计时 */
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNow(new Date());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* 阶段 & 里程碑 */
  const phase: Phase = useMemo(() => getCurrentPhase(now), [now]);
  const next: { phase: Phase; remainingSeconds: number } = useMemo(
    () => getNextMilestone(now),
    [now],
  );

  /* 小睡实时剩余秒数 */
  const napRemaining = napEnd ? Math.max(0, Math.ceil((napEnd - Date.now()) / 1000)) : 0;
  const napProgress = napEnd ? Math.min(1, 1 - napRemaining / NAP_SECS) : 0;

  /* 小睡 26 分钟到点 */
  useEffect(() => {
    if (!napEnd || napEnd > Date.now()) return;
    const t = setTimeout(() => {
      setNapEnd(0);
      setWakeUp(napType);
      setNapType(null);
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
    }, 50);
    return () => clearTimeout(t);
  }, [napEnd, napType]);

  /* ── 开始小睡 ── */
  const startNap = useCallback(
    (type: NapType) => {
      if (napEnd) return;
      if (!audioRef.current) {
        audioRef.current = new Audio(AUDIO_PATH);
        audioRef.current.loop = true;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      setNapType(type);
      setNapEnd(Date.now() + NAP_SECS * 1000);
      setWakeUp(null);
    },
    [napEnd],
  );

  /* 提前结束 */
  const dismissNap = useCallback(() => {
    setNapEnd(0);
    setNapType(null);
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
  }, []);

  /* 关闭唤醒弹窗 */
  const dismissWakeUp = useCallback(() => setWakeUp(null), []);

  /* 进度环 strokeDashoffset */
  const ringDashoffset = CIRCUMFERENCE * (1 - napProgress);

  /* 当前阶段是否为晚间（夜间睡眠或准备期）—— 显示睡前提醒 */
  const isNight = phase.label === "夜间睡眠";

  /* ── 渲染 ── */
  return (
    <div className="hv-fade flex flex-col space-y-4 pt-2 pb-8">
      {/* ===== 身体时钟卡片 ===== */}
      <section className="rounded-2xl border g-border g-panel p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl">{phase.emoji}</span>
            <div>
              <div className={`text-lg font-bold ${phase.color}`}>{phase.label}</div>
              <div className="text-[11px] text-muted-foreground">{phase.sub}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold font-mono tabular-nums">
              {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
              <span className="ml-px text-xs text-muted-foreground font-normal">
                :{String(now.getSeconds()).padStart(2, "0")}
              </span>
            </div>
          </div>
        </div>
        {/* 倒计时催促条 */}
        {next && (
          <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-primary/[0.06] px-3 py-2 text-sm">
            <span>⏳</span>
            <span className="text-muted-foreground">距</span>
            <span className={`font-semibold ${next.phase.color}`}>
              {next.phase.emoji} {next.phase.label}
            </span>
            <span className="text-muted-foreground">还有</span>
            <span className="font-mono font-bold tabular-nums text-primary">
              {fmtClock(next.remainingSeconds)}
            </span>
          </div>
        )}
      </section>

      {/* ===== 晚间睡前提醒（夜间睡眠阶段） ===== */}
      {isNight && (
        <section className="rounded-2xl border border-indigo-500/15 bg-indigo-500/[0.04] p-4 text-center">
          <div className="text-2xl">🌙</div>
          <div className="mt-1 text-sm font-semibold text-indigo-400">睡前引导</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            放慢节奏 · 远离屏幕 · 准备进入深度睡眠
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground/60">
            明天 {PHASES[1].startH}:{String(PHASES[1].startM).padStart(2, "0")} 起床，加油 💪
          </div>
        </section>
      )}

      {/* ===== 冥想睡眠播放器 ===== */}
      {!isNight && (
        <section className="rounded-2xl border g-border g-panel p-4">
          <h2 className="mb-3 text-center text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            冥想睡眠
          </h2>
          <p className="mb-3 text-center text-xs text-muted-foreground/60">
            点击按钮 → 自动播放 26 分钟冥想音频 → 暗光遮罩 → 到点唤醒
          </p>
          <button
            onClick={() => startNap("midday")}
            disabled={!!napEnd}
            className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-sky-500/25 bg-sky-500/[0.08] px-5 py-5 transition-all active:scale-[0.97] hover:bg-sky-500/[0.14] disabled:opacity-40"
          >
            <Moon className="h-7 w-7 text-sky-400 transition-transform group-hover:scale-110" />
            <div className="text-left">
              <div className="text-base font-semibold">冥想睡眠启动</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                自动播放 26 分钟冥想音频 · 暗光遮罩 · 到点唤醒
              </div>
            </div>
          </button>
        </section>
      )}

      {/* ===== 完整时间轴清单 ===== */}
      <section className="rounded-2xl border g-border g-panel p-4">
        <h3 className="mb-2 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          时间轴清单
        </h3>
        <div className="space-y-1">
          {PHASES.map((p, i) => {
            const active = phase.label === p.label;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                  active ? "g-panel font-semibold" : ""
                }`}
              >
                <span className="text-base">{p.emoji}</span>
                <span
                  className={`flex-1 truncate ${active ? p.color : "text-foreground/80"}`}
                >
                  {p.label}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {String(p.startH).padStart(2, "0")}:{String(p.startM).padStart(2, "0")}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== 暗光遮罩 · 小睡模式 ===== */}
      {napEnd > 0 && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/92 backdrop-blur-md">
          {/* 进度环 SVG */}
          <svg width="210" height="210" viewBox="0 0 210 210" className="-mt-8">
            {/* 背景轨 */}
            <circle
              cx="105"
              cy="105"
              r={RING_R}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="5"
            />
            {/* 进度弧 */}
            <circle
              cx="105"
              cy="105"
              r={RING_R}
              fill="none"
              stroke={napType === "midday" ? "#38bdf8" : "#a78bfa"}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={ringDashoffset}
              transform="rotate(-90 105 105)"
              style={{ transition: "stroke-dashoffset 0.4s linear" }}
            />
          </svg>
          <div className="-mt-4 text-center">
            <div className="text-3xl font-bold font-mono tabular-nums text-white">
              {fmtClock(napRemaining)}
            </div>
            <div className="mt-1 text-sm text-white/60">
              {napType === "midday" ? "💤 午睡中" : "⚡ 傍晚小睡中"}
            </div>
            <div className="mt-0.5 text-[11px] text-white/30">音频播放中 · 保持安静</div>
          </div>
          <button
            onClick={dismissNap}
            className="mt-8 text-xs text-white/35 underline transition-colors hover:text-white/60"
          >
            提前结束
          </button>
        </div>
      )}

      {/* ===== 唤醒弹窗 ===== */}
      {wakeUp !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-amber-500/10 to-black/94 backdrop-blur-md">
          <div className="text-center space-y-3 px-8">
            <div className="text-5xl">☀️</div>
            <h2 className="text-2xl font-bold text-white">无痛清醒</h2>
            <p className="text-sm text-white/80">坐直 · 喝水 · 进入下一段攻坚</p>
            <p className="text-xs text-white/35">
              冥想睡眠完成 · 下一个阶段已开始
            </p>
            <button
              onClick={dismissWakeUp}
              className="mt-5 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition active:scale-95"
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
