import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCustomWords } from "@/hooks/use-custom-words";
import { speakWord } from "@/lib/speak";
import TopBar from "@/components/TopBar";
import { NotFoundFallback } from "./NotFound";

export default function CustomFlashcards() {
  const { listId } = useParams();
  const navigate = useNavigate();
  const { getList } = useCustomWords();

  const list = getList(listId);
  const words = list?.words ?? [];
  const [flipped, setFlipped] = useState(false);
  const [idx, setIdx] = useState(0);

  if (!list || words.length === 0) return <NotFoundFallback />;

  const w = words[idx];
  const isLast = idx >= words.length - 1;

  const next = () => {
    setFlipped(false);
    setIdx((i) => Math.min(i + 1, words.length - 1));
  };

  return (
    <div className="hv-fade space-y-4 pt-2">
      <TopBar title={list.name} onBack={() => navigate(`/custom/${list.id}`)} />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{idx + 1} / {words.length}</span>
      </div>

      <div
        onClick={() => setFlipped((v) => !v)}
        className="flex min-h-[42vh] cursor-pointer flex-col items-center justify-center rounded-3xl border g-border bg-card p-6 text-center transition active:scale-98"
      >
        {!flipped ? (
          <>
            <div className="text-4xl font-bold">{w.word}</div>
            {w.phonetic && <div className="mt-2 text-sm text-muted-foreground">{w.phonetic}</div>}
            <div className="mt-6 text-xs text-muted-foreground">点击卡片看释义</div>
          </>
        ) : (
          <>
            <div className="text-lg font-semibold text-primary">{w.meaning}</div>
            <button
              onClick={(e) => { e.stopPropagation(); speakWord(w.word); }}
              className="mt-4 rounded-full bg-primary/20 px-3 py-1 text-sm text-primary"
            >🔊 朗读</button>
          </>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Link
          to={`/custom/${list.id}`}
          className="rounded-xl border g-border px-4 py-3 text-sm text-muted-foreground"
        >返回词库</Link>

        {!flipped ? (
          <button onClick={() => setFlipped(true)} className="rounded-xl bg-primary px-6 py-3 text-primary-foreground">看答案</button>
        ) : isLast ? (
          <button onClick={next} className="rounded-xl bg-success px-6 py-3 text-white">完成 ✓</button>
        ) : (
          <button onClick={next} className="rounded-xl bg-primary px-6 py-3 text-primary-foreground">下一个 →</button>
        )}
      </div>

      {!idx && (
        <p className="text-center text-xs text-muted-foreground/60">
          自定义单词仅本机保存，可返回词库继续添加
        </p>
      )}
    </div>
  );
}
