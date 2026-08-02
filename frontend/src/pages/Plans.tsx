import { useState } from "react";
import TopBar from "@/components/TopBar";
import { StudyPlans } from "@/components/StudyPlans";
import StudyCalendar from "@/components/StudyCalendar";

type Tab = "plans" | "calendar";

export default function Plans() {
  const [tab, setTab] = useState<Tab>("plans");
  const [open, setOpen] = useState(false);

  return (
    <div className="hv-fade space-y-3">
      <TopBar title="学习计划" subtitle="选章节 · 设目标 · 追踪进度" />

      {/* Tab 切换 */}
      <div className="flex rounded-2xl border g-border bg-card p-1">
        <TabBtn active={tab === "plans"} onClick={() => setTab("plans")} label="学习计划" />
        <TabBtn active={tab === "calendar"} onClick={() => setTab("calendar")} label="学习日历" />
      </div>

      {tab === "plans" ? (
        <div className="rounded-2xl border g-border bg-card p-1">
          <StudyPlans open={open} onOpenChange={setOpen} />
        </div>
      ) : (
        <StudyCalendar />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl py-2 text-sm font-medium transition-all active:scale-95 ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:g-panel"
      }`}
    >
      {label}
    </button>
  );
}
