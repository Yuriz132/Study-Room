import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Plus, BookMarked, Pencil, Trash2, Play, Volume2, X, ChevronRight, FileText, Check, UploadCloud, Sparkles, FileUp } from 'lucide-react';
import { useCustomWords } from '@/hooks/use-custom-words';
import type { CustomWord } from '@/types/word';
import { speakWord } from '@/lib/speak';
import { FlyIn, Stagger } from '@/components/MotionPrimitives';
import { AIImportPanel } from '@/components/AIImportPanel';

/** 解析批量导入文本：每行一个单词
 *  支持格式（用竖线 | 或制表符分隔，音标可省略）：
 *    apple | /ˈæpl/ | 苹果
 *    book | 书
 */
function parseBulk(text: string): { words: CustomWord[]; invalid: string[] } {
  const words: CustomWord[] = [];
  const invalid: string[] = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let word = '';
    let phonetic: string | undefined;
    let meaning = '';
    if (line.includes('|')) {
      const parts = line.split('|').map((s) => s.trim());
      word = parts[0] || '';
      if (parts.length >= 3) {
        phonetic = parts[1] || undefined;
        meaning = parts.slice(2).join(' | ');
      } else if (parts.length === 2) {
        meaning = parts[1];
      }
    } else if (line.includes('\t')) {
      const parts = line.split('\t').map((s) => s.trim());
      word = parts[0] || '';
      meaning = parts.slice(1).join(' ');
    } else {
      const parts = line.split(/\s+/);
      word = parts[0] || '';
      meaning = parts.slice(1).join(' ');
    }
    if (!word) {
      invalid.push(raw);
      continue;
    }
    words.push({ word, phonetic, meaning });
  }
  return { words, invalid };
}

export default function CustomLibrary() {
  const { listId } = useParams();
  const navigate = useNavigate();
  const { lists, createList, renameList, deleteList, addWord, addWords, updateWord, removeWord, getList } = useCustomWords();

  const [newListName, setNewListName] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const active = listId ? getList(listId) : undefined;

  if (active) {
    return (
      <ListDetail
        list={active}
        onBack={() => navigate('/custom')}
        onRename={(name) => renameList(active.id, name)}
        onDelete={() => {
          deleteList(active.id);
          navigate('/custom');
        }}
        onAddWord={(w) => addWord(active.id, w)}
        onAddWords={(ws) => addWords(active.id, ws)}
        onUpdateWord={(i, w) => updateWord(active.id, i, w)}
        onRemoveWord={(i) => removeWord(active.id, i)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <FlyIn>
        <div className="liquid-glass mb-6 overflow-hidden p-5 text-center sm:p-7"
          style={{ borderRadius: 'calc(var(--radius) + 12px)' }}
        >
          <h1 className="font-bold text-foreground"
            style={{ fontSize: 'clamp(1.4rem, 5vw, 1.8rem)', lineHeight: 1.1 }}
          >
            <Sparkles className="inline h-5 w-5 text-primary" /> 自定义词库
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            打造专属单词本，AI 拍照/上传图片一键整理 · 翻卡学习 · 听音写词
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 max-w-sm mx-auto">
            <button
              onClick={() => setAdding(true)}
              className="liquid-glass-accent liquid-glass liquid-glass-shine card-bounce flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-primary transition-all hover:-translate-y-0.5 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" /> 新建词库
            </button>
            <button
              onClick={() => {
                const name = window.prompt('给词库起个名字：', '我的图片词库')?.trim();
                if (!name) return;
                const id = createList(name);
                navigate(`/custom/${id}?autoImport=1`);
              }}
              className="liquid-glass liquid-glass-shine card-bounce flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs text-primary transition-all hover:-translate-y-0.5 active:scale-95"
            >
              <UploadCloud className="h-3.5 w-3.5" /> 图片一键导入
            </button>
          </div>
        </div>
      </FlyIn>

      {adding && (
        <div className="liquid-glass mb-6 flex items-center gap-2 rounded-xl p-3">
          <input
            autoFocus
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newListName.trim()) {
                const id = createList(newListName);
                setNewListName('');
                setAdding(false);
                navigate(`/custom/${id}`);
              }
            }}
            placeholder="词库名称，如「高频考点」"
            className="liquid-glass h-10 flex-1 rounded-lg g-panel px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={() => {
              if (newListName.trim()) {
                const id = createList(newListName);
                setNewListName('');
                setAdding(false);
                navigate(`/custom/${id}`);
              }
            }}
            className="liquid-glass liquid-glass-shine flex h-10 items-center rounded-lg px-4 text-sm text-primary transition-all active:scale-95"
          >
            创建
          </button>
          <button
            onClick={() => { setAdding(false); setNewListName(''); }}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-all hover:g-panel active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {lists.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground/70">
          还没有词库，点击右上角「新建词库」开始添加你自己的单词吧～
        </p>
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" stagger={0.07}>
          {lists.map((l) => (
            <div
              key={l.id}
              className="liquid-glass liquid-glass-shine group flex flex-col items-start p-5 transition-all hover:-translate-y-1"
              style={{ borderRadius: 'var(--radius-lg)' }}
            >
              <button
                onClick={() => navigate(`/custom/${l.id}`)}
                className="flex w-full flex-col items-start text-left"
              >
                <div className="mb-2 flex w-full items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold text-foreground">
                    <BookMarked className="h-4 w-4 text-primary" />
                    {l.name}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
                <div className="text-sm text-muted-foreground">{l.words.length} 个单词</div>
              </button>

              {confirmId === l.id ? (
                <div className="mt-3 flex w-full items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  确认删除？
                  <button
                    onClick={() => { deleteList(l.id); setConfirmId(null); }}
                    className="ml-auto flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-xs text-white transition-all active:scale-95"
                  >
                    <Check className="h-3.5 w-3.5" /> 删除
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-all hover:g-panel active:scale-95"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmId(l.id)}
                  className="mt-3 flex items-center gap-1 text-xs text-muted-foreground transition-all hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> 删除
                </button>
              )}
            </div>
          ))}
        </Stagger>
      )}
    </div>
  );
}

interface ListDetailProps {
  list: { id: string; name: string; words: { word: string; phonetic?: string; meaning: string }[] };
  onBack: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddWord: (w: CustomWord) => void;
  onAddWords: (ws: CustomWord[]) => void;
  onUpdateWord: (i: number, w: CustomWord) => void;
  onRemoveWord: (i: number) => void;
}

function ListDetail({ list, onBack, onRename, onDelete, onAddWord, onAddWords, onUpdateWord, onRemoveWord }: ListDetailProps) {
  const [word, setWord] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [meaning, setMeaning] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [searchParams] = useSearchParams();
  const autoOpen = searchParams.get('autoImport') === '1';

  // 批量导入状态
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const parsed = importText.trim() ? parseBulk(importText) : { words: [], invalid: [] };

  // ── txt 文件导入 ──
  const txtFileRef = useRef<HTMLInputElement>(null);
  const [txtFileName, setTxtFileName] = useState('');
  const [txtParsed, setTxtParsed] = useState<{ words: CustomWord[]; invalid: string[] } | null>(null);

  const handleTxtFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTxtFileName(file.name);
    try {
      const text = await file.text();
      const result = parseBulk(text);
      setTxtParsed(result);
    } catch {
      setTxtParsed({ words: [], invalid: [] });
    }
    // 重置 input 以便同一文件可重复选择
    if (txtFileRef.current) txtFileRef.current.value = '';
  }, []);

  const doTxtImport = useCallback(() => {
    if (!txtParsed || txtParsed.words.length === 0) return;
    onAddWords(txtParsed.words);
    setTxtFileName('');
    setTxtParsed(null);
  }, [txtParsed, onAddWords]);

  const submit = () => {
    if (!word.trim()) return;
    const w: CustomWord = { word: word.trim(), phonetic: phonetic.trim() || undefined, meaning: meaning.trim() };
    if (editing !== null) {
      onUpdateWord(editing, w);
      setEditing(null);
    } else {
      onAddWord(w);
    }
    setWord('');
    setPhonetic('');
    setMeaning('');
  };

  const doImport = () => {
    if (parsed.words.length === 0) return;
    onAddWords(parsed.words);
    setImportText('');
    setShowImport(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={onBack} className="hover:text-foreground">词库</button>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{list.name}</span>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          defaultValue={list.name}
          onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== list.name) onRename(e.target.value); }}
          className="liquid-glass h-9 rounded-lg g-panel px-3 text-sm font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary/50"
        />
        <Link
          to={`/flashcards/custom/${list.id}`}
          className="liquid-glass-accent liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-primary transition-all hover:-translate-y-0.5 active:scale-95"
        >
          <Play className="h-4 w-4" /> 翻卡学习
        </Link>
        <Link
          to={`/quiz?source=custom&id=${list.id}`}
          className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-foreground active:scale-95"
        >
          <Volume2 className="h-4 w-4" /> 听音写词
        </Link>
        {confirmDelete ? (
          <span className="ml-auto flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-1.5 text-sm text-destructive">
            确认删除？
            <button onClick={onDelete} className="flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-xs text-white transition-all active:scale-95">
              <Check className="h-3.5 w-3.5" /> 删除
            </button>
            <button onClick={() => setConfirmDelete(false)} className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-all hover:g-panel active:scale-95">
              取消
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-destructive transition-all hover:bg-destructive/10 active:scale-95"
          >
            <Trash2 className="h-4 w-4" /> 删除词库
          </button>
        )}
      </div>

      {/* 添加 / 编辑单词 */}
      <div className="liquid-glass mb-3 rounded-2xl p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="英文单词"
            className="liquid-glass h-10 rounded-lg g-panel px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
          />
          <input
            value={phonetic}
            onChange={(e) => setPhonetic(e.target.value)}
            placeholder="音标（可选）"
            className="liquid-glass h-10 rounded-lg g-panel px-3 text-sm font-mono text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
          />
          <input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="中文释义"
            className="liquid-glass h-10 rounded-lg g-panel px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={submit}
            className="liquid-glass liquid-glass-shine flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-sm text-primary transition-all active:scale-95"
          >
            {editing !== null ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editing !== null ? '保存' : '添加'}
          </button>
        </div>
        <button
          onClick={() => setShowImport((v) => !v)}
          className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground transition-all hover:text-primary"
        >
          <FileText className="h-3.5 w-3.5" /> {showImport ? '收起批量导入' : '批量导入（一键粘贴多词）'}
        </button>
        {/* 隐藏的 txt 文件选择器 */}
        <input
          ref={txtFileRef}
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          onChange={handleTxtFileChange}
        />
        <button
          onClick={() => txtFileRef.current?.click()}
          className="mt-2 flex items-center gap-1.5 text-xs text-primary transition-all hover:text-primary/80"
        >
          <FileUp className="h-3.5 w-3.5" /> 从 txt 文件导入
        </button>
      </div>

      {/* AI 智能导入（上传图片/拍照），支持 autoOpen 触发文件选择器 */}
      <AIImportPanel
        onImport={onAddWords}
        autoOpen={autoOpen}
      />

      {/* 批量导入 */}
      {showImport && (
        <div className="liquid-glass mb-6 rounded-2xl p-4">
          <p className="mb-2 text-xs text-muted-foreground">
            每行一个单词，用 <span className="font-mono text-foreground">|</span> 分隔（音标可省略）：
          </p>
          <pre className="mb-3 rounded-lg g-panel px-3 py-2 text-xs leading-relaxed text-muted-foreground">
{`apple | /ˈæpl/ | 苹果
book | 书
teacher | /ˈtiːtʃə/ | 老师`}
          </pre>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            placeholder={'apple | /ˈæpl/ | 苹果\nbook | 书'}
            className="liquid-glass h-36 w-full rounded-lg g-panel px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
          />
          {importText.trim() && (
            <p className="mt-2 text-xs text-muted-foreground">
              将导入 <span className="text-primary">{parsed.words.length}</span> 个单词
              {parsed.invalid.length > 0 && <span className="text-destructive">（{parsed.invalid.length} 行格式无法识别，已忽略）</span>}
            </p>
          )}
          <button
            onClick={doImport}
            disabled={parsed.words.length === 0}
            className="liquid-glass-accent liquid-glass liquid-glass-shine mt-3 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-primary transition-all active:scale-95 disabled:cursor-not-allowed disabled:text-muted-foreground/40"
          >
            <Check className="h-4 w-4" /> 导入 {parsed.words.length} 个单词
          </button>
        </div>
      )}

      {/* txt 文件导入结果 */}
      {txtParsed && (
        <div className="liquid-glass mb-6 rounded-2xl p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              📄 文件：<span className="font-medium text-foreground">{txtFileName}</span>
            </p>
            <button
              onClick={() => { setTxtFileName(''); setTxtParsed(null); }}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="inline h-3 w-3" /> 清除
            </button>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            检测到 <span className="text-primary font-semibold">{txtParsed.words.length}</span> 个单词
            {txtParsed.invalid.length > 0 && <span className="text-destructive">（{txtParsed.invalid.length} 行无法识别）</span>}
          </p>
          {txtParsed.words.length > 0 && (
            <pre className="max-h-32 overflow-auto rounded-lg g-panel px-3 py-2 text-xs leading-relaxed text-muted-foreground">
{txtParsed.words.slice(0, 20).map((w) => w.word).join('\n')}
{txtParsed.words.length > 20 ? `\n... 等 ${txtParsed.words.length} 个单词` : ''}
            </pre>
          )}
          <button
            onClick={doTxtImport}
            disabled={txtParsed.words.length === 0}
            className="liquid-glass-accent liquid-glass liquid-glass-shine mt-3 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-primary transition-all active:scale-95 disabled:cursor-not-allowed disabled:text-muted-foreground/40"
          >
            <Check className="h-4 w-4" /> 确认导入 {txtParsed.words.length} 个单词
          </button>
        </div>
      )}

      {list.words.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground/70">还没有单词，在上方添加或批量导入吧～</p>
      ) : (
        <div className="space-y-2">
          {list.words.map((w, i) => (
            <div
              key={i}
              className="liquid-glass flex items-center gap-3 rounded-xl px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{w.word}</span>
                  {w.phonetic && <span className="font-mono text-xs text-muted-foreground">{w.phonetic}</span>}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{w.meaning}</p>
              </div>
              <button
                onClick={() => speakWord(w.word)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:g-panel hover:text-primary active:scale-90"
                aria-label="发音"
              >
                <Volume2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setWord(w.word);
                  setPhonetic(w.phonetic ?? '');
                  setMeaning(w.meaning);
                  setEditing(i);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:g-panel hover:text-foreground active:scale-90"
                aria-label="编辑"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => onRemoveWord(i)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-90"
                aria-label="删除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
