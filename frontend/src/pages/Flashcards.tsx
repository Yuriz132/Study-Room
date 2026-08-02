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
  const [confirming, setConfirming] = useState(false);

  const w = session.current;

  // 根据题目阶段生成选择题选项
  useEffect(() => {
    if (!w) return;
    if (session.phase === "choice" || (session.phase === "intergroup" && session.state.stage === "choice")) {
      const opts = buildQuizOptions({ id: w.id, word: w.word, meaning: w.meaning }, words.map((x) => ({ id: x.id, word: x.word, meaning: x.meaning })));
      setQuizOptions(opts);
      setQuizAnswered(false);
    } else {
      setQuizOptions([]);
    }
    setConfirming(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w?.id, session.phase, session.state.stage]);

  const onChoice = (opt: QuizOption) => {
    if (quizAnswered || !w) return;
    setQuizAnswered(true);
    // 选择题答错：自动归集到错词本
    if (!opt.correct) {
      addWrong({ word: w.word, phonetic: w.phonetic, meaning: w.meaning });
    }
    session.onChoice(opt.correct);
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
              return (
                <button
                  key={i}
                  onClick={() => onChoice(opt)}
                  disabled={quizAnswered}
                  className={
                    "rounded-xl border px-4 py-4 text-left text-sm transition active:scale-98 " +
                    (quizAnswered && opt.correct ? "border-success bg-success/15 text-success " :
                     "g-border text-foreground hover:g-panel")
                  }
                >
                  {opt.meaning}
                </button>
              );
            })}
          </div>
          {quizAnswered && <p className="text-center text-xs text-muted-foreground">已记录，自动进入下一题…</p>}
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
              <p className="mb-3 text-center text-xs text-muted-foreground">已标记「认识」，确认进入下一个词？</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setConfirming(false); onGrade("good"); }}
                  className="flex-1 rounded-xl bg-success px-4 py-2 text-sm text-white"
                >下一个词</button>
                <button
                  onClick={() => { setConfirming(false); session.resetWord(w.id); onGrade("forget"); }}
                  className="flex-1 rounded-xl border g-border px-4 py-2 text-sm text-destructive"
                >记错了（清除进度）</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setConfirming(true)}
                className="flex-1 rounded-xl bg-success px-4 py-3 text-sm text-white"
              >认识</button>
              <button
                onClick={() => onGrade("vague")}
                className="flex-1 rounded-xl border g-border px-4 py-3 text-sm text-warning"
              >模糊</button>
              <button
                onClick={() => onGrade("forget")}
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
