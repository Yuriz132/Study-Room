import { useState } from "react";
import { BookOpen } from "lucide-react";
import TopBar from "@/components/TopBar";
import { ArticleGenerator } from "@/components/ArticleGenerator";

export default function ArticleGen() {
  const [open, setOpen] = useState(false);
  return (
    <div className="hv-fade space-y-4">
      <TopBar title="AI 英语文章" subtitle="用你已掌握的单词生成可读短文" />
      <div className="rounded-2xl border g-border bg-card p-6 text-center">
        <BookOpen className="mx-auto mb-2 h-7 w-7 text-primary" />
        <p className="text-sm text-muted-foreground">
          基于你已掌握 / 已收藏的单词，AI 写一篇适合英语学习室水平的英语短文，并自动存入收藏。
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition active:scale-95"
        >
          生成英语文章
        </button>
      </div>
      <ArticleGenerator open={open} onOpenChange={setOpen} />
    </div>
  );
}
