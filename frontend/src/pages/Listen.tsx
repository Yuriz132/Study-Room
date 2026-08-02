import { useEffect, useMemo, useRef, useState } from "react";
import { allWords } from "@/lib/words-data";
import { useKnown } from "@/hooks/use-storage";
import { useWrongWords } from "@/hooks/use-wrong-words";
import { useSettings } from "@/context/SettingsContext";
import { speakWord } from "@/lib/speak";
import TopBar from "@/components/TopBar";

type Source = "all" | "known" | "wrong";

interface ListenItem {
  word: string;
  phonetic?: string;
  meaning: string;
}

const SOURCE_KEY = "listen:source";
const AUTO_KEY = "listen:auto";

export default function Listen() {
  const { known } = useKnown();
  const { wrong } = useWrongWords();
  const { speechRate, setSpeechRate } = useSettings();

  const [source, setSource] = useState<Source>(() => (localStorage.getItem(SOURCE_KEY) as Source) || "all");
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(() => localStorage.getItem(AUTO_KEY) !== "0");
  const [showMeaning, setShowMeaning] = useState(true);
  const advanceRef = useRef<number | null>(null);
  const fallbackRef = useRef<number | null>(null); // 兜底定时器：onEnd 未触发时强制推进

  const list = useMemo<ListenItem[]>(() => {
    if (source === "known") return allWords.filter((w) => known.has(w.id)).map((w) => ({ word: w.word, phonetic: w.phonetic, meaning: w.meaning }));
    if (source === "wrong") return wrong.map((w) => ({ word: w.word, phonetic: w.phonetic, meaning: w.meaning }));
    return allWords.map((w) => ({ word: w.word, phonetic: w.phonetic, meaning: w.meaning }));
  }, [source, known, wrong]);

  const current = list[idx];

  useEffect(() => {
    localStorage.setItem(SOURCE_KEY, source);
  }, [source]);
  useEffect(() => {
    localStorage.setItem(AUTO_KEY, autoAdvance ? "1" : "0");
  }, [autoAdvance]);

  // 列表切换时把指针归零，避免越界
  useEffect(() => {
    setIdx(0);
  }, [source]);

  const stopTimer = () => {
    if (advanceRef.current) {
      clearTimeout(advanceRef.current);
      advanceRef.current = null;
    }
    if (fallbackRef.current) {
      clearTimeout(fallbackRef.current);
      fallbackRef.current = null;
    }
  };

  const playWord = (i: number) => {
    const item = list[i];
    if (!item) return;
    window.speechSynthesis?.cancel();
    stopTimer();
    // 兜底定时器：估算单词朗读时长 (字长×200ms / 语速)，再加 1500ms 余量，
    // 确保即使 onEnd 事件未触发也能自动推进
    const estDuration = Math.max(3000, Math.ceil(item.word.length * 200 / Math.min(speechRate, 2)) + 1500);
    let endFired = false;
    speakWord(item.word, undefined, {
      rate: speechRate,
      onEnd: () => {
        if (endFired) return;
        endFired = true;
        if (fallbackRef.current) { clearTimeout(fallbackRef.current); fallbackRef.current = null; }
        if (!autoAdvance) return;
        advanceRef.current = window.setTimeout(() => goNext(), 700);
      },
    });
    // 启动兜底定时器：若 onEnd 未在估算时间内触发，强制推进
    fallbackRef.current = window.setTimeout(() => {
      if (endFired) return;
      endFired = true;
      fallbackRef.current = null;
      if (!autoAdvance || !playing) return;
      goNext();
    }, estDuration);
  };

  const goNext = () => {
    if (list.length === 0) return;
    const ni = (idx + 1) % list.length;
    setIdx(ni);
    if (playing) playWord(ni);
  };

  const goPrev = () => {
    if (list.length === 0) return;
    const pi = (idx - 1 + list.length) % list.length;
    setIdx(pi);
    if (playing) playWord(pi);
  };

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      window.speechSynthesis?.cancel();
      stopTimer();
    } else {
      setPlaying(true);
      playWord(idx);
    }
  };

  // 点词即读
  const replay = () => {
    window.speechSynthesis?.cancel();
    stopTimer();
    speakWord(current.word, undefined, {
      rate: speechRate,
      onEnd: () => {
        if (autoAdvance && playing) advanceRef.current = window.setTimeout(() => goNext(), 700);
      },
    });
  };

  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
      stopTimer();
    },
    []
  );

  return (
    <div className="hv-fade space-y-4 pt-2">
      <TopBar title="随身听" subtitle="循环听发音，路上也能磨耳朵" />

      {/* 词源选择 */}
      <div className="flex rounded-2xl border g-border bg-card p-1">
        {([
          ["all", "全部"],
          ["known", "已学"],
          ["wrong", "错词"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSource(key)}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition-all active:scale-95 ${
              source === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:g-panel"
            }`}
          >
            {label}
            <span className={`ml-1 text-xs ${source === key ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
              {key === "all" ? allWords.length : key === "known" ? known.size : wrong.length}
            </span>
          </button>
        ))}
      </div>

      {/* 当前单词大卡 */}
      <div
        onClick={replay}
        className="flex min-h-[34vh] cursor-pointer flex-col items-center justify-center rounded-3xl border g-border bg-card p-6 text-center transition active:scale-[0.99]"
      >
        {current ? (
          <>
            <div className="text-4xl font-bold text-foreground">{current.word}</div>
            <div className="mt-2 text-sm text-muted-foreground">{current.phonetic}</div>
            {showMeaning && <div className="mt-6 text-lg font-semibold text-primary">{current.meaning}</div>}
            <div className="mt-6 text-xs text-muted-foreground/60">🔊 点击重听</div>
          </>
        ) : (
          <div className="text-center text-muted-foreground">
            <div className="text-3xl">🎧</div>
            <p className="mt-2 text-sm">这个分类还没有单词</p>
          </div>
        )}
      </div>

      {/* 进度 */}
      <div className="text-center text-xs text-muted-foreground">
        {list.length ? `${idx + 1} / ${list.length}` : "0 / 0"}
      </div>

      {/* 播放控制 */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={goPrev} className="flex h-14 w-14 items-center justify-center rounded-full border g-border bg-card text-2xl text-foreground transition active:scale-90" aria-label="上一个">
          ⏮
        </button>
        <button
          onClick={togglePlay}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl text-primary-foreground shadow-lg transition active:scale-95"
          aria-label={playing ? "暂停" : "播放"}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <button onClick={goNext} className="flex h-14 w-14 items-center justify-center rounded-full border g-border bg-card text-2xl text-foreground transition active:scale-90" aria-label="下一个">
          ⏭
        </button>
      </div>

      {/* 设置 */}
      <div className="space-y-3 rounded-2xl border g-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">自动连播</span>
          <button
            onClick={() => setAutoAdvance((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${autoAdvance ? "bg-primary" : "g-panel"}`}
            aria-label="自动连播"
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${autoAdvance ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">显示释义</span>
          <button
            onClick={() => setShowMeaning((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${showMeaning ? "bg-primary" : "g-panel"}`}
            aria-label="显示释义"
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${showMeaning ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 text-sm text-foreground">语速</span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={speechRate}
            onChange={(e) => setSpeechRate(Number(e.target.value))}
            className="w-40 accent-primary"
            aria-label="语速"
          />
          <span className="w-10 text-center font-mono text-xs text-foreground">{speechRate.toFixed(1)}×</span>
        </div>
      </div>
    </div>
  );
}
