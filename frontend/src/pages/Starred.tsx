import { useMemo, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { allWords, searchWords } from "@/lib/words-data";
import { useStarred, useKnown } from "@/hooks/use-storage";
import { useWrongWords } from "@/hooks/use-wrong-words";
import { useNotes } from "@/hooks/use-notes";
import { speakWord } from "@/lib/speak";
import { ImageLightbox } from "@/components/ImageLightbox";
import { aiAnalyzeNote } from "@/lib/ai";
import { StudyAssistantChat } from "@/components/StudyAssistantChat";
import { FileText, Headphones, Library, BookOpen, Wrench } from "lucide-react";
import type { Word } from "@/types/word";
import type { Note } from "@/lib/authApi";

type Tab = "starred" | "known" | "wrong" | "notes" | "assistant";

export default function Starred() {
  const [tab, setTab] = useState<Tab>("starred");
  const { starred, toggle } = useStarred();
  const { known, toggle: toggleKnown } = useKnown();
  const { wrong, removeWrong, clearWrong } = useWrongWords();
  const { notes, addNote, updateNote, removeNote } = useNotes();

  // 自「搜索」页迁移而来的搜索与工具快捷入口
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const results = useMemo(() => (q.trim() ? searchWords(q) : []), [q]);

  const starredWords = useMemo(() => allWords.filter((w) => starred.has(w.id)), [starred]);
  const knownWords = useMemo(() => allWords.filter((w) => known.has(w.id)), [known]);

  const [editing, setEditing] = useState<'new' | Note | null>(null);
  const doneEditing = useCallback(() => setEditing(null), []);
  // 笔记图片预览（灯箱）
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div className="hv-fade space-y-3 pt-2">
      <h1 className="text-xl font-bold text-foreground">收藏</h1>
      <p className="-mt-1 text-xs text-muted-foreground">
        生词 {starredWords.length} · 已学 {knownWords.length} · 错词 {wrong.length} · 笔记 {notes.length}
      </p>

      {/* 搜索 + 工具快捷入口（自「搜索」页迁移至此） */}
      <div className="space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索单词 / 音标 / 释义…"
          className="h-12 w-full rounded-xl bg-card px-4 text-base text-foreground outline-none focus:ring-2 focus:ring-primary/50"
        />
        {!q.trim() && (
          <div className="grid grid-cols-2 gap-2">
            <QuickCard icon={<FileText className="h-4 w-4 text-emerald-400" />} title="AI 英语文章" onClick={() => navigate("/article")} />
            <QuickCard icon={<Headphones className="h-4 w-4 text-violet-400" />} title="随身听" subtitle="维护中" onClick={() => navigate("/listen")} />
            <QuickCard icon={<Library className="h-4 w-4 text-amber-400" />} title="自建词库" onClick={() => navigate("/custom")} />
            <QuickCard icon={<BookOpen className="h-4 w-4 text-sky-400" />} title="公共笔记" onClick={() => navigate("/public-notes")} />
          </div>
        )}
        {q.trim() && <p className="text-xs text-muted-foreground">找到 {results.length} 个结果</p>}
        <div className="space-y-2">
          {results.map((w) => (
            <WordRow
              key={w.id}
              w={w}
              action={
                <>
                  <button onClick={() => speakWord(w.word)} className="text-sm text-primary">🔊</button>
                  <button onClick={() => toggle(w.id)} className={"text-lg " + (starred.has(w.id) ? "text-yellow-400" : "text-muted-foreground")}>{starred.has(w.id) ? "★" : "☆"}</button>
                </>
              }
            />
          ))}
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex rounded-2xl border g-border bg-card p-1">
        <TabBtn active={tab === "starred"} onClick={() => { setTab("starred"); doneEditing(); }} label="生词" count={starredWords.length} />
        <TabBtn active={tab === "known"} onClick={() => { setTab("known"); doneEditing(); }} label="已学" count={knownWords.length} />
        <TabBtn active={tab === "wrong"} onClick={() => { setTab("wrong"); doneEditing(); }} label="错词" count={wrong.length} />
        <TabBtn active={tab === "notes"} onClick={() => { setTab("notes"); doneEditing(); }} label="笔记" count={notes.length} />
        <TabBtn active={tab === "assistant"} onClick={() => setTab("assistant")} label="AI 助手" />
      </div>

      {/* 生词（收藏） */}
      {tab === "starred" &&
        (starredWords.length === 0 ? (
          <Empty text="还没有收藏的单词哦～在单词页点 ☆ 即可加入。" />
        ) : (
          <div className="space-y-2">
            {starredWords.map((w) => (
              <WordRow key={w.id} w={w} action={<button onClick={() => toggle(w.id)} className="text-lg text-yellow-400">★</button>} />
            ))}
          </div>
        ))}

      {/* 已学（掌握） */}
      {tab === "known" &&
        (knownWords.length === 0 ? (
          <Empty text="还没有已掌握的单词，去学习并标记「认识」吧～" />
        ) : (
          <div className="space-y-2">
            {knownWords.map((w) => (
              <WordRow key={w.id} w={w} action={<button onClick={() => toggleKnown(w.id)} className="text-sm text-emerald-400">✓ 已学</button>} />
            ))}
          </div>
        ))}

      {/* 错词 */}
      {tab === "wrong" && (
        <div className="space-y-2">
          {wrong.length > 0 && (
            <div className="flex justify-end">
              <button onClick={clearWrong} className="text-xs text-muted-foreground transition-colors hover:text-destructive">
                清空错词本
              </button>
            </div>
          )}
          {wrong.length === 0 ? (
            <Empty text="还没有错词，答错的词会归集到这里方便复习～" />
          ) : (
            wrong.map((w) => (
              <div key={w.word} className="rounded-xl border border-rose-500/15 bg-rose-500/[0.04] p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold">{w.word}</div>
                    {w.phonetic && <div className="text-xs text-muted-foreground">{w.phonetic}</div>}
                  </div>
                  <button onClick={() => removeWrong(w.word)} className="text-lg text-muted-foreground transition-colors hover:text-destructive" aria-label="移除">
                    ✕
                  </button>
                </div>
                <div className="mt-2 text-sm text-foreground/90">{w.meaning}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 个人笔记 */}
      {tab === "notes" && (
        editing !== null ? (
          <NoteEditor
            note={editing === "new" ? null : editing}
            onSave={(title, content, images, analysis) => {
              if (editing === "new") { addNote(title, content, images, analysis); }
              else { updateNote(editing.id, title, content, images, analysis); }
              doneEditing();
            }}
            onCancel={doneEditing}
          />
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => setEditing("new")}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed g-border py-3 text-sm text-muted-foreground transition-all hover:g-panel active:scale-[0.99]"
            >
              ＋ 添加笔记
            </button>
            {notes.length === 0 ? (
              <Empty text="还没有个人笔记，点击上方添加～" />
            ) : (
              notes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setEditing(n)}
                  className="w-full rounded-xl border g-border bg-card p-4 text-left transition active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{n.title || "无标题"}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(n.updatedAt).toLocaleDateString("zh-CN")}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeNote(n.id); }}
                      className="ml-2 shrink-0 text-xs text-muted-foreground hover:text-destructive"
                      aria-label="删除"
                    >
                      ✕
                    </button>
                  </div>
                  {n.content && <div className="mt-2 line-clamp-2 text-xs text-foreground/70">{n.content}</div>}
                  {n.images && n.images.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {n.images.map((img, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPreview(img); }}
                          className="h-10 w-10 overflow-hidden rounded-lg g-panel transition active:scale-95"
                          aria-label="查看图片"
                        >
                          <img src={img} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  {n.analysis && (
                    <div className="mt-2 rounded-lg border border-primary/15 bg-primary/[0.06] px-2.5 py-1.5 text-[11px] leading-relaxed text-primary/90">
                      🤖 {n.analysis.split("\n")[0].slice(0, 60)}
                      {n.analysis.split("\n")[0].length > 60 ? "…" : ""}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )
      )}

      {/* AI 学习助手（对话本地保存） */}
      {tab === "assistant" && <StudyAssistantChat />}

      {/* 图片灯箱：点击笔记图片放大预览 / 保存 */}
      <ImageLightbox src={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function TabBtn({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl py-2 text-sm font-medium transition-all active:scale-95 ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:g-panel"
      }`}
    >
      {label}
      {count !== undefined && <span className={`ml-1 text-xs ${active ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>{count}</span>}
    </button>
  );
}

function WordRow({ w, action }: { w: Word; action: React.ReactNode }) {
  return (
    <div className="rounded-xl border g-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold">{w.word}</div>
          <div className="text-xs text-muted-foreground">{w.phonetic}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => speakWord(w.word)} className="text-sm text-primary">🔊</button>
          {action}
        </div>
      </div>
      <div className="mt-2 text-sm text-foreground/90">{w.meaning}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border g-border bg-card p-8 text-center text-sm text-muted-foreground">{text}</div>
  );
}

function QuickCard({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-2xl border g-border bg-card px-3.5 py-3 text-left transition-all active:scale-[0.97] hover:g-panel"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg g-panel">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        {subtitle && (
          <div className="flex items-center gap-1 text-[11px] text-amber-400">
            <Wrench className="h-3 w-3" />
            {subtitle}
          </div>
        )}
      </div>
    </button>
  );
}

/** 笔记编辑器（新增 / 编辑） */
function NoteEditor({
  note,
  onSave,
  onCancel,
}: {
  note: Note | null;
  onSave: (title: string, content: string, images?: string[], analysis?: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [images, setImages] = useState<string[]>(note?.images ?? []);
  const [analysis, setAnalysis] = useState<string | undefined>(note?.analysis);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  /** 调用后端 AI 把笔记图片整理为结构化中文说明（支持多张图一起分析） */
  const handleAiParse = useCallback(async () => {
    if (images.length === 0 || parsing) return;
    setParsing(true);
    setParseError(null);
    try {
      const { analysis: text } = await aiAnalyzeNote({ imageDataUrls: images.slice(0, 6) });
      setAnalysis(text);
    } catch (e: any) {
      setParseError(e?.message || "AI 解析失败，请重试");
    } finally {
      setParsing(false);
    }
  }, [images, parsing]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 读取为 dataURL
    const raw = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    // 压缩至 1024 宽
    const compressed = await new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1024;
        const c = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        c.width = w; c.height = h;
        c.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", 0.7));
      };
      img.src = raw;
    });
    setImages((prev) => [...prev, compressed]);
    // 清空 input 以允许再次选同一文件
    e.target.value = "";
  }, []);

  const doSave = () => {
    if (saving) return;
    setSaving(true);
    onSave(title, content, images, analysis);
  };

  return (
    <div className="space-y-3 rounded-2xl border g-border bg-card p-4">
      {/* 隐藏的 file input 同时支持拍照和相册 */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <input
        placeholder="标题"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-xl border g-border g-panel px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50"
      />

      <textarea
        placeholder="写下你的笔记…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        className="w-full resize-none rounded-xl border g-border g-panel px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50"
      />

      {/* 图片缩略图（点击放大 / 长按移除） */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative">
              <button
                type="button"
                onClick={() => setLightbox(img)}
                className="block h-16 w-16 overflow-hidden rounded-xl g-panel transition active:scale-95"
                aria-label="放大图片"
              >
                <img src={img} alt="" className="h-full w-full object-cover" />
              </button>
              <button
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] text-white shadow"
                aria-label="移除图片"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* AI 解析：识别笔记图片中的英文单词 */}
      {images.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={handleAiParse}
            disabled={parsing}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/[0.08] py-2.5 text-sm font-medium text-primary transition active:scale-[0.98] disabled:opacity-60"
          >
            {parsing ? "⏳ AI 整理中…" : "✨ AI 整理笔记"}
          </button>
          {parseError && <div className="text-xs text-destructive">{parseError}</div>}
          {analysis && (
            <div className="rounded-xl border border-primary/15 bg-primary/[0.06] p-3">
              <div className="mb-1 text-[11px] font-medium text-primary/80">AI 笔记解析</div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/85">
{analysis}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button onClick={() => onCancel()} className="flex-1 rounded-xl border g-border g-panel py-2.5 text-sm text-muted-foreground transition active:scale-95">
          取消
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-1 rounded-xl border g-border g-panel px-3 py-2.5 text-xs text-muted-foreground transition active:scale-95"
        >
          📷 拍照/上传
        </button>
        <button
          onClick={doSave}
          disabled={saving}
          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition active:scale-95 disabled:opacity-50"
        >
          保存
        </button>
      </div>

      {/* 编辑器内图片灯箱 */}
      <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
