import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  Loader2,
  X,
  Plus,
  Trash2,
  Sparkles,
  Brain,
  Lightbulb,
  FileQuestion,
  ListChecks,
} from 'lucide-react';
import {
  listCollections,
  createCollection,
  deleteCollection,
  addItem,
  removeItem,
  wrongbookChat,
  type WrongCollection,
  type WrongItem,
} from '@/lib/wrongbook';
import { getErrorMessage } from '@/lib/api-client';

/** 压缩图片到合理大小（最长边 1600px，JPEG 0.85），复用 AI 导入的压缩策略 */
async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      let { width, height } = img;
      if (width > max || height > max) {
        if (width > height) {
          height = Math.round((height * max) / width);
          width = max;
        } else {
          width = Math.round((width * max) / height);
          height = max;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** 四个 AI 快捷动作 */
const QUICK_ACTIONS = [
  {
    label: '分析不足',
    icon: <Brain className="h-3.5 w-3.5" />,
    prompt:
      '请分析我在这些错题中暴露出的知识薄弱点，按高频错误类型归类，并指出对应的知识点与改进方向。',
  },
  {
    label: '生成知识点',
    icon: <Lightbulb className="h-3.5 w-3.5" />,
    prompt: '请基于这些错题，提炼关键知识点（词汇/语法/句型），并给出易记的记忆要点。',
  },
  {
    label: '生成新题',
    icon: <FileQuestion className="h-3.5 w-3.5" />,
    prompt: '请基于这些错题涉及的考点，为我生成 3 道类似的新练习题，给出答案与解析。',
  },
  {
    label: '生成建议',
    icon: <ListChecks className="h-3.5 w-3.5" />,
    prompt: '请根据我的错题情况，给出一份针对性的复习建议与短期学习计划。',
  },
];

interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
}

/** 隔离的 AI 对话（仅基于当前合集错题），key=collection.id 由父组件控制以在切换合集时重置 */
function WrongBookChat({
  collection,
  onChatDone,
}: {
  collection: WrongCollection;
  onChatDone: () => void;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(() =>
    (collection.messages || []).map((m) => ({ role: m.role, text: m.text })),
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, loading]);

  const send = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? input).trim();
      if (!text || loading) return;
      const userMsg: ChatMsg = { role: 'user', text };
      const placeholder: ChatMsg = { role: 'assistant', text: '正在思考…' };
      const base = [...msgs, userMsg];
      setMsgs([...base, placeholder]);
      setInput('');
      setLoading(true);
      try {
        const answer = await wrongbookChat(
          collection.id,
          base.map((m) => ({ role: m.role, text: m.text })),
        );
        const finalMsgs: ChatMsg[] = [
          ...base,
          { role: 'assistant', text: answer || '⚠️ AI 没有返回内容，请重试。' },
        ];
        setMsgs(finalMsgs);
        onChatDone();
      } catch (e: any) {
        const reason = (e?.response?.data?.message || e?.message || '网络出错了，请稍后重试').toString();
        setMsgs([...base, { role: 'assistant', text: '⚠️ ' + reason }]);
        setInput(text); // 保留输入，方便重试
      } finally {
        setLoading(false);
      }
    },
    [msgs, input, loading, collection.id, onChatDone],
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border g-border bg-card">
      <div className="flex items-center gap-2 border-b g-border px-4 py-3">
        <span className="text-lg">🤖</span>
        <span className="font-semibold">AI 错题教练</span>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">隔离分析</span>
      </div>

      <div ref={listRef} className="h-[48vh] space-y-3 overflow-y-auto p-4 text-sm">
        {msgs.length === 0 && (
          <div className="rounded-xl g-panel px-3 py-3 text-muted-foreground">
            我是你的 AI 错题教练 🤓 先往合集里加几道错题，然后问我「我的薄弱点」「相关知识点」或直接点下方按钮让我分析、出题、给建议。对话只基于本合集的错题。
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex gap-2'}>
            {m.role === 'assistant' && (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs">
                🤖
              </div>
            )}
            <div
              className={
                'max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 ' +
                (m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'g-panel text-foreground')
              }
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* 快捷动作 */}
      <div className="flex flex-wrap gap-1.5 border-t g-border px-3 py-2">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            onClick={() => send(a.prompt)}
            disabled={loading}
            className="flex items-center gap-1 rounded-full border g-border px-2.5 py-1 text-xs text-primary transition active:scale-95 disabled:opacity-50"
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t g-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="问薄弱点、知识点、出题、复习建议…"
          className="h-11 flex-1 rounded-xl g-panel px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/50"
          disabled={loading}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition active:scale-90 disabled:opacity-40"
        >
          {loading ? <span className="animate-spin">⏳</span> : '➤'}
        </button>
      </div>
    </div>
  );
}

export function WrongBookPanel() {
  const [collections, setCollections] = useState<WrongCollection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listCollections();
      setCollections(list);
      setActiveId((cur) => {
        if (cur && list.some((c) => c.id === cur)) return cur;
        return list.length ? list[0].id : null;
      });
    } catch (e: any) {
      setErr(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const active = collections.find((c) => c.id === activeId) || null;

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setErr('');
    try {
      const created = await createCollection(name);
      setNewName('');
      setCreating(false);
      setCollections((prev) => [...prev, created]);
      setActiveId(created.id);
    } catch (e: any) {
      setErr(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这个错题合集吗？其中的错题与对话将一并清除。')) return;
    setBusy(true);
    setErr('');
    try {
      const rest = await deleteCollection(id);
      setCollections(rest);
      setActiveId(rest.length ? rest[0].id : null);
    } catch (e: any) {
      setErr(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAddText = async () => {
    const t = text.trim();
    if (!t || !active || busy) return;
    setBusy(true);
    setErr('');
    try {
      const updated = await addItem(active.id, { text: t });
      setCollections((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setText('');
    } catch (e: any) {
      setErr(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!file || !active || busy) return;
    setBusy(true);
    setErr('');
    try {
      const data = await compressImage(file);
      const updated = await addItem(active.id, { image: data });
      setCollections((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (e: any) {
      setErr(getErrorMessage(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!active || busy) return;
    setBusy(true);
    setErr('');
    try {
      const updated = await removeItem(active.id, itemId);
      setCollections((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (e: any) {
      setErr(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // ---------- 渲染 ----------
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border g-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        加载错题合集中…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {err && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-xs text-destructive">
          {err}
        </div>
      )}

      {/* 合集切换 / 新建 */}
      <div className="flex flex-wrap items-center gap-2">
        {collections.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveId(c.id)}
            className={
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 ' +
              (c.id === activeId
                ? 'bg-primary text-primary-foreground'
                : 'border g-border text-foreground hover:g-panel')
            }
          >
            {c.name}
            <span className={c.id === activeId ? 'text-primary-foreground/70' : 'text-muted-foreground/70'}>
              {c.items.length}
            </span>
          </button>
        ))}
        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 rounded-full border border-dashed g-border px-3 py-1.5 text-xs text-muted-foreground transition hover:g-panel active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> 新建合集
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') {
                  setCreating(false);
                  setNewName('');
                }
              }}
              placeholder="合集名称（如：定语从句错题）"
              className="h-8 w-44 rounded-full g-panel px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
            />
            <button
              onClick={handleCreate}
              disabled={busy || !newName.trim()}
              className="flex h-8 items-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground transition active:scale-95 disabled:opacity-40"
            >
              创建
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setNewName('');
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full g-panel text-muted-foreground transition hover:text-foreground"
              aria-label="取消"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {collections.length === 0 && !creating ? (
        <div className="rounded-2xl border g-border bg-card p-8 text-center text-sm text-muted-foreground">
          还没有错题合集。点上方「新建合集」，把平时做错的题拍照或手动收集起来，让 AI 帮你分析薄弱点、出题、给复习建议。
        </div>
      ) : null}

      {active && (
        <>
          {/* 收集错题：拍照 / 文本 */}
          <div className="rounded-2xl border g-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              收集错题
              <span className="text-xs font-normal text-muted-foreground/70">
                拍照识别或手动输入，可建多个合集分别归类
              </span>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="手动输入一道错题（可整段粘贴题目原文）…"
              rows={3}
              className="w-full resize-none rounded-xl border g-border g-panel px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-primary transition-all active:scale-95 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" /> 上传图片
              </button>
              <button
                onClick={() => cameraRef.current?.click()}
                disabled={busy}
                className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-primary transition-all active:scale-95 disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" /> 拍照识别
              </button>
              <button
                onClick={handleAddText}
                disabled={busy || !text.trim()}
                className="ml-auto flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition active:scale-95 disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                添加
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {/* 错题列表 */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground">共 {active.items.length} 道错题</span>
            <button
              onClick={() => handleDelete(active.id)}
              disabled={busy}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> 删除合集
            </button>
          </div>

          {active.items.length === 0 ? (
            <div className="rounded-2xl border g-border bg-card p-6 text-center text-sm text-muted-foreground">
              还没有错题，先拍照或手动添加吧～
            </div>
          ) : (
            <div className="space-y-2">
              {active.items.map((it: WrongItem) => (
                <div
                  key={it.id}
                  className="rounded-xl border border-rose-500/15 bg-rose-500/[0.04] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={
                            'rounded-full px-1.5 py-0.5 text-[10px] ' +
                            (it.source === 'photo'
                              ? 'bg-violet-500/15 text-violet-400'
                              : 'bg-sky-500/15 text-sky-400')
                          }
                        >
                          {it.source === 'photo' ? '拍照' : '文本'}
                        </span>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/90">
                        {it.text}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(it.id)}
                      disabled={busy}
                      className="shrink-0 text-lg text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                      aria-label="移除"
                    >
                      ✕
                    </button>
                  </div>
                  {it.imageUrl && (
                    <img
                      src={it.imageUrl}
                      alt="原题"
                      className="mt-2 max-h-32 rounded-lg object-contain g-panel"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 隔离 AI 对话 */}
          <WrongBookChat key={active.id} collection={active} onChatDone={refresh} />
        </>
      )}
    </div>
  );
}

export default WrongBookPanel;
