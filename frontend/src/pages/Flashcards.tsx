import { useMemo, useState, useEffect, useRef, type TouchEvent } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { allWords, getWordsByList, getWordById } from "@/lib/words-data";
import { useKnown, useStarred, useReviews } from "@/hooks/use-storage";
import { useWrongWords } from "@/hooks/use-wrong-words";
import { useDailyStats } from "@/hooks/use-daily-stats";
import { speakWord } from "@/lib/speak";
import { useStudySession } from "@/hooks/use-study-session";
import { buildQuizOptions, type QuizOption } from "@/lib/study-engine";
import type { Word } from "@/types/word";

export default function Flashcards() {
  const { part, list } = useParams();
  const navigate = useNavigate();

  // 顶部下拉手势 → 跳转搜索页（仅在页面处于顶部时响应，避免与翻卡点击/滚动冲突）
  const touchStartY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const [pull, setPull] = useState(0);
  const onTouchStart = (e: TouchEvent) => {
    touchStartY.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (touchStartY.current == null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    const d = dy > 0 ? Math.min(dy, 90) : 0;
    pullRef.current = d;
    setPull(d);
  };
  const onTouchEnd = () => {
    if (pullRef.current > 60) navigate("/search");
    touchStartY.current = null;
    pullRef.current = 0;
    setPull(0);
  };
  const listKey = `${part}::${list}`;
  const { known, toggle: markKnown } = useKnown();
  const { starred, toggle } = useStarred();
  const { recordDay } = useDailyStats();
  const { scheduleReview, getDueOrderedIds } = useReviews();
  const { addWrong } = useWrongWords();

  const words = useMemo(() => {
    if (part && list) return getWordsByList(part, list);
    // 复习模式：优先排到期复习词（逾期/待复习优先，新词最后），无到期则回退未掌握词
    const dueWords = getDueOrderedIds([...known])
      .map((id) => getWordById(id))
      .filter((x): x is Word => Boolean(x));
    if (dueWords.length) return dueWords;
    return allWords.filter((w) => !known.has(w.id)).slice(0, 30);
  }, [part, list, known, getDueOrderedIds]);

  const session = useStudySession({ words, listKey });

  const [quizOptions, setQuizOptions] = useState<QuizOption[]>([]);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [selectedOpt, setSelectedOpt] = useState<QuizOption | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmGrade, setConfirmGrade] = useState<"good" | "vague" | "forget" | null>(null);
  const choiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const w = session.current;

  // 根据题目阶段生成选择题选项
  useEffect(() => {
    if (!w) return;
    if (session.phase === "choice" || (session.phase === "intergroup" && session.state.stage === "choice")) {
      const opts = buildQuizOptions({ id: w.id, word: w.word, meaning: w.meaning }, words.map((x) => ({ id: x.id, word: x.word, meaning: x.meaning })));
      setQuizOptions(opts);
      setQuizAnswered(false);
      setSelectedOpt(null);
    } else {
      setQuizOptions([]);
    }
    setConfirming(false);
    setConfirmGrade(null);
    // 换题时清理自动跳题计时器
    if (choiceTimer.current) { clearTimeout(choiceTimer.current); choiceTimer.current = null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w?.id, session.phase, session.state.stage]);

  // 组件卸载时清理计时器
  useEffect(() => {
    return () => {
      if (choiceTimer.current) { clearTimeout(choiceTimer.current); choiceTimer.current = null; }
    };
  }, []);

  const onChoice = (opt: QuizOption) => {
    if (quizAnswered || !w) return;
    setSelectedOpt(opt);
    setQuizAnswered(true);
    // 选择题答错：自动归集到错词本
    if (!opt.correct) {
      addWrong({ word: w.word, phonetic: w.phonetic, meaning: w.meaning });
    }
    // 先展示对错与释义，稍后自动进入下一题
    if (choiceTimer.current) clearTimeout(choiceTimer.current);
    choiceTimer.current = setTimeout(() => {
      session.onChoice(opt.correct);
    }, 1400);
  };

  const onGrade = (grade: "good" | "vague" | "forget") => {
    if (!w) return;
    scheduleReview(w.id, grade);
    if (grade === "good") {
      if (!known.has(w.id)) { markKnown(w.id); recordDay(1); }
    } else {
      // 三态选「模糊/忘记」：自动归集到错词本
      addWrong({ word: w.word, phonetic: w.phonetic, meaning: w.meaning });
    }
    session.onGrade(grade);
  };

  if (words.length === 0) {
    return (
      <div className="hv-fade space-y-4 pt-10 text-center">
        <div className="text-4xl">🎉</div>
        <p className="text-lg font-semibold">全部掌握啦！</p>
        <Link to="/browse" className="inline-block rounded-xl bg-primary px-4 py-2 text-primary-foreground">去词库</Link>
      </div>
    );
  }

  if (session.finished) {
    return (
      <div className="hv-fade space-y-4 pt-10 text-center">
        <div className="text-4xl">🎉</div>
        <p className="text-lg font-semibold">本组（及组间复习）全部完成！</p>
        <p className="text-sm text-muted-foreground">已熟悉 {session.masteredCount} / {words.length} 词</p>
        <Link to="/browse" className="inline-block rounded-xl bg-primary px-4 py-2 text-primary-foreground">去词库</Link>
      </div>
    );
  }

  if (!w) return null;

  const isChoiceStage = session.phase === "choice" || (session.phase === "intergroup" && session.state.stage === "choice");

  return (
    <div
      className="hv-fade space-y-4 pt-2 overscroll-y-contain"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <button onClick={() => navigate(-1)} className="text-muted-foreground">‹ 返回</button>
        <span className="font-mono">{session.progressLabel}</span>
      </div>

      {/* 下拉搜索：顶部下拉手势 → /search（仅移动端触摸；常驻提示作为可发现入口） */}
      <div className="text-center text-[11px] text-muted-foreground/55">↓ 下滑打开搜索</div>
      <div
        className="pointer-events-none fixed left-1/2 top-3 z-40 -translate-x-1/2 transition-opacity duration-150"
        style={{ opacity: pull > 8 ? Math.min(1, pull / 60) : 0 }}
      >
        <div className="rounded-full border g-border g-surface px-3 py-1 text-xs text-muted-foreground shadow-lg backdrop-blur">
          {pull > 60 ? "松开打开搜索" : "↓ 下拉打开搜索"}
        </div>
      </div>

      {/* 选择题阶段：看英文选中文释义 */}
      {isChoiceStage && (
        <div className="space-y-3">
          <div className="flex min-h-[20vh] cursor-pointer flex-col items-center justify-center rounded-3xl border g-border bg-card p-6 text-center">
            <div className="text-4xl font-bold">{w.word}</div>
            <div className="mt-2 text-sm text-muted-foreground">{w.phonetic}</div>
            <div className="mt-6 text-xs text-muted-foreground">选出正确释义（选择题）</div>
            <button onClick={() => speakWord(w.word)} className="mt-4 rounded-full bg-primary/20 px-3 py-1 text-sm text-primary">🔊 朗读</button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {quizOptions.map((opt, i) => {
              const isSel = selectedOpt != null && selectedOpt.id === opt.id;
              const isCorrect = opt.correct;
              const cls = quizAnswered
                ? isSel && isCorrect
                  ? "border-success bg-success/15 text-success"
                  : isSel && !isCorrect
                    ? "border-destructive bg-destructive/15 text-destructive"
                    : isCorrect
                      ? "border-success bg-success/15 text-success"
                      : "g-border text-foreground opacity-50"
                : "g-border text-foreground hover:g-panel";
              return (
                <button
                  key={i}
                  onClick={() => onChoice(opt)}
                  disabled={quizAnswered}
                  className={"rounded-xl border px-4 py-4 text-left text-sm transition active:scale-98 " + cls}
                >
                  {opt.meaning}
                  {quizAnswered && isSel && <span className="mt-1 block text-xs font-medium">{isCorrect ? "✓ 回答正确" : "✗ 回答错误"}</span>}
                </button>
              );
            })}
          </div>
          {quizAnswered && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
              <p className="text-sm font-semibold text-primary">{w.word} · {w.meaning}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedOpt?.correct ? "回答正确，即将进入下一题…" : "回答错误，请记住这个释义，即将进入下一题…"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 三态阶段：认识 / 不认识 / 模糊 */}
      {!isChoiceStage && (
        <div className="space-y-3">
          <div
            onClick={() => speakWord(w.word)}
            className="flex min-h-[38vh] cursor-pointer flex-col items-center justify-center rounded-3xl border g-border bg-card p-6 text-center"
          >
            <div className="text-4xl font-bold">{w.word}</div>
            <div className="mt-2 text-sm text-muted-foreground">{w.phonetic}</div>
            <div className="mt-6 text-lg font-semibold text-primary">{w.meaning}</div>
            <div className="mt-6 text-xs text-muted-foreground">🔊 点击听发音</div>
          </div>

          {confirming ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="mb-2 text-center text-sm text-foreground">
                释义：<span className="font-semibold text-primary">{w.meaning}</span>
              </div>
              <p className="mb-3 text-center text-xs text-muted-foreground">
                {confirmGrade === "good"
                  ? "已标记「认识」，确认进入下一个词？"
                  : confirmGrade === "vague"
                    ? "已标记「模糊」，确认进入下一个词？"
                    : "已标记「不认识」，确认进入下一个词？"}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { const g = confirmGrade; setConfirming(false); setConfirmGrade(null); if (g) onGrade(g); }}
                  className="flex-1 rounded-xl bg-success px-4 py-2 text-sm text-white"
                >确认</button>
                <button
                  onClick={() => { setConfirming(false); setConfirmGrade(null); session.resetWord(w.id); onGrade("forget"); }}
                  className="flex-1 rounded-xl border g-border px-4 py-2 text-sm text-destructive"
                >记错了（清除进度）</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => { setConfirmGrade("good"); setConfirming(true); }}
                className="flex-1 rounded-xl bg-success px-4 py-3 text-sm text-white"
              >认识</button>
              <button
                onClick={() => { setConfirmGrade("vague"); setConfirming(true); }}
                className="flex-1 rounded-xl border g-border px-4 py-3 text-sm text-warning"
              >模糊</button>
              <button
                onClick={() => { setConfirmGrade("forget"); setConfirming(true); }}
                className="flex-1 rounded-xl border g-border px-4 py-3 text-sm text-destructive"
              >不认识</button>
            </div>
          )}

          <button
            onClick={() => { toggle(w.id); }}
            className={"w-full rounded-xl border g-border py-3 text-sm " + (starred.has(w.id) ? "text-yellow-400" : "text-muted-foreground")}
          >{starred.has(w.id) ? "★ 已收藏" : "☆ 收藏"}</button>
        </div>
      )}
    </div>
  );
}
