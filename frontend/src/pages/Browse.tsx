import { useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { GraduationCap, Play } from "lucide-react";
import { allWords, partStructure, getWordsByList } from "@/lib/words-data";
import { useStarred } from "@/hooks/use-storage";
import { speakWord } from "@/lib/speak";

export default function Browse() {
  const { part, list } = useParams();
  const navigate = useNavigate();
  const { starred, toggle } = useStarred();

  // 1) 单词列表页 /browse/:part/:list
  const listWords = useMemo(() => (part && list ? getWordsByList(part, list) : []), [part, list]);
  // 2) Part 列表页 /browse/:part
  const partLists = useMemo(() => {
    if (!part) return [];
    const p = partStructure.find((x) => x.name === part);
    return p ? p.lists : [];
  }, [part]);
  // 3) 顶层：所有 Part
  const parts = partStructure;

  if (part && list) {
    return (
      <div className="hv-fade space-y-3">
        <Link to={`/browse/${encodeURIComponent(part)}`} className="text-sm text-muted-foreground">‹ 返回 {part}</Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{list}</h1>
            <p className="text-xs text-muted-foreground">{listWords.length} 个单词</p>
          </div>
          <button
            onClick={() => navigate(`/flashcards/${encodeURIComponent(part)}/${encodeURIComponent(list ?? '')}`)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-all hover:-translate-y-0.5 active:scale-95"
          >
            <Play className="h-4 w-4" /> 开始学习
          </button>
        </div>
        <div className="space-y-2">
          {listWords.map((w) => (
            <div key={w.id} className="rounded-xl border g-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold">{w.word}</div>
                  <div className="text-xs text-muted-foreground">{w.phonetic}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => speakWord(w.word)} className="text-sm text-primary">🔊</button>
                  <button
                    onClick={() => toggle(w.id)}
                    className={"text-lg " + (starred.has(w.id) ? "text-yellow-400" : "text-muted-foreground")}
                  >{starred.has(w.id) ? "★" : "☆"}</button>
                </div>
              </div>
              <div className="mt-2 text-sm text-foreground/90">{w.meaning}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (part) {
    return (
      <div className="hv-fade space-y-3">
        <Link to="/browse" className="text-sm text-muted-foreground">‹ 返回词库</Link>
        <h1 className="text-xl font-bold">{part}</h1>
        <p className="text-xs text-muted-foreground">选择一个 List 查看单词，或直接开始学习</p>
        <div className="space-y-2">
          {partLists.map((l) => (
            <div
              key={l.name}
              className="flex items-center gap-2 rounded-xl border g-border bg-card px-4 py-3 transition active:scale-95"
            >
              <Link
                to={`/browse/${encodeURIComponent(part)}/${encodeURIComponent(l.name)}`}
                className="flex min-w-0 flex-1 items-center justify-between"
              >
                <span className="font-medium">{l.name}</span>
                <span className="text-xs text-muted-foreground">{l.total} 词 ›</span>
              </Link>
              <button
                onClick={() => navigate(`/flashcards/${encodeURIComponent(part)}/${encodeURIComponent(l.name)}`)}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-primary/15 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
                title={`开始学习 ${l.name}`}
              >
                <GraduationCap className="h-3.5 w-3.5" /> 学习
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="hv-fade space-y-3">
      <h1 className="text-xl font-bold">词库</h1>
      <p className="text-xs text-muted-foreground">共 {allWords.length} 词</p>
      <div className="space-y-2">
        {parts.map((p) => (
          <Link
            key={p.name}
            to={`/browse/${encodeURIComponent(p.name)}`}
            className="flex items-center justify-between rounded-xl border g-border bg-card px-4 py-3 transition active:scale-95"
          >
            <span className="font-medium">{p.name}</span>
            <span className="text-xs text-muted-foreground">{p.total} 词 ›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
