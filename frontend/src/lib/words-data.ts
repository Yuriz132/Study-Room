import wordsData from '@/assets/words.json';
import wordsCategorized from '@/assets/words-categorized.json';
import type { Word, PartInfo, ListInfo } from '@/types/word';

/** 分类认知词表 + 内置词库，合并为统一词库（认知词排在最前） */
export const allWords: Word[] = [
  ...(wordsCategorized as Word[]),
  ...(wordsData as Word[]),
];

/** 构建 Part -> List 结构 */
export function buildStructure(): PartInfo[] {
  const partMap = new Map<string, Map<string, number>>();
  for (const w of allWords) {
    if (!partMap.has(w.part)) partMap.set(w.part, new Map());
    const listMap = partMap.get(w.part)!;
    listMap.set(w.list, (listMap.get(w.list) ?? 0) + 1);
  }

  const parts: PartInfo[] = [];
  for (const [partName, listMap] of partMap) {
    const lists: ListInfo[] = [];
    let total = 0;
    for (const [listName, count] of listMap) {
      lists.push({ name: listName, total: count });
      total += count;
    }
    parts.push({ name: partName, lists, total });
  }
  return parts;
}

export const partStructure = buildStructure();

export function getListKey(part: string, list: string): string {
  return `${part}::${list}`;
}

export function getWordsByList(part: string, list: string): Word[] {
  return allWords.filter((w) => w.part === part && w.list === list);
}

export function getWordsByPart(part: string): Word[] {
  return allWords.filter((w) => w.part === part);
}

export function searchWords(query: string): Word[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return allWords.filter(
    (w) =>
      w.word.toLowerCase().includes(q) ||
      w.phonetic.toLowerCase().includes(q) ||
      w.meaning.toLowerCase().includes(q)
  );
}

export function getWordById(id: number): Word | undefined {
  return allWords.find((w) => w.id === id);
}
