import TopBar from "@/components/TopBar";
import { PomodoroTimer } from "@/components/PomodoroTimer";

export default function Pomodoro() {
  return (
    <div className="hv-fade space-y-4">
      <TopBar title="番茄钟" subtitle="专注 · 短休 · 长休，计时结束震动提醒" />
      <div className="flex justify-center pt-6">
        <PomodoroTimer />
      </div>
    </div>
  );
}
