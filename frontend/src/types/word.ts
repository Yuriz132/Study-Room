export interface Word {
  id: number;
  part: string;
  list: string;
  word: string;
  phonetic: string;
  meaning: string;
}

export interface PartInfo {
  name: string;
  lists: ListInfo[];
  total: number;
}

export interface ListInfo {
  name: string;
  total: number;
}

export interface Progress {
  [listKey: string]: {
    reviewed: number;
    total: number;
  };
}

export type ListKey = string; // `${part}::${list}`

/** 自定义词库：用户自建的单词本 */
export interface CustomWord {
  word: string;
  phonetic?: string;
  meaning: string;
}

export interface CustomList {
  id: string;
  name: string;
  words: CustomWord[];
  createdAt: number;
}

/** 近义词 / 形近词辨析 */
export interface Confusable {
  words: string[];
  distinction: string;
  examples?: { word: string; text: string }[];
}
