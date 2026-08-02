import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { searchWords } from "@/lib/words-data";
import { useStarred } from "@/hooks/use-storage";
import { speakWord } from "@/lib/speak";
import { FileText, Headphones, Library, BookOpen, Wrench } from "lucide-react";

export default function SearchPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { starred, toggle } = useStarred();
  const results = useMemo(() => (q.trim() ? searchWords(q) : []), [q]);

  return (
    <div className="hv-fade space-y-4 pt-2">
      <h1 className="text-xl font-bold">搜索</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="输入单词 / 音标 / 释义…"
        className="h-12 w-full rounded-xl bg-card px-4 text-base text-foreground outline-none focus:ring-2 focus:ring-primary/50"
      />

      {/* 快捷入口 */}
      {!q.trim() && (
        <div className="grid grid-cols-2 gap-2">
          <QuickCard
            icon={<FileText className="h-4 w-4 text-emerald-400" />}
            title="AI 英语文章"
            onClick={() => navigate("/article")}
          />
          <QuickCard
            icon={<Headphones className="h-4 w-4 text-violet-400" />}
            title="随身听"
            subtitle="维护中"
            onClick={() => navigate("/listen")}
          />
          <QuickCard
            icon={<Library className="h-4 w-4 text-amber-400" />}
            title="自建词库"
            onClick={() => navigate("/custom")}
          />
          <QuickCard
            icon={<BookOpen className="h-4 w-4 text-sky-400" />}
            title="公共笔记"
            onClick={() => navigate("/public-notes")}
          />
        </div>
      )}

      {q.trim() && (
        <p className="text-xs text-muted-foreground">找到 {results.length} 个结果</p>
      )}
      <div className="space-y-2">
        {results.map((w) => (
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
