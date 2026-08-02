import { useCallback, useState } from 'react';
import { aiExampleSentences, type ExampleSentence } from '@/lib/ai';
import type { Word } from '@/types/word';

const CACHE_KEY = 'liquid-words:examples';

type ExampleCache = Record<number, ExampleSentence[]>;

function readCache(): ExampleCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as ExampleCache) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: ExampleCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* 忽略写入失败（隐私模式 / 配额） */
  }
}

async function loadFromAI(word: Word): Promise<ExampleSentence[]> {
  const list = await aiExampleSentences(word.word, word.meaning);
  if (list.length > 0) {
    const cache = readCache();
    cache[word.id] = list;
    writeCache(cache);
  }
  return list;
}

/**
 * 按 wordId 缓存例句到 localStorage（liquid-words:examples）。
 * - getExamples：命中缓存直接返回，未命中则拉取并写入缓存
 * - regenerate：强制重新生成一批（覆盖缓存）
 * 暴露 loading / error 状态。
 */
export function useExamples() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getExamples = useCallback(async (word: Word): Promise<ExampleSentence[]> => {
    const cache = readCache();
    if (cache[word.id]?.length) return cache[word.id];
    setLoading(true);
    setError(null);
    try {
      return await loadFromAI(word);
    } catch {
      setError('例句生成失败');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const regenerate = useCallback(async (word: Word): Promise<ExampleSentence[]> => {
    setLoading(true);
    setError(null);
    try {
      const list = await loadFromAI(word);
      if (list.length === 0) setError('例句生成失败');
      return list;
    } catch {
      setError('例句生成失败');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { getExamples, regenerate, loading, error };
}
