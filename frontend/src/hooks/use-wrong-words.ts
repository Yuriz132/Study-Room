import { useState, useCallback } from 'react';

const KEY = 'liquid-words:wrong-words';

export interface WrongWord {
  word: string;
  phonetic?: string;
  meaning: string;
}

function read(): WrongWord[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WrongWord[]) : [];
  } catch {
    return [];
  }
}

function write(items: WrongWord[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

/** 错词本：听音写词测验中拼错的单词会归集到这里，可单独复习 */
export function useWrongWords() {
  const [wrong, setWrong] = useState<WrongWord[]>(() => read());

  const addWrong = useCallback((w: WrongWord) => {
    setWrong((prev) => {
      if (prev.some((x) => x.word.toLowerCase() === w.word.toLowerCase())) return prev;
      const next = [w, ...prev];
      write(next);
      return next;
    });
  }, []);

  const clearWrong = useCallback(() => {
    setWrong([]);
    write([]);
  }, []);

  const removeWrong = useCallback((word: string) => {
    setWrong((prev) => {
      const next = prev.filter((x) => x.word.toLowerCase() !== word.toLowerCase());
      write(next);
      return next;
    });
  }, []);

  return { wrong, addWrong, clearWrong, removeWrong, count: wrong.length };
}
