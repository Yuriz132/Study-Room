import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

interface TopBarProps {
  title: string;
  subtitle?: string;
  /** 传入 true 显示返回按钮（默认 navigate(-1)）；传入函数则调用之；undefined 不显示 */
  onBack?: boolean | (() => void);
  right?: ReactNode;
}

export default function TopBar({ title, subtitle, onBack, right }: TopBarProps) {
  const navigate = useNavigate();
  const handleBack = () => {
    if (typeof onBack === "function") onBack();
    else navigate(-1);
  };
  return (
    <header className="mb-4">
      <div className="flex items-center gap-2">
        {onBack !== undefined && (
          <button
            onClick={handleBack}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:g-panel hover:text-foreground active:scale-90"
            aria-label="返回"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}
