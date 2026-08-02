import { useCallback, useState } from 'react';
import { pushToCloud } from '@/lib/progressSync';
import type { StudyPlan } from '@/lib/studyPlans';
import type { SavedArticle } from '@/lib/authApi';
import { computeReview, isReviewDue, getDueOrderedIds, type ReviewGrade, type ReviewRecord } from '@/lib/reviews';

const STARRED_KEY = 'liquid-words:starred';
const PROGRESS_KEY = 'liquid-words:progress';
const KNOWN_KEY = 'liquid-words:known';
const REVIEWS_KEY = 'liquid-words:reviews';
const SAVED_ARTICLES_KEY = 'liquid-words:saved-articles';

function readSet(key: string): Set<number> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<number>) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

function readProgress(): Record<string, { reviewed: number; total: number }> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeProgress(data: Record<string, { reviewed: number; total: number }>) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
}

/** 生词本 */
export function useStarred() {
  const [starred, setStarred] = useState<Set<number>>(() => readSet(STARRED_KEY));

  const toggle = useCallback((id: number) => {
    const next = new Set(starred);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setStarred(next);
    writeSet(STARRED_KEY, next);
    pushToCloud({ starred: [...next] });
  }, [starred]);

  const isStarred = useCallback((id: number) => starred.has(id), [starred]);

  const remove = useCallback((id: number) => {
    const next = new Set(starred);
    next.delete(id);
    setStarred(next);
    writeSet(STARRED_KEY, next);
    pushToCloud({ starred: [...next] });
  }, [starred]);

  const clear = useCallback(() => {
    setStarred(new Set());
    writeSet(STARRED_KEY, new Set());
  }, []);

  return { starred, starredIds: [...starred], toggle, isStarred, remove, clear, count: starred.size };
}

/** 已掌握单词 */
export function useKnown() {
  const [known, setKnown] = useState<Set<number>>(() => readSet(KNOWN_KEY));

  const toggle = useCallback((id: number) => {
    const next = new Set(known);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setKnown(next);
    writeSet(KNOWN_KEY, next);
    pushToCloud({ known: [...next] });
  }, [known]);

  const isKnown = useCallback((id: number) => known.has(id), [known]);

  return { known, knownIds: [...known], toggle, isKnown, count: known.size };
}

/** 学习进度 */
export function useProgress() {
  const [progress, setProgress] = useState<Record<string, { reviewed: number; total: number }>>(() => readProgress());

  const getListProgress = useCallback(
    (listKey: string) => progress[listKey] ?? { reviewed: 0, total: 0 },
    [progress]
  );

  const setListProgress = useCallback((listKey: string, reviewed: number, total: number) => {
    const next = { ...progress, [listKey]: { reviewed, total } };
    setProgress(next);
    writeProgress(next);
    pushToCloud({ progress: next });
  }, [progress]);

  const markReviewed = useCallback((listKey: string, reviewed: number, total: number) => {
    const existing = progress[listKey] ?? { reviewed: 0, total };
    const next = {
      ...progress,
      [listKey]: { reviewed: Math.max(existing.reviewed, reviewed), total },
    };
    setProgress(next);
    writeProgress(next);
    pushToCloud({ progress: next });
  }, [progress]);

  const clear = useCallback(() => {
    setProgress({});
    writeProgress({});
  }, []);

  return { progress, getListProgress, setListProgress, markReviewed, clear };
}

/** 学习计划：本地存储 + 登录后增量同步到云端 */
const PLANS_KEY = 'liquid-words:plans';

function readPlans(): StudyPlan[] {
  try {
    const raw = localStorage.getItem(PLANS_KEY);
    return raw ? (JSON.parse(raw) as StudyPlan[]) : [];
  } catch {
    return [];
  }
}

function writePlans(plans: StudyPlan[]) {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
  pushToCloud({ plans });
}

export function useStudyPlans() {
  const [plans, setPlans] = useState<StudyPlan[]>(() => readPlans());

  const addPlan = useCallback(
    (plan: StudyPlan) => {
      const next = [plan, ...plans];
      setPlans(next);
      writePlans(next);
    },
    [plans]
  );

  const removePlan = useCallback(
    (id: string) => {
      const next = plans.filter((p) => p.id !== id);
      setPlans(next);
      writePlans(next);
    },
    [plans]
  );

  const toggleTask = useCallback(
    (planId: string, taskId: string) => {
      const next = plans.map((p) =>
        p.id === planId
          ? { ...p, tasks: (p.tasks ?? []).map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) }
          : p
      );
      setPlans(next);
      writePlans(next);
    },
    [plans]
  );

  return { plans, addPlan, removePlan, toggleTask };
}

/** 已生成文章（我的收藏）：本地存储 + 登录后同步到云端 */
function readSavedArticles(): SavedArticle[] {
  try {
    const raw = localStorage.getItem(SAVED_ARTICLES_KEY);
    return raw ? (JSON.parse(raw) as SavedArticle[]) : [];
  } catch {
    return [];
  }
}

function writeSavedArticles(list: SavedArticle[]) {
  localStorage.setItem(SAVED_ARTICLES_KEY, JSON.stringify(list));
  pushToCloud({ savedArticles: list });
}

export function useSavedArticles() {
  const [articles, setArticles] = useState<SavedArticle[]>(() => readSavedArticles());

  /** 新增一篇文章（自动去重 + 最新在前），并同步到云端 */
  const add = useCallback((article: SavedArticle) => {
    setArticles((prev) => {
      const existed = prev.some((a) => a.id === article.id);
      const next = existed ? prev.map((a) => (a.id === article.id ? article : a)) : [article, ...prev];
      next.sort((a, b) => b.createdAt - a.createdAt);
      writeSavedArticles(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setArticles((prev) => {
      const next = prev.filter((a) => a.id !== id);
      writeSavedArticles(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setArticles([]);
    writeSavedArticles([]);
  }, []);

  return { articles, add, remove, clear, count: articles.length };
}

/** 间隔复习（SRS）：本地存储 + 登录后增量同步到云端 */
function readReviews(): Record<number, ReviewRecord> {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    return raw ? (JSON.parse(raw) as Record<number, ReviewRecord>) : {};
  } catch {
    return {};
  }
}

function writeReviews(map: Record<number, ReviewRecord>) {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(map));
  pushToCloud({ reviews: map });
}

export function useReviews() {
  const [reviews, setReviews] = useState<Record<number, ReviewRecord>>(() => readReviews());

  /** 记录一次复习评级，更新该词的间隔安排（SM-2 lite） */
  const scheduleReview = useCallback((id: number, grade: ReviewGrade) => {
    setReviews((prev) => {
      const next = { ...prev, [id]: computeReview(prev[id], grade) };
      writeReviews(next);
      return next;
    });
  }, []);

  /** 该词是否到期需要复习（无记录=新词，默认到期） */
  const isDue = useCallback(
    (id: number, now: number = Date.now()) => isReviewDue(reviews[id], now),
    [reviews]
  );

  /** 从一批词 id 中筛出当前到期的 */
  const getDueIds = useCallback(
    (ids: number[], now: number = Date.now()) =>
      ids.filter((id) => isReviewDue(reviews[id], now)),
    [reviews]
  );

  /** 到期词按「逾期优先」排序（不背单词式复习队列），新词排在最后 */
  const getDueOrderedIdsCached = useCallback(
    (ids: number[], now: number = Date.now()) => getDueOrderedIds(ids, reviews, now),
    [reviews]
  );

  /** 当前已安排复习（学习过）的词数 */
  const count = Object.keys(reviews).length;

  /** 今天需要复习的词数（到期时间 <= 当天 23:59:59.999） */
  const dueToday = useCallback(() => {
    const now = Date.now();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    return Object.values(reviews).filter((r) => r.due <= endOfToday.getTime()).length;
  }, [reviews]);

  return { reviews, scheduleReview, isDue, getDueIds, getDueOrderedIds: getDueOrderedIdsCached, count, dueToday };
}
