import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Volume2, Check, X, Shuffle, RotateCcw, ChevronRight, Languages } from 'lucide-react';
import { allWords, partStructure, getWordsByList } from '@/lib/words-data';
import { useStarred } from '@/hooks/use-storage';
import { useWrongWords } from '@/hooks/use-wrong-words';
import { useCustomWords } from '@/hooks/use-custom-words';
import { speakWord } from '@/lib/speak';
import { cn } from '@/lib/utils';
import { FlyIn } from '@/components/MotionPrimitives';

interface QuizItem {
  word: string;
  phonetic: string;
  meaning: string;
}

type SourceType = 'builtin-all' | 'starred' | 'wrong' | 'custom' | 'builtin-list';
type QuizMode = 'en' | 'cn';

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Quiz() {
  const [params] = useSearchParams();
  const { starred } = useStarred();
  const { wrong, addWrong, clearWrong } = useWrongWords();
  const { lists, getList } = useCustomWords();

  const sourceParam = params.get('source') as SourceType | null;
  const idParam = params.get('id');

  const [source, setSource] = useState<SourceType>(sourceParam ?? 'builtin-all');
  const [customId, setCustomId] = useState<string>(idParam ?? '');
  const [part, setPart] = useState<string>('');
  const [list, setList] = useState<string>('');
  const [mode, setMode] = useState<QuizMode>('en');

  const [phase, setPhase] = useState<'setup' | 'playing' | 'done'>('setup');
  const [items, setItems] = useState<QuizItem[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [correct, setCorrect] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  const builtinLists = useMemo(() => partStructure, []);

  // 根据来源收集题目
  const buildItems = useCallback((): QuizItem[] => {
    let raw: QuizItem[] = [];
    if (source === 'builtin-all') {
      raw = allWords.map((w) => ({ word: w.word, phonetic: w.phonetic, meaning: w.meaning }));
    } else if (source === 'starred') {
      raw = allWords
        .filter((w) => starred.has(w.id))
        .map((w) => ({ word: w.word, phonetic: w.phonetic, meaning: w.meaning }));
    } else if (source === 'wrong') {
      raw = wrong.map((w) => ({ word: w.word, phonetic: w.phonetic ?? '', meaning: w.meaning }));
    } else if (source === 'custom') {
      const l = getList(customId);
      raw = l ? l.words.map((w) => ({ word: w.word, phonetic: w.phonetic ?? '', meaning: w.meaning })) : [];
    } else if (source === 'builtin-list') {
      raw = getWordsByList(part, list).map((w) => ({ word: w.word, phonetic: w.phonetic, meaning: w.meaning }));
    }
    return raw;
  }, [source, starred, wrong, customId, getList, part, list]);

  const start = () => {
    const raw = buildItems();
    if (raw.length === 0) return;
    setItems(shuffle(raw));
    setIndex(0);
    setInput('');
    setResult(null);
    setCorrect(0);
    setPhase('playing');
  };

  const current = items[index];

  const play = useCallback(() => {
    if (!current) return;
    if (mode === 'en') {
      speakWord(current.word);
    }
    // cn 模式：直接显示中文释义文字，不再播放语音
  }, [current, mode]);

  // 每题出现自动朗读
  useEffect(() => {
    if (phase === 'playing' && autoPlay && current) {
      const t = setTimeout(play, 250);
      return () => clearTimeout(t);
    }
  }, [phase, autoPlay, current, play]);

  const submit = () => {
    if (result || !current) return;
    const ok = input.trim().toLowerCase() === current.word.toLowerCase();
    if (ok) {
      setResult('correct');
      setCorrect((c) => c + 1);
    } else {
      setResult('wrong');
      addWrong({ word: current.word, phonetic: current.phonetic, meaning: current.meaning });
    }
  };

  const next = () => {
    if (index + 1 >= items.length) {
      setPhase('done');
    } else {
      setIndex((i) => i + 1);
      setInput('');
      setResult(null);
    }
  };

  // === 设置页 ===
  if (phase === 'setup') {
    const canStart = (() => {
      if (source === 'builtin-list') return !!part && !!list;
      if (source === 'custom') return !!customId && (getList(customId)?.words.length ?? 0) > 0;
      return buildItems().length > 0;
    })();

    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <FlyIn>
          <h1 className="mb-1 font-bold text-foreground" style={{ fontSize: 'var(--font-size-headline)' }}>
            听写拼写测验
          </h1>
          <p className="mb-6 text-muted-foreground">听英文写单词，或看中文释义拼英文。拼错会自动进入错词本。</p>

          {/* 模式选择 */}
          <div className="liquid-glass mb-4 rounded-2xl p-5">
            <label className="mb-2 block text-sm font-medium text-foreground">测验模式</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('en')}
                className={cn(
                  'liquid-glass liquid-glass-shine flex items-center gap-2 rounded-lg px-4 py-3 text-sm transition-all active:scale-95',
                  mode === 'en' ? 'liquid-glass-accent text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Volume2 className="h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">英文听写</div>
                  <div className="text-xs opacity-70">听英文发音，写英文单词</div>
                </div>
              </button>
              <button
                onClick={() => setMode('cn')}
                className={cn(
                  'liquid-glass liquid-glass-shine flex items-center gap-2 rounded-lg px-4 py-3 text-sm transition-all active:scale-95',
                  mode === 'cn' ? 'liquid-glass-accent text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Languages className="h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">看汉语写英语</div>
                  <div className="text-xs opacity-70">看中文释义，写出英文单词</div>
                </div>
              </button>
            </div>
          </div>

          <div className="liquid-glass rounded-2xl p-5">
            <label className="mb-2 block text-sm font-medium text-foreground">选择词源</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {([
                ['builtin-all', '全部内置'],
                ['starred', '我的生词本'],
                ['wrong', `错词本 (${wrong.length})`],
                ['custom', '自定义词库'],
                ['builtin-list', '内置单元'],
              ] as [SourceType, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setSource(val)}
                  className={cn(
                    'liquid-glass liquid-glass-shine rounded-lg px-3 py-2.5 text-sm transition-all active:scale-95',
                    source === val ? 'liquid-glass-accent text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {source === 'custom' && (
              <div className="mt-4">
                <select
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value)}
                  className="liquid-glass h-10 w-full rounded-lg g-panel px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="">选择词库…</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}（{l.words.length}）</option>
                  ))}
                </select>
              </div>
            )}

            {source === 'builtin-list' && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <select
                  value={part}
                  onChange={(e) => { setPart(e.target.value); setList(''); }}
                  className="liquid-glass h-10 rounded-lg g-panel px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="">选择 Part…</option>
                  {builtinLists.map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={list}
                  onChange={(e) => setList(e.target.value)}
                  disabled={!part}
                  className="liquid-glass h-10 rounded-lg g-panel px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
                >
                  <option value="">选择 List…</option>
                  {builtinLists.find((p) => p.name === part)?.lists.map((l) => (
                    <option key={l.name} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}

            <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={autoPlay} onChange={(e) => setAutoPlay(e.target.checked)} />
              每题自动播放发音
            </label>
          </div>

          <button
            onClick={start}
            disabled={!canStart}
            className={cn(
              'liquid-glass liquid-glass-shine mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-medium transition-all active:scale-95',
              canStart ? 'liquid-glass-accent text-primary hover:-translate-y-0.5' : 'cursor-not-allowed text-muted-foreground/40'
            )}
          >
            <Volume2 className="h-4 w-4" /> 开始测验
          </button>
        </FlyIn>
      </div>
    );
  }

  // === 完成页 ===
  if (phase === 'done') {
    const total = items.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <FlyIn>
          <div className="liquid-glass rounded-2xl p-8 text-center">
            <div className="text-5xl font-bold text-gradient" style={{ fontSize: 'var(--font-size-display)' }}>{pct}%</div>
            <p className="mt-2 text-muted-foreground">正确 {correct} / {total}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => { setPhase('setup'); }}
                className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm text-muted-foreground transition-all hover:text-foreground active:scale-95"
              >
                <RotateCcw className="h-4 w-4" /> 再选词源
              </button>
              <button
                onClick={start}
                className="liquid-glass-accent liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium text-primary transition-all hover:-translate-y-0.5 active:scale-95"
              >
                <Shuffle className="h-4 w-4" /> 再测一次
              </button>
              {wrong.length > 0 && (
                <Link
                  to="/quiz?source=wrong"
                  className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm text-muted-foreground transition-all hover:text-foreground active:scale-95"
                >
                  复习错词 ({wrong.length}) <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
            {wrong.length > 0 && (
              <button
                onClick={() => { if (window.confirm('清空错词本？')) clearWrong(); }}
                className="mt-4 text-xs text-muted-foreground/70 underline-offset-2 hover:underline"
              >
                清空错词本
              </button>
            )}
          </div>
        </FlyIn>
      </div>
    );
  }

  // === 答题页 ===
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <span className="font-mono">{index + 1} / {items.length}</span>
        <span>{mode === 'en' ? '英文听写' : '看汉语写英语'} · 正确 {correct}</span>
      </div>
      <div className="mb-5 h-1 w-full overflow-hidden rounded-full g-panel">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((index + 1) / items.length) * 100}%` }} />
      </div>

      <div className="liquid-glass rounded-2xl p-6">
        <div className="flex items-center justify-center gap-3">
          {mode === 'en' ? (
            <button
              onClick={play}
              className="liquid-glass liquid-glass-shine flex items-center gap-2 rounded-full px-6 py-3 text-primary transition-all hover:-translate-y-0.5 active:scale-95"
            >
              <Volume2 className="h-5 w-5" />
              播放发音
            </button>
          ) : (
            /* cn 模式：直接展示中文释义 */
            <div className="max-w-md px-4 py-6 text-center">
              <p className="text-lg font-medium leading-relaxed text-primary/90">{current?.meaning}</p>
            </div>
          )}
        </div>
        {/* 英文听写模式可显示音标提示；cn 模式显示提示语 */}
        {mode === 'en' && current.phonetic && (
          <p className="mt-3 text-center font-mono text-sm text-muted-foreground/60">音标：{current.phonetic}</p>
        )}
        {mode === 'cn' && (
          <p className="mt-2 text-center text-sm text-muted-foreground/60">根据上方中文释义，写出对应的英文单词</p>
        )}

        <input
          autoFocus
          value={input}
          disabled={result !== null}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { if (result) next(); else submit(); } }}
          placeholder="写出英文单词…"
          className={cn(
            'liquid-glass mt-5 h-12 w-full rounded-xl g-panel px-4 text-center text-lg text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50',
            result === 'correct' && 'ring-1 ring-success',
            result === 'wrong' && 'ring-1 ring-destructive'
          )}
        />

        {result === 'correct' && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-success">
            <Check className="h-4 w-4" /> 正确！{current.word}
          </p>
        )}
        {result === 'wrong' && (
          <div className="mt-3 text-center text-sm">
            <p className="flex items-center justify-center gap-1.5 text-destructive">
              <X className="h-4 w-4" /> 正确答案：{current.word}
            </p>
            <p className="mt-1 text-muted-foreground">{current.meaning}</p>
          </div>
        )}

        <div className="mt-5 flex justify-center">
          {result === null ? (
            <button
              onClick={submit}
              disabled={!input.trim()}
              className="liquid-glass-accent liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-full px-8 py-2.5 text-sm font-medium text-primary transition-all hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:text-muted-foreground/40"
            >
              确认
            </button>
          ) : (
            <button
              onClick={next}
              className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-full px-8 py-2.5 text-sm text-foreground transition-all hover:-translate-y-0.5 active:scale-95"
            >
              {index + 1 >= items.length ? '查看结果' : '下一题'} <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
