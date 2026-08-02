import { Brain } from "lucide-react";

export default function SearchPage() {
  return (
    <div className="hv-fade flex min-h-[60vh] flex-col items-center justify-center space-y-3 pt-2 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl g-panel">
        <Brain className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-xl font-bold">学习法</h1>
      <p className="text-sm text-muted-foreground">敬请期待 · 开发中</p>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground/70">
        搜索、AI 英语文章、随身听、自建词库、公共笔记已移至「收藏」
      </p>
    </div>
  );
}
