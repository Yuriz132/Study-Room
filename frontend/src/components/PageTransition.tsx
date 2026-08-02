import { motion } from "./MotionPrimitives";
import { useMotionEnabled } from "@/lib/motionPref";

const variants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  "slide-up": {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  },
  "slide-fade": {
    initial: { opacity: 0, x: 12 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -12 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
  /** 鸿蒙7风格：上滑淡入 + 弹性缓出（不用 scale，避免整页缩放造成的“从中间跳到顶部”视觉跳动） */
  harmony: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  },
  /** FadeThrough 淡入过渡：旧淡出 + 新淡入并轻微放大(0.92→1)，无位移 */
  fadethrough: {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
  /** 交错入场模式：父调度层只做整块轻量淡入/有序滑出，真正的内容错位由子页面
   *  内部 StaggerContainerEnter + StaggerItemEnter 接管（从上至下依次登场）。
   *  整块不叠加位移，避免与内部交错产生双重抖动。 */
  stagger: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  },
};

type TransitionMode = keyof typeof variants;

interface PageTransitionProps {
  children: React.ReactNode;
  transition?: TransitionMode;
}

/**
 * PageTransition - 页面进入/退出动画包装器
 *
 * 支持模式：
 *   fade        — 纯淡入淡出（默认，最快）
 *   slide-up    — 向上滑入
 *   slide-fade  — 侧滑+淡入
 *   scale       — 缩放淡入
 *   harmony     — 鸿蒙7风格：右侧微缩滑入 + 弹性缓出（推荐）
 *
 * ⚠️ 重要：此组件只包裹页面内容区域，
 * Navbar/Header/Sidebar 必须在 AnimatedRoutes 外部，不要包在 PageTransition 里。
 */
const HARMONY_TRANSITION = { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const };
const FADETHROUGH_TRANSITION = { duration: 0.32, ease: [0.4, 0, 0.2, 1] as const };
const STAGGER_TRANSITION = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };
const DEFAULT_TRANSITION = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const };

/**
 * 是否启用「路由切换页面动画」。
 * 开启后页面切换带鸿蒙风格过渡（见 App.tsx 中各路由的 transition="harmony"）。
 * 受「界面动效」设置与系统「减少动态效果」双重控制（见 useMotionEnabled）。
 */
const ENABLE_PAGE_TRANSITION = true;

export function PageTransition({ children, transition = "fade" }: PageTransitionProps) {
  if (!ENABLE_PAGE_TRANSITION || !useMotionEnabled()) {
    return <div>{children}</div>;
  }

  const v = variants[transition];

  const transitionConfig =
    transition === 'harmony'
      ? HARMONY_TRANSITION
      : transition === 'fadethrough'
        ? FADETHROUGH_TRANSITION
        : transition === 'stagger'
          ? STAGGER_TRANSITION
          : DEFAULT_TRANSITION;

  return (
    <motion.div
      initial={v.initial}
      animate={v.animate}
      exit={v.exit}
      transition={transitionConfig}
    >
      {children}
    </motion.div>
  );
}
