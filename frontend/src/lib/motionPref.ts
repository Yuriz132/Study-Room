import { useSettings } from "@/context/SettingsContext";
import { useReducedMotion } from "framer-motion";

/**
 * 是否允许播放 UI 动效。
 * 受两层控制：
 *  1) 用户「界面动效」设置（本地持久化，弱机首次默认关）
 *  2) 系统级「减少动态效果」无障碍偏好
 * 任一为否即降级为无动画，保证弱机/易眩晕用户的流畅与可读性。
 */
export function useMotionEnabled(): boolean {
  const { motionEnabled } = useSettings();
  const reduced = useReducedMotion();
  return motionEnabled && !reduced;
}
