import { useState } from "react";
import { Sparkles } from "lucide-react";
import { PersonalSummary } from "@/components/PersonalSummary";

export default function Summary() {
  const [open, setOpen] = useState(false);
  return (
    <div className="hv-fade space-y-4">
      <h1 className="text-xl font-bold text-foreground">AI 个人总结</h1>
      <p className="-mt-1 text-xs text-muted-foreground">基于真实学习数据给出下一步建议</p>
      <div className="rounded-2xl border g-border bg-card p-6 text-center">
        <Sparkles className="mx-auto mb-2 h-7 w-7 text-primary" />
        <p className="text-sm text-muted-foreground">
          让 AI 根据你的学习情况（已学单词、连续天数等），生成有温度、可执行的建议。
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition active:scale-95"
        >
          生成我的学习总结
        </button>
      </div>
      <PersonalSummary open={open} onOpenChange={setOpen} />
    </div>
  );
}
