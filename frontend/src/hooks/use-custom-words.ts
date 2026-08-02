import { useState, useCallback } from 'react';
import type { CustomList, CustomWord } from '@/types/word';

const KEY = 'liquid-words:custom-lists';

function read(): CustomList[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CustomList[]) : [];
  } catch {
    return [];
  }
}

function write(lists: CustomList[]) {
  localStorage.setItem(KEY, JSON.stringify(lists));
}

function uid(): string {
  return 'cl_' + Math.random().toString(36).slice(2, 10);
}

/** 自定义词库：所有数据存于本机 localStorage，无需登录即可使用 */
export function useCustomWords() {
  const [lists, setLists] = useState<CustomList[]>(() => read());

  const persist = useCallback((next: CustomList[]) => {
    setLists(next);
    write(next);
  }, []);

  const createList = useCallback(
    (name: string): string => {
      const list: CustomList = {
        id: uid(),
        name: name.trim() || '我的词库',
        words: [],
        createdAt: Date.now(),
      };
      persist([...lists, list]);
      return list.id;
    },
    [lists, persist]
  );

  const renameList = useCallback(
    (id: string, name: string) => {
      persist(lists.map((l) => (l.id === id ? { ...l, name: name.trim() || l.name } : l)));
    },
    [lists, persist]
  );

  const deleteList = useCallback(
    (id: string) => {
      persist(lists.filter((l) => l.id !== id));
    },
    [lists, persist]
  );

  const addWord = useCallback(
    (id: string, word: CustomWord) => {
      persist(
        lists.map((l) =>
          l.id === id ? { ...l, words: [...l.words, { ...word, word: word.word.trim() }] } : l
        )
      );
    },
    [lists, persist]
  );

  const addWords = useCallback(
    (id: string, words: CustomWord[]) => {
      const cleaned = words.map((w) => ({ ...w, word: w.word.trim() })).filter((w) => w.word);
      if (cleaned.length === 0) return;
      persist(
        lists.map((l) => (l.id === id ? { ...l, words: [...l.words, ...cleaned] } : l))
      );
    },
    [lists, persist]
  );

  const updateWord = useCallback(
    (id: string, index: number, word: CustomWord) => {
      persist(
        lists.map((l) => {
          if (l.id !== id) return l;
          const words = l.words.slice();
          words[index] = { ...word, word: word.word.trim() };
          return { ...l, words };
        })
      );
    },
    [lists, persist]
  );

  const removeWord = useCallback(
    (id: string, index: number) => {
      persist(
        lists.map((l) => {
          if (l.id !== id) return l;
          const words = l.words.slice();
          words.splice(index, 1);
          return { ...l, words };
        })
      );
    },
    [lists, persist]
  );

  const getList = useCallback((id?: string) => lists.find((l) => l.id === id), [lists]);

  return { lists, createList, renameList, deleteList, addWord, addWords, updateWord, removeWord, getList };
}
