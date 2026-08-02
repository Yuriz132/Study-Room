import wordMorphology from "@/assets/word-morphology.json";

/**
 * Word morphology (local static data, 0ms latency)
 * Source: word_roots_affixes.json (288 roots + 86 prefixes + 60 suffixes) reverse matching
 *        + confusables.json (12 known pairs) + Levenshtein distance algorithm
 */
export interface WordMorphology {
  roots: string;
  similar: { word: string; cn: string }[];
}

const DATA = wordMorphology as Record<string, { roots: string; similar: { word: string; cn: string }[] }>;

export function getLocalMorphology(word: string): WordMorphology | null {
  const key = word.toLowerCase().trim();
  const v = DATA[key];
  if (!v) return null;
  return {
    roots: v.roots || "",
    similar: Array.isArray(v.similar) ? v.similar : [],
  };
}
