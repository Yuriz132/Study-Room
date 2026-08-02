import { Sun, Moon, Monitor } from "lucide-react";
import { useSettings, type Theme } from "@/context/SettingsContext";

const ORDER: Theme[] = ["light", "dark", "system"];
const LABEL: Record<Theme, string> = { light: "浅色", dark: "深色", system: "系统" };
const ICON: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

/** 紧凑型主题切换按钮：在 浅色 / 深色 / 系统 之间循环，便于在任意界面快速切换。 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useSettings();
  const current: Theme = ORDER.includes(theme) ? theme : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = ICON[current];
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={"主题：" + LABEL[current] + "（点击切换到" + LABEL[next] + "）"}
      title={"主题：" + LABEL[current] + "（点击切换）"}
      className={
        "relative flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground active:scale-90 " +
        className
      }
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

export default ThemeToggle;
