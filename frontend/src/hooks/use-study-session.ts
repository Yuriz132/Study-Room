// 学习会话调度（原始模板版）：管理分组、组内阶段队列、组间错题复习。
// 自带 localStorage 持久化（不依赖 use-storage 的 useStudyProgress），可直接用。
//
// 算法（贴合需求）：
//  1. 每组 20 词。每个词首次出现只出 4 选 1 选择题，答对算第一遍，接着做下一题。
//  2. 一组 20 词全部过完选择题后，回头把本组词「再考一遍」，题型切换为
//     认识 / 不认识 / 模糊 三态，共做三遍（P2/P3/P4）。
//  3. 三态里只有连续三次都选「认识」才算「熟悉」；任意一次选不认识/模糊则
//     该词回到回头轮重来，直到认识或用户主动退出。
//  4. 进入下一组前，先把上一组里「易错 / 选错 / 未熟悉」的词抽出来用三态先考
//     一遍，全部认识后才正式进入下一组新词。
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Word } from '@/types/word';
import {
  chunkIntoGroups,
  initWordState,
  isMastered,
  sortReviewOrder,
  needsInterGroupReview,
  GROUP_SIZE,
  type WordStudyState,
  type ReviewGrade,
} from '@/lib/study-engine';

type Phase = 'choice' | 'review' | 'intergroup';

const STUDY_KEY = 'liquid-words:study-v1';

type StudyMap = Record<string, Record<number, WordStudyState>>;

function readStudy(): StudyMap {
  try {
    const raw = localStorage.getItem(STUDY_KEY);
    return raw ? (JSON.parse(raw) as StudyMap) : {};
  } catch {
    return {};
  }
}
function writeStudy(map: StudyMap) {
  try { localStorage.setItem(STUDY_KEY, JSON.stringify(map)); } catch {}
}

export interface StudySession {
  current: Word | null;
  state: WordStudyState;
  phase: Phase;
  groupIndex: number;
  groupTotal: number;
  progressLabel: string;
  onChoice: (correct: boolean) => void;
  onGrade: (grade: ReviewGrade) => void;
  /** 清除某词学习进度（回到未学初始状态） */
  resetWord: (id: number) => void;
  finished: boolean;
  masteredCount: number;
}

export function useStudySession({ words, listKey }: { words: Word[]; listKey: string }): StudySession {
  const groups = useMemo(() => chunkIntoGroups(words, GROUP_SIZE), [words]);

  const [groupIdx, setGroupIdx] = useState(0);
  const [choicePos, setChoicePos] = useState(0);
  const [reviewQueue, setReviewQueue] = useState<number[]>([]);
  const [reviewPos, setReviewPos] = useState(0);
  const [phase, setPhase] = useState<Phase>('choice');
  const [interQueue, setInterQueue] = useState<number[]>([]);
  const [interPos, setInterPos] = useState(0);
  const [finished, setFinished] = useState(false);

  // 持久化的学习状态（每次读取最新）
  const [study, setStudy] = useState<StudyMap>(() => readStudy());

  const getState = useCallback(
    (lk: string, id: number): WordStudyState => study[lk]?.[id] ?? initWordState(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [study]
  );
  const recordChoice = useCallback((lk: string, id: number, correct: boolean) => {
    setStudy((prev) => {
      const cur = prev[lk]?.[id] ?? initWordState(id);
      const listMap = { ...(prev[lk] ?? {}) };
      listMap[id] = (correct ? { ...cur, choicePassed: true, stage: 'review' } : { ...cur, choiceWrong: true, choicePassed: true, stage: 'review' });
      const merged = { ...prev, [lk]: listMap };
      writeStudy(merged);
      return merged;
    });
  }, []);
  const recordReview = useCallback((lk: string, id: number, grade: ReviewGrade) => {
    setStudy((prev) => {
      const cur = prev[lk]?.[id] ?? initWordState(id);
      const listMap = { ...(prev[lk] ?? {}) };
      if (grade === 'good') {
        const rounds = cur.reviewRounds + 1;
        listMap[id] = { ...cur, reviewRounds: rounds, lastGrade: 'good', stage: rounds >= 3 ? 'mastered' : 'review' };
      } else {
        listMap[id] = { ...cur, reviewRounds: 0, lastGrade: grade, everWeak: true, stage: 'review' };
      }
      const merged = { ...prev, [lk]: listMap };
      writeStudy(merged);
      return merged;
    });
  }, []);
  // 清除某词的学习进度（回到未学初始状态）
  const resetWord = useCallback((id: number) => {
    setStudy((prev) => {
      const lk = listKey;
      const listMap = { ...(prev[lk] ?? {}) };
      delete listMap[id];
      const merged = { ...prev, [lk]: listMap };
      writeStudy(merged);
      return merged;
    });
  }, [listKey]);

  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);

  const startInterGroup = useCallback(
    (prevGroupWords: Word[]) => {
      const ids = prevGroupWords.map((w) => w.id);
      const weak = ids.filter((id) => needsInterGroupReview(study[listKey]?.[id] ?? initWordState(id)));
      if (weak.length === 0) return false;
      setInterQueue(weak);
      setInterPos(0);
      setPhase('intergroup');
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [study, listKey]
  );

  const beginGroupChoice = useCallback((g: number) => {
    setGroupIdx(g);
    setChoicePos(0);
    setReviewQueue([]);
    setReviewPos(0);
    setPhase('choice');
  }, []);

  useEffect(() => {
    if (groups.length === 0) {
      setFinished(true);
      return;
    }
    beginGroupChoice(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  const current: Word | null = useMemo(() => {
    if (finished) return null;
    if (phase === 'choice') {
      const g = groups[groupIdx];
      return g[choicePos] ?? null;
    }
    if (phase === 'review') {
      const id = reviewQueue[reviewPos];
      return (id != null ? byId.get(id) : null) ?? null;
    }
    const id = interQueue[interPos];
    return (id != null ? byId.get(id) : null) ?? null;
  }, [finished, phase, groups, groupIdx, choicePos, reviewQueue, reviewPos, interQueue, interPos, byId]);

  const state: WordStudyState = useMemo(() => {
    if (!current) return initWordState(-1);
    return getState(listKey, current.id);
  }, [current, getState, listKey]);

  const onChoice = useCallback(
    (correct: boolean) => {
      if (!current) return;
      recordChoice(listKey, current.id, correct);
      const g = groups[groupIdx];
      const nextPos = choicePos + 1;
      if (nextPos >= g.length) {
        const queue = sortReviewOrder(g.map((w) => getState(listKey, w.id))).map((s) => s.id);
        setReviewQueue(queue);
        setReviewPos(0);
        setPhase('review');
      } else {
        setChoicePos(nextPos);
      }
    },
    [current, recordChoice, listKey, groups, groupIdx, choicePos, getState]
  );

  const onGrade = useCallback(
    (grade: ReviewGrade) => {
      if (!current) return;
      recordReview(listKey, current.id, grade);
      const curState = getState(listKey, current.id);

      if (phase === 'intergroup') {
        if (isMastered(curState)) {
          const nextPos = interPos + 1;
          if (nextPos >= interQueue.length) {
            const nextG = groupIdx + 1;
            if (nextG >= groups.length) setFinished(true);
            else beginGroupChoice(nextG);
          } else setInterPos(nextPos);
        } else {
          setInterQueue((q) => [...q.slice(0, interPos), ...q.slice(interPos + 1), current.id]);
        }
        return;
      }

      if (isMastered(curState)) {
        const nextPos = reviewPos + 1;
        if (nextPos >= reviewQueue.length) {
          const stillWeak = reviewQueue.map((id) => getState(listKey, id)).some((s) => !isMastered(s));
          if (stillWeak) {
            const queue = sortReviewOrder(reviewQueue.map((id) => getState(listKey, id))).map((s) => s.id);
            setReviewQueue(queue);
            setReviewPos(0);
          } else {
            const nextG = groupIdx + 1;
            if (nextG >= groups.length) setFinished(true);
            else {
              const prevGroup = groups[groupIdx];
              const wentInter = startInterGroup(prevGroup);
              if (!wentInter) beginGroupChoice(nextG);
            }
          }
        } else setReviewPos(nextPos);
      } else {
        setReviewQueue((q) => [...q.slice(0, reviewPos), ...q.slice(reviewPos + 1), current.id]);
      }
    },
    [current, recordReview, listKey, phase, interPos, interQueue, reviewPos, reviewQueue, groupIdx, groups, getState, startInterGroup, beginGroupChoice]
  );

  const progressLabel = useMemo(() => {
    if (finished) return '全部完成';
    if (phase === 'choice') {
      const g = groups[groupIdx];
      return `第${groupIdx + 1}组 · 选择题 ${Math.min(choicePos + 1, g?.length ?? 0)} / ${g?.length ?? 0}`;
    }
    if (phase === 'review') {
      return `第${groupIdx + 1}组 · 回看三态 ${Math.min(reviewPos + 1, reviewQueue.length)} / ${reviewQueue.length}`;
    }
    return `组间复习 ${Math.min(interPos + 1, interQueue.length)} / ${interQueue.length}`;
  }, [finished, phase, groupIdx, groups, choicePos, reviewPos, reviewQueue, interPos, interQueue]);

  const masteredCount = useMemo(
    () => words.filter((w) => isMastered(getState(listKey, w.id))).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [words, getState, listKey, state]
  );

  return { current, state, phase, groupIndex: groupIdx + 1, groupTotal: groups.length, progressLabel, onChoice, onGrade, resetWord, finished, masteredCount };
}
