import apiClient, { API_BASE } from './api-client';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface ChatOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  onChunk?: (text: string) => void;
}

/** Chat (with optional streaming) */
export async function aiChat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  if (opts.onChunk) {
    const token = localStorage.getItem('auth_token');
    const r = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ messages, model: opts.model, max_tokens: opts.max_tokens, temperature: opts.temperature, stream: true }),
      signal: opts.signal,
    });
    if (!r.ok) {
      let msg = `AI 服务错误 (${r.status})`;
      try { const j = await r.json(); if (j?.message) msg = j.message; } catch {}
      throw new Error(msg);
    }
    const reader = r.body?.getReader();
    if (!reader) throw new Error('No stream');
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    const handleLine = (rawLine: string) => {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) return;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') return;
      try {
        const delta: any = JSON.parse(payload);
        const chunk = delta?.choices?.[0]?.delta?.content || '';
        if (chunk) { full += chunk; opts.onChunk!(chunk); }
      } catch {}
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const line of parts) handleLine(line);
    }
    if (buffer) handleLine(buffer);
    return full;
  }
  const { data } = await apiClient.post<{ content: string; model: string }>('/ai/chat', {
    messages, model: opts.model, max_tokens: opts.max_tokens, temperature: opts.temperature,
  });
  return data.content || '';
}

export interface ExtractedWord { word: string; phonetic?: string; meaning: string; }

export async function aiExtractWordsFromImage(opts: {
  imageDataUrl: string; hint?: string; signal?: AbortSignal;
}): Promise<{ words: ExtractedWord[]; raw?: string }> {
  const { data } = await apiClient.post<{ words: ExtractedWord[]; raw?: string }>(
    '/ai/vision/extract-words', { image: opts.imageDataUrl, hint: opts.hint }
  );
  return data;
}

/** 笔记图片解析：把一张或多张笔记图片整理为结构化中文说明（而非仅提取单词） */
export async function aiAnalyzeNote(opts: {
  imageDataUrls: string[]; hint?: string; signal?: AbortSignal;
}): Promise<{ analysis: string; raw?: string }> {
  const { data } = await apiClient.post<{ analysis: string; raw?: string }>(
    '/ai/vision/analyze-note', { images: opts.imageDataUrls, hint: opts.hint }
  )
  return data
}

export async function aiPersonalSummary(stats: {
  totalWords: number; totalReviewed: number; knownCount: number;
  starredCount: number; streak: number; dailyAverage: number; topPart?: string;
}): Promise<string> {
  return aiChat([
    { role: 'system', content: '基于学习数据给100-200字中文建议，正文输出，不要列点或markdown标题。' },
    { role: 'user', content: JSON.stringify(stats) },
  ], { max_tokens: 2000, temperature: 0.8 });
}

export async function aiGenerateArticle(opts: { learnedWords: string[]; targetWords: number; title?: string; }): Promise<{ title: string; content: string; usedWords: string[] }> {
  const sys = `基于已学单词列表，写${opts.targetWords}词英语短文。
输出 JSON：{"title":"..","content":"..","usedWords":[..]}
仅返回 JSON。`;
  const text = await aiChat([
    { role: 'system', content: sys },
    { role: 'user', content: `已学（${opts.learnedWords.length}）：${opts.learnedWords.join(', ')}。${opts.title ? '主题：' + opts.title : ''}` },
  ], { model: 'agnes-2.5-flash', max_tokens: 3000, temperature: 0.85 });
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : { title: opts.title || 'Article', content: text, usedWords: [] };
  } catch { return { title: opts.title || 'Article', content: text, usedWords: [] }; }
}

export interface WordAIDetail {
  cnMeaning: string; enDef: string; example: string;
  similarWords: { word: string; cn: string }[];
  phrases: { en: string; cn: string }[];
  tenses: string[];
}
const EMPTY_DETAIL: WordAIDetail = { cnMeaning:'', enDef:'', example:'', similarWords:[], phrases:[], tenses:[] };

export async function aiExplainWord(word: string, meaning: string): Promise<WordAIDetail> {
  const sys = `分析单词，严格 JSON: {"cnMeaning":"6-12字中文","enDef":"≤10词英文","example":"英文例句 / 中文","similarWords":[{"word","cn"}],"phrases":[{"en","cn"}],"tenses":[]}`;
  const text = await aiChat([
    { role:'system', content: sys },
    { role:'user', content: `单词:${word}\n中文:${meaning}\n输出JSON。` }
  ], { model:'agnes-2.5-flash', max_tokens:2000, temperature:0.3 });
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return EMPTY_DETAIL;
    const obj = JSON.parse(m[0]);
    return {
      cnMeaning:String(obj.cnMeaning||'').trim(),
      enDef:String(obj.enDef||'').trim(),
      example:String(obj.example||'').trim(),
      similarWords:Array.isArray(obj.similarWords)?obj.similarWords.map((x:any)=>({word:String(x?.word||'').trim(),cn:String(x?.cn||'').trim()})).filter((x:any)=>x.word):[],
      phrases:Array.isArray(obj.phrases)?obj.phrases.map((x:any)=>({en:String(x?.en||'').trim(),cn:String(x?.cn||'').trim()})).filter((x:any)=>x.en):[],
      tenses:Array.isArray(obj.tenses)?obj.tenses.map((x:any)=>String(x).trim()).filter(Boolean):[],
    };
  } catch { return EMPTY_DETAIL; }
}

const EXPLAIN_CACHE_KEY='liquid-words:explain';
type ExplainCache=Record<string,WordAIDetail>;
let explainCache:ExplainCache|null=null;
function loadExplainCache():ExplainCache{if(explainCache)return explainCache;try{const raw=localStorage.getItem(EXPLAIN_CACHE_KEY);explainCache=raw?(JSON.parse(raw)as ExplainCache):{};}catch{explainCache={};}return explainCache;}
function saveExplainCache(c:ExplainCache){explainCache=c;try{localStorage.setItem(EXPLAIN_CACHE_KEY,JSON.stringify(c));}catch{}}
export function getCachedExplain(word:string):WordAIDetail|undefined{return loadExplainCache()[word.toLowerCase()];}
export function setCachedExplain(word:string,detail:WordAIDetail):void{const c=loadExplainCache();c[word.toLowerCase()]=detail;saveExplainCache(c);}
export async function aiExplainWordCached(word:string,meaning:string):Promise<WordAIDetail>{const hit=getCachedExplain(word);if(hit)return hit;const detail=await aiExplainWord(word,meaning);setCachedExplain(word,detail);return detail;}

export interface ExampleSentence{en:string;zh:string;}
export async function aiExampleSentences(word:string,meaning:string):Promise<ExampleSentence[]>{
  const text=await aiChat([
    {role:'system',content:'生成2-3个例句，输出JSON:{"sentences":[{"en","zh"}]}'},
    {role:'user',content:`单词:${word}\n中文:${meaning}`}
  ],{model:'agnes-2.5-flash',max_tokens:2000,temperature:0.6});
  try{
    const m=text.match(/\{[\s\S]*\}/);if(!m)return[];
    const obj=JSON.parse(m[0]);
    const arr=Array.isArray(obj.sentences)?obj.sentences:[];
    return arr.map((x:any)=>({en:String(x?.en||'').trim(),zh:String(x?.zh||'').trim()})).filter((x:any)=>x.en);
  }catch{return[];}
}

// ============================================================
// 词根词缀 + 形近词：本地查表（0ms）
// ============================================================
export { getLocalMorphology as aiWordMorphologyCached } from '@/lib/morphology';
export type { WordMorphology } from '@/lib/morphology';

export interface Proverb { en: string; zh: string; }
export const PROVERB_FALLBACKS: Proverb[] = [
  { en: "Where there is a will, there is a way.", zh: "有志者，事竟成。" },
  { en: "Practice makes perfect.", zh: "熟能生巧。" },
  { en: "A journey of a thousand miles begins with a single step.", zh: "千里之行，始于足下。" },
  { en: "Actions speak louder than words.", zh: "事实胜于雄辩。" },
  { en: "Knowledge is power.", zh: "知识就是力量。" },
  { en: "Better late than never.", zh: "迟做总比不做好。" },
  { en: "Well begun is half done.", zh: "良好的开端是成功的一半。" },
];

export async function aiDailyProverb(): Promise<Proverb> {
  const sys = `返回英语谚语+中文注释，JSON: {"en":"..","zh":".."}`;
  try {
    const text = await aiChat([
      { role: "system", content: sys },
      { role: "user", content: "经典英语谚语。" },
    ], { max_tokens: 200, temperature: 0.95 });
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const obj = JSON.parse(m[0]);
      const en = String(obj.en || "").trim();
      const zh = String(obj.zh || "").trim();
      if (en && zh) return { en, zh };
    }
  } catch {}
  return PROVERB_FALLBACKS[Math.floor(Math.random() * PROVERB_FALLBACKS.length)];
}

// ============================================================
// Mimo 学习助手（后端代理 /api/ai/mimo，密钥在服务端，对话由前端本地保存）
// 模型：mimo-v2.5；非流式，稳定返回完整文本。
// ============================================================
export async function mimoChat(
  messages: ChatMessage[],
  opts: { max_tokens?: number; temperature?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const { data } = await apiClient.post<{ content: string; model: string }>('/ai/mimo', {
    messages,
    max_tokens: opts.max_tokens,
    temperature: opts.temperature,
  })
  return data.content || ''
}

