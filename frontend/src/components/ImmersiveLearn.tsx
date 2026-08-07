import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Star } from "lucide-react";
import { allWords } from "@/lib/words-data";
import { useKnown, useStarred } from "@/hooks/use-storage";
import { useDailyStats } from "@/hooks/use-daily-stats";
import { speakWord } from "@/lib/speak";
import { useSettings } from "@/context/SettingsContext";
import { getLocalMorphology } from "@/lib/morphology";
import { WordComments } from "@/components/WordComments";

/**
 * 沉浸式学习 — 顺序学习 + 三档自评 + 轮次拼写测试
 * 流程：
 *  1) 按词库顺序取前 20 个未学单词，正面自评：不认识 / 模糊 / 认识
 *  2) 认识计数 +1，满 3 次自动熟悉；掌握了立即熟悉；二者都直接下一词
 *  3) 不认识：计数清零，翻背看答案，底部只有「下一页」
 *  4) 模糊：翻背看答案，给「我认识了」确认（确认才 +1）
 *  5) 一轮（20 词）结束 → 对掌握不好的词（≤8）做拼写测试
 *  6) 拼写完 → 三选一：休息一下（回首页）/ 接着 20 词 / 复习
 *  7) 已熟悉单词永不再出现；进入即启动番茄钟计时
 */
const SESSION_SIZE = 20;
const NEED_RECOG = 3;
const MAX_SPELL = 8;
const RECOG_KEY = "liquid-words:recog";

function readRecog(): Record<number, number> {
  try { return JSON.parse(localStorage.getItem(RECOG_KEY) || "{}"); } catch { return {}; }
}
function writeRecog(m: Record<number, number>) {
  try { localStorage.setItem(RECOG_KEY, JSON.stringify(m)); } catch {}
}

// 顺序学习：取前 20 个未学单词（保持词库原有顺序，不随机）
function buildSession(knownSet: Set<number>): number[] {
  return allWords.filter((w) => !knownSet.has(w.id)).map((w) => w.id).slice(0, SESSION_SIZE);
}

type FlipReason = "unknown" | "fuzzy" | null;
type Phase = "learn" | "spell" | "complete";

interface WordResult { unknown: number; fuzzy: number; know: number; mastered: boolean; }

export default function ImmersiveLearn() {
  const navigate = useNavigate();
  const { known, toggle: toggleKnown } = useKnown();
  const { starred, toggle: toggleStar } = useStarred();
  const { recordDay } = useDailyStats();
  const { showRoots, showSimilar, autoSpeak, wakeLock, sound } = useSettings();

  const [sessionIds, setSessionIds] = useState<number[]>(() => buildSession(known));
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const [recog, setRecog] = useState<Record<number, number>>(() => readRecog());
  const [direction, setDirection] = useState<1 | -1>(1);
  const [flipReason, setFlipReason] = useState<FlipReason>(null);
  const [confirmAction, setConfirmAction] = useState<"know" | "mastered" | null>(null);
  const [phase, setPhase] = useState<Phase>("learn");
  const [results, setResults] = useState<Record<number, WordResult>>({});

  // 拼写测试状态
  const [spellQueue, setSpellQueue] = useState<number[]>([]);
  const [spellIdx, setSpellIdx] = useState(0);
  const [spellInput, setSpellInput] = useState("");
  const [spellChecked, setSpellChecked] = useState(false);
  const [spellCorrect, setSpellCorrect] = useState(0);

  const wordMap = useMemo(() => {
    const m = new Map<number, (typeof allWords)[number]>();
    for (const w of allWords) m.set(w.id, w);
    return m;
  }, []);

  const currentId = sessionIds[idx];
  const w = currentId != null ? wordMap.get(currentId) : null;
  const morph = w ? getLocalMorphology(w.word) : null;
  const isDone = currentId != null && done.has(currentId);
  const count = currentId ? (recog[currentId] || 0) : 0;

  // 进入学习即启动番茄钟计时（仅当用户已开启悬浮番茄钟才会真正显示；绝不强制改动用户全局设置，避免退出后误自动弹出）
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event("pomodoro:start")), 120);
    return () => clearTimeout(t);
  }, []);

  // 一轮结束 → 进入拼写测试或完成页
  useEffect(() => {
    if (phase !== "learn") return;
    if (sessionIds.length > 0 && done.size >= sessionIds.length) {
      const weak = sessionIds.filter((id) => {
        const r = results[id];
        if (r?.mastered) return false;
        if (r && (r.unknown > 0 || r.fuzzy > 0)) return true;
        return (recog[id] || 0) < NEED_RECOG;
      });
      const queue = weak.slice(0, MAX_SPELL);
      if (queue.length > 0) {
        setSpellQueue(queue);
        setSpellIdx(0);
        setSpellInput("");
        setSpellChecked(false);
        setPhase("spell");
      } else {
        setPhase("complete");
      }
    }
  }, [done, sessionIds, phase, results, recog]);

  // 屏幕常亮
  const wakeLockRef = useRef<any>(null);
  useEffect(() => {
    if (!wakeLock) {
      if (wakeLockRef.current) { try { wakeLockRef.current.release(); } catch {} wakeLockRef.current = null; }
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const AC: any = (window as any).WakeLock || (navigator as any).wakeLock;
        if (AC && typeof AC.request === "function") {
          const lock = await AC.request("screen");
          if (!cancelled) wakeLockRef.current = lock;
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [wakeLock]);

  // 自动朗读
  useEffect(() => {
    if (flipped && w && autoSpeak) speakWord(w.word);
  }, [flipped, w?.word, autoSpeak]);

  const playSound = (freq: number, type: OscillatorType, dur: number) => {
    if (!sound) return;
    try {
      const AC: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur + 0.02);
      setTimeout(() => ctx.close().catch(() => {}), dur * 1000 + 200);
    } catch {}
  };

  const markKnown = useCallback((id: number) => {
    if (!known.has(id)) { toggleKnown(id); recordDay(1); }
    setDone((prev) => new Set(prev).add(id));
  }, [known, toggleKnown, recordDay]);

  const bump = useCallback((id: number, key: keyof WordResult) => {
    setResults((prev) => {
      const cur = prev[id] || { unknown: 0, fuzzy: 0, know: 0, mastered: false };
      return { ...prev, [id]: { ...cur, [key]: (cur[key] as number) + 1 } };
    });
  }, []);

  /* ---- 自评操作 ---- */
  const goNext = useCallback((step: 1 | -1 = 1) => {
    if (!sessionIds.length) return;
    setDirection(step);
    setFlipped(false);
    setFlipReason(null);
    setConfirmAction(null);
    setIdx((i) => {
      let next = i + step;
      let guard = 0;
      while (guard < sessionIds.length && done.has(sessionIds[next])) {
        next += step;
        if (next < 0) next = sessionIds.length - 1;
        if (next >= sessionIds.length) next = 0;
        guard++;
      }
      return next;
    });
  }, [sessionIds, done]);

  // 「认识」：先翻面看释义，确认后才 +1 计数（防无反馈直接跳走）
  const handleKnow = useCallback(() => {
    if (!currentId || !w) return;
    setFlipReason(null);
    setConfirmAction("know");
    setFlipped(true);
  }, [currentId, w]);

  const confirmKnow = useCallback(() => {
    if (!currentId || !w) return;
    setConfirmAction(null);
    const n = (recog[currentId] || 0) + 1;
    const nextRecog = { ...recog, [currentId]: n };
    setRecog(nextRecog); writeRecog(nextRecog);
    bump(currentId, "know");
    playSound(1320, "sine", 0.18);
    if (n >= NEED_RECOG) {
      markKnown(currentId);
      setTimeout(() => goNext(1), 300);
    } else {
      setTimeout(() => goNext(1), 200);
    }
  }, [currentId, recog, w, bump, markKnown, goNext]);

  // 「掌握」：先翻面看释义，确认后才标记掌握
  const handleMastered = useCallback(() => {
    if (!currentId) return;
    setFlipReason(null);
    setConfirmAction("mastered");
    setFlipped(true);
  }, [currentId]);

  const confirmMastered = useCallback(() => {
    if (!currentId) return;
    setConfirmAction(null);
    setResults((prev) => ({
      ...prev,
      [currentId]: { ...(prev[currentId] || { unknown: 0, fuzzy: 0, know: 0, mastered: false }), mastered: true },
    }));
    markKnown(currentId);
    playSound(1568, "sine", 0.2);
    setTimeout(() => goNext(1), 300);
  }, [currentId, markKnown, goNext]);

  const handleUnknown = useCallback(() => {
    if (!currentId) return;
    const nextRecog = { ...recog, [currentId]: 0 };
    setRecog(nextRecog); writeRecog(nextRecog);
    bump(currentId, "unknown");
    playSound(220, "sawtooth", 0.25);
    setFlipReason("unknown");
    setFlipped(true);
  }, [currentId, recog, bump]);

  const handleFuzzy = useCallback(() => {
    if (!currentId) return;
    bump(currentId, "fuzzy");
    playSound(660, "sine", 0.2);
    setFlipReason("fuzzy");
    setFlipped(true);
  }, [currentId, bump]);

  // 看完答案点「下一页」：把当前词标记为本轮已处理，再进入下一词
  const advanceSeen = useCallback(() => {
    if (currentId != null) setDone((prev) => new Set(prev).add(currentId));
    goNext(1);
  }, [currentId, goNext]);

  const handleFlip = useCallback(() => {
    setFlipReason(null);
    setConfirmAction(null);
    setFlipped((v) => !v);
  }, []);
  const handleStar = useCallback(() => { if (currentId) toggleStar(currentId); }, [currentId, toggleStar]);

  const regen = useCallback(() => {
    setSessionIds(buildSession(known));
    setIdx(0);
    setFlipped(false);
    setFlipReason(null);
    setConfirmAction(null);
    setDone(new Set());
    setResults({});
    setRecog(readRecog());
    setPhase("learn");
    setSpellQueue([]);
    setSpellIdx(0);
    setSpellInput("");
    setSpellChecked(false);
    setSpellCorrect(0);
  }, [known]);

  /* ---- 拼写测试 ---- */
  const spellWord = spellQueue[spellIdx] != null ? wordMap.get(spellQueue[spellIdx]) : null;

  const checkSpell = useCallback(() => {
    if (!spellWord) return;
    const ok = spellInput.trim().toLowerCase() === spellWord.word.trim().toLowerCase();
    setSpellChecked(true);
    if (ok) setSpellCorrect((c) => c + 1);
  }, [spellInput, spellWord]);

  const nextSpell = useCallback(() => {
    if (spellIdx < spellQueue.length - 1) {
      setSpellIdx((i) => i + 1);
      setSpellInput("");
      setSpellChecked(false);
    } else {
      setPhase("complete");
    }
  }, [spellIdx, spellQueue.length]);

  const remaining = sessionIds.filter((id) => !done.has(id)).length;
  const progressPct = sessionIds.length ? (done.size / sessionIds.length) * 100 : 0;

  /* ---- 渲染：拼写测试 ---- */
  if (phase === "spell" && spellWord) {
    const isLast = spellIdx >= spellQueue.length - 1;
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:g-panel hover:text-foreground" aria-label="退出">✕</button>
          <span className="text-xs text-muted-foreground">拼写测试 {spellIdx + 1}/{spellQueue.length}</span>
          <div className="h-9 w-9" />
        </div>

        <div className="mx-4 h-1 overflow-hidden rounded-full g-panel">
          <div className="h-full bg-primary transition-all" style={{ width: `${((spellIdx) / spellQueue.length) * 100}%` }} />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <p className="mb-1 text-[11px] uppercase tracking-widest text-white/35">根据释义拼写单词</p>
          <p className="text-center text-2xl font-semibold leading-snug text-foreground">{spellWord.meaning}</p>
          {spellWord.phonetic && <p className="mt-2 text-sm text-muted-foreground">{spellWord.phonetic}</p>}

          <div className="mt-8 w-full max-w-sm">
            <input
              value={spellInput}
              onChange={(e) => setSpellInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !spellChecked) checkSpell(); else if (e.key === "Enter" && spellChecked) nextSpell(); }}
              disabled={spellChecked}
              autoFocus
              placeholder="输入英文拼写…"
              className="h-12 w-full rounded-xl g-panel px-4 text-center text-lg text-foreground outline-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary/50"
            />

            {!spellChecked ? (
              <button onClick={checkSpell} data-testid="spell-check" className="mt-3 w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground transition-all active:scale-[0.97]">
                检查
              </button>
            ) : (
              <div className="mt-3">
                <div className={`rounded-xl px-4 py-3 text-center text-sm ${spellInput.trim().toLowerCase() === spellWord.word.trim().toLowerCase() ? "bg-green-500/15 text-green-400" : "bg-rose-500/15 text-rose-300"}`}>
                  {spellInput.trim().toLowerCase() === spellWord.word.trim().toLowerCase()
                    ? "✅ 拼写正确"
                    : `❌ 正确答案：${spellWord.word}`}
                </div>
                <button onClick={nextSpell} data-testid={isLast ? "spell-result" : "spell-next"} className="mt-3 w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground transition-all active:scale-[0.97]">
                  {isLast ? "查看结果" : "下一词"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---- 渲染：完成页（三选一） ---- */
  if (phase === "complete") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[var(--background)] px-6 text-center">
        <div className="text-6xl">🎉</div>
        <div>
          <p className="text-2xl font-bold text-foreground">本轮学习完成</p>
          <p className="mt-1 text-sm text-muted-foreground">已学 {sessionIds.length} 词 · 拼写正确 {spellCorrect}/{spellQueue.length || 0}</p>
        </div>
        <div className="w-full max-w-xs space-y-3">
          <button onClick={() => navigate("/")} data-testid="rest-btn" className="w-full rounded-2xl border g-border g-panel py-3.5 text-base font-medium text-foreground transition-all active:scale-[0.97]">
            休息一下
          </button>
          <button onClick={() => regen()} data-testid="continue-btn" className="w-full rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg transition-all active:scale-[0.97]">
            接着 20 个单词学习
          </button>
          <button onClick={() => navigate("/review")} data-testid="review-btn" className="w-full rounded-2xl border g-border g-panel py-3.5 text-base font-medium text-foreground transition-all active:scale-[0.97]">
            复习
          </button>
        </div>
      </div>
    );
  }

  if (!allWords.length) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[var(--background)] px-6 text-center">
        <div className="text-5xl">?</div>
        <p className="text-xl font-semibold text-foreground">词库为空</p>
        <button onClick={() => navigate(-1)} className="rounded-xl bg-primary px-6 py-3 text-primary-foreground">返回</button>
      </div>
    );
  }

  if (!sessionIds.length) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[var(--background)] px-6 text-center">
        <div className="text-5xl">🎉</div>
        <p className="text-xl font-semibold text-foreground">太棒了！本轮 {SESSION_SIZE} 词已全部学完</p>
        <button onClick={regen} className="rounded-xl bg-primary px-6 py-3 text-primary-foreground">再来一轮</button>
      </div>
    );
  }

  /* ---- 主界面：学习 ---- */
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]">
      {/* 顶栏：返回 | 进度 | 收藏 + 掌握 */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:g-panel hover:text-foreground" aria-label="退出学习">✕</button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground" data-testid="progress-text">{idx + 1}/{sessionIds.length}</span>
          {remaining > 0 && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">待学 {remaining}</span>}
          {isDone && <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">已熟悉</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleStar} className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:g-panel" aria-label="收藏">
            <Star className={`h-5 w-5 ${currentId && starred.has(currentId) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
          </button>
          <button
            onClick={handleMastered}
            className="flex h-9 items-center rounded-full border border-primary/40 bg-primary/15 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/25"
            aria-label="标记为掌握"
            data-testid="mastered-btn"
          >
            掌握
          </button>
        </div>
      </div>

      {/* 进度条 */}
      <div className="mx-4 h-1 overflow-hidden rounded-full g-panel">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progressPct}%` }} />
      </div>

      {/* 卡片区 */}
      <div className="relative flex flex-1 items-center justify-center px-5 pb-2 pt-3">
        <div
          key={currentId}
          className={`w-full transition-all duration-300 ease-out ${direction === 1 ? "animate-in slide-in-from-right fade-in duration-300" : "animate-in slide-in-from-left fade-in duration-300"}`}
          style={{ animationFillMode: "both" }}
        >
          <div
            onClick={handleFlip}
            className="flex min-h-[50vh] max-h-[66vh] cursor-pointer flex-col items-center justify-center overflow-y-auto rounded-3xl border g-border bg-card p-7 text-center transition-transform active:scale-[0.98]"
          >
            {!flipped ? (
              <div className="flex w-full flex-col items-center">
                <p className="break-word text-5xl font-bold leading-tight tracking-wide text-foreground sm:text-6xl">{w?.word}</p>
                {w?.phonetic && <p className="mt-3 text-base text-muted-foreground">{w.phonetic}</p>}

                <div className="mt-6 flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: NEED_RECOG }).map((_, i) => (
                      <span key={i} className={`h-2 w-2 rounded-full transition-colors ${i < count ? "bg-primary" : "g-panel"}`} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground/70">
                    {count >= NEED_RECOG ? "✅ 已达标，将记为熟悉" : `再认识 ${NEED_RECOG - count} 次即熟悉`}
                  </p>
                </div>

                {isDone && (
                  <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-green-500/15 px-3 py-1 text-sm font-medium text-green-400">
                    <Check className="h-4 w-4" /> 已熟悉
                  </span>
                )}

                <p className="mt-7 text-sm text-muted-foreground/50">👇 看单词自评，或点卡片看释义</p>
              </div>
            ) : (
              <div className="flex w-full flex-col items-center">
                <div className="flex items-center gap-3">
                  <p className="text-3xl font-bold text-foreground sm:text-4xl">{w?.word}</p>
                  {w?.phonetic && (
                    <button onClick={(e) => { e.stopPropagation(); speakWord(w!.word); }} className="flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary/80">
                      🔊 {w.phonetic}
                    </button>
                  )}
                </div>

                <div className="mx-auto mt-4 max-w-md">
                  <p className="text-lg leading-relaxed text-foreground/90">{w?.meaning}</p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full g-panel px-3 py-1 text-xs text-muted-foreground">{w?.part}</span>
                  <span className="rounded-full g-panel px-3 py-1 text-xs text-muted-foreground">{w?.list}</span>
                </div>

                {(showRoots || showSimilar) && morph && (morph.roots || (morph.similar && morph.similar.length > 0)) && (
                  <div className="mt-4 w-full max-w-md border-t g-border pt-4 text-left">
                    {showRoots && morph.roots && (
                      <div className="mb-2">
                        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary"><span>📖</span><span>词根词缀</span></div>
                        <p className="text-sm leading-relaxed text-foreground/85">{morph.roots}</p>
                      </div>
                    )}
                    {showSimilar && morph.similar && morph.similar.length > 0 && (
                      <div>
                        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary"><span>🔗</span><span>形近词</span></div>
                        <div className="flex flex-wrap gap-1.5">
                          {morph.similar.map((s) => (
                            <span key={s.word} className="rounded-lg border g-border g-panel px-2.5 py-1 text-xs">
                              <span className="font-medium text-foreground/90">{s.word}</span>
                              <span className="ml-1 text-muted-foreground">{s.cn}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isDone && (
                  <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-green-500/15 px-3 py-1 text-xs font-medium text-green-400" data-testid="done-badge">
                    <Check className="h-3.5 w-3.5" /> 已熟悉
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部操作区 */}
      <div className="safe-area-pb px-4 pb-4 pt-2">
        {!flipped ? (
          /* 正面：三档自评 */
          <div className="grid grid-cols-3 gap-2">
            <button onClick={handleUnknown} data-testid="unknown-btn" className="flex flex-col items-center gap-1 rounded-2xl border g-border g-panel py-3.5 text-muted-foreground backdrop-blur-sm transition-all active:scale-95">
              <span className="text-lg">🔄</span><span className="text-[11px]">不认识</span>
            </button>
            <button onClick={handleFuzzy} data-testid="fuzzy-btn" className="flex flex-col items-center gap-1 rounded-2xl border border-amber-400/20 bg-amber-400/10 py-3.5 text-amber-300 backdrop-blur-sm transition-all active:scale-95">
              <span className="text-lg">🤔</span><span className="text-[11px]">模糊</span>
            </button>
            <button
              onClick={handleKnow}
              data-testid="know-btn"
              className="flex flex-col items-center gap-1 rounded-2xl border border-primary/30 bg-primary/15 py-3.5 text-primary backdrop-blur-sm transition-all active:scale-95"
            >
              <span className="text-lg">👍</span>
              <span className="text-[11px] font-semibold">{count >= NEED_RECOG - 1 ? "认识" : `${count}/${NEED_RECOG}`}</span>
            </button>
          </div>
        ) : confirmAction === "know" ? (
          /* 认识确认：释义已展示在卡片背面，确认后才计数 */
          <div className="space-y-2">
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-center text-sm text-primary">
              确认认识这个词？<span className="font-medium">{w?.meaning}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setConfirmAction(null); setFlipped(false); }} className="rounded-2xl border g-border g-panel py-3.5 text-base text-foreground transition-all active:scale-95">
                取消
              </button>
              <button onClick={confirmKnow} data-testid="confirm-know-btn" className="rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg transition-all active:scale-95">
                确认认识
              </button>
            </div>
          </div>
        ) : confirmAction === "mastered" ? (
          /* 掌握确认：确认后才标记为已掌握 */
          <div className="space-y-2">
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-center text-sm text-primary">
              确认掌握这个词？<span className="font-medium">{w?.meaning}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setConfirmAction(null); setFlipped(false); }} className="rounded-2xl border g-border g-panel py-3.5 text-base text-foreground transition-all active:scale-95">
                取消
              </button>
              <button onClick={confirmMastered} data-testid="confirm-mastered-btn" className="rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg transition-all active:scale-95">
                确认掌握
              </button>
            </div>
          </div>
        ) : flipReason === "unknown" ? (
          /* 不认识：看答案，只有「下一页」 */
          <button onClick={advanceSeen} className="w-full rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-lg transition-all active:scale-[0.97]" data-testid="next-btn">
            下一页 →
          </button>
        ) : flipReason === "fuzzy" ? (
          /* 模糊：看答案，给「我认识了」确认 + 下一页 */
          <div className="space-y-2">
            <WordComments
              bare
              wordId={currentId!}
              wordText={w?.word}
              title="大家的灵光一现"
              placeholder={`关于"${w?.word}"的短语或近义词…`}
              emptyText="还没有人评论，来做第一个分享的人吧～"
            />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={advanceSeen} className="rounded-2xl border g-border g-panel py-3.5 text-base text-foreground transition-all active:scale-95">
                下一页
              </button>
              <button onClick={handleKnow} className="rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg transition-all active:scale-95">
                我认识了
              </button>
            </div>
          </div>
        ) : (
          /* 手动翻转：完整评论 + 三按钮 */
          <div className="space-y-3">
            <WordComments
              bare
              wordId={currentId!}
              wordText={w?.word}
              title="大家的灵光一现"
              placeholder={`关于"${w?.word}"的短语或近义词…`}
              emptyText="还没有人评论，来做第一个分享的人吧～"
            />
            <div className="grid grid-cols-3 gap-2">
              <button onClick={handleUnknown} data-testid="unknown-btn" className="flex flex-col items-center gap-1 rounded-2xl border g-border g-panel py-3 text-muted-foreground backdrop-blur-sm transition-all active:scale-95">
                <span className="text-lg">🔄</span><span className="text-[11px]">不认识</span>
              </button>
              <button onClick={handleFuzzy} data-testid="fuzzy-btn" className="flex flex-col items-center gap-1 rounded-2xl border border-amber-400/20 bg-amber-400/10 py-3 text-amber-300 backdrop-blur-sm transition-all active:scale-95">
                <span className="text-lg">🤔</span><span className="text-[11px]">模糊</span>
              </button>
              <button onClick={handleKnow} className="flex flex-col items-center gap-1 rounded-2xl border border-primary/30 bg-primary/15 py-3 text-primary backdrop-blur-sm transition-all active:scale-95">
                <span className="text-lg">👍</span>
                <span className="text-[11px] font-semibold">{count >= NEED_RECOG - 1 ? "认识" : `${count}/${NEED_RECOG}`}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
