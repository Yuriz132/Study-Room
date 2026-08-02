import { motion, type Variants, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, type ReactNode, type CSSProperties, createContext, useContext } from 'react';
import { useMotionEnabled } from '@/lib/motionPref';

// ── Shared easing & duration tokens ──
const ease = [0.25, 0.46, 0.45, 0.94] as const;
/** 鸿蒙风格弹性缓出曲线（类 spring，用于页面切换和卡片飞入） */
const harmonyEase = [0.22, 1, 0.36, 1] as const;
const springBounce = { type: 'spring', damping: 20, stiffness: 300 } as const;
/** 开屏飞入：纯 scale + opacity，零位移避免跨屏跳跃 */
const explodeSpring = { type: 'spring' as const, damping: 28, stiffness: 240 };

// ── Variant factories ──
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease } },
};

export const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -32 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease } },
};

export const fadeRight: Variants = {
  hidden: { opacity: 0, x: 32 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease } },
};

export const scaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease } },
};

export const blurIn: Variants = {
  hidden: { opacity: 0, filter: 'blur(12px)' },
  visible: { opacity: 1, filter: 'blur(0px)', transition: { duration: 0.6, ease } },
};

/**
 * flyIn — 增强版飞入：缩放 + 上移 + 模糊淡出
 * 替代 fadeUp 用于卡片滚动进入视口的过渡效果
 */
export const flyIn: Variants = {
  hidden: { opacity: 0, scale: 0.88, y: 36, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: harmonyEase },
  },
};

/**
 * explodeIn — 开屏飞入基础变体（仅 scale + opacity）
 */
export const explodeIn: Variants = {
  hidden: { opacity: 0, scale: 0.35 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: explodeSpring,
  },
};

// ── Stagger container ──
export const staggerContainer = (stagger = 0.1, delay = 0): Variants => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren: stagger,
      delayChildren: delay,
    },
  },
});

// ── Generic viewport-triggered wrapper (FadeIn) ──
interface FadeInProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  variants?: Variants;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
  amount?: number;
}

export const FadeIn = forwardRef<HTMLDivElement, FadeInProps>(
  ({ children, variants = fadeUp, delay = 0, duration, className, once = true, amount = 0.2, ...props }, ref) => {
    if (!useMotionEnabled()) {
      return <div ref={ref} className={className} {...(props as Record<string, unknown>)}>{children}</div>;
    }
    return (
      <motion.div
        ref={ref}
        variants={variants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once, amount }}
        transition={delay || duration ? { delay, ...(duration ? { duration } : {}) } : undefined}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);
FadeIn.displayName = 'FadeIn';

// ── FlyIn: 视口触发的增强飞入组件 ──
interface FlyInProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  /** 动画变体（默认 flyIn） */
  variants?: Variants;
  delay?: number;
  className?: string;
  once?: boolean;
  amount?: number;
  /** 'view' = 滚入视口触发(默认), 'mount' = 挂载即触发(开屏飞入) */
  mode?: 'view' | 'mount';
}

export const FlyIn = forwardRef<HTMLDivElement, FlyInProps>(
  ({ children, variants = flyIn, delay = 0, className, once = true, amount = 0.15, mode = 'view', ...props }, ref) => {
    if (!useMotionEnabled()) {
      return <div ref={ref} className={className} {...(props as Record<string, unknown>)}>{children}</div>;
    }

    const shared = {
      ref,
      variants,
      initial: 'hidden' as const,
      className,
      ...props,
    };

    if (mode === 'mount') {
      return (
        <motion.div {...shared} animate="visible" transition={delay ? { delay } : undefined}>
          {children}
        </motion.div>
      );
    }

    return (
      <motion.div
        {...shared}
        whileInView="visible"
        viewport={{ once, amount }}
        transition={delay ? { delay } : undefined}
      >
        {children}
      </motion.div>
    );
  },
);
FlyIn.displayName = 'FlyIn';

// ── ExplodeIn: HarmonyOS 开屏飞入（固定动画，无布局测量，稳定可靠） ──
interface ExplodeInProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** 初始缩放比例，默认 0.5 */
  initialScale?: number;
}

export const ExplodeIn = forwardRef<HTMLDivElement, ExplodeInProps>(
  ({ children, delay = 0, className, initialScale = 0.5, style, ...props }, ref) => {
    if (!useMotionEnabled()) {
      return <div ref={ref} className={className} style={style as CSSProperties} {...(props as Record<string, unknown>)}>{children}</div>;
    }

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: initialScale }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...explodeSpring, delay: delay || undefined }}
        className={className}
        // 以顶部为缩放原点：缩放时从顶部向下展开，避免"从中间蹦到顶端"的视觉跳变
        style={{ transformOrigin: 'top center', ...style }}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);
ExplodeIn.displayName = 'ExplodeIn';

// ── Stagger parent (triggers children) ──
interface StaggerProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  stagger?: number;
  delay?: number;
  className?: string;
  once?: boolean;
  amount?: number;
}

export const Stagger = forwardRef<HTMLDivElement, StaggerProps>(
  ({ children, stagger = 0.08, delay = 0, className, once = true, amount = 0.12, ...props }, ref) => {
    if (!useMotionEnabled()) {
      return <div ref={ref} className={className} {...(props as Record<string, unknown>)}>{children}</div>;
    }
    return (
      <motion.div
        ref={ref}
        variants={staggerContainer(stagger, delay)}
        initial="hidden"
        whileInView="visible"
        viewport={{ once, amount }}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);
Stagger.displayName = 'Stagger';

// ── Hover-lift card wrapper ──
interface HoverLiftProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  lift?: number;
}

export const HoverLift = forwardRef<HTMLDivElement, HoverLiftProps>(
  ({ children, className, lift = -4, ...props }, ref) => {
    if (!useMotionEnabled()) {
      return <div ref={ref} className={className} {...(props as Record<string, unknown>)}>{children}</div>;
    }
    return (
      <motion.div
        ref={ref}
        variants={fadeUp}
        whileHover={{ y: lift, transition: { duration: 0.25, ease: 'easeOut' } }}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);
HoverLift.displayName = 'HoverLift';

// ───────────────────────────────────────────────────────────────────────────
// 页面级交错入场（Tab 切换场景）
//
// 设计遵循「父调度 + 子被动响应」：
//   - StaggerContainerEnter 作为父容器，在页面进入（route 进入 / 父级
//     AnimatePresence）时立即以 animate="visible" 触发，按 stagger 间隔依次
//     让子项登场（从上至下）。关闭界面动效时直接渲染，零延迟（效率优先）。
//   - StaggerItemEnter 是被动子项：不关心 Tab 状态，只挂上 variants，
//     由父容器统一调度其入场时序。任意页面只要把内容块包进这两个组件即可接入，
//     不需要监听路由切换，各页动画逻辑互不干扰。
// ───────────────────────────────────────────────────────────────────────────

export type StaggerEaseName = 'harmony' | 'easeOut' | 'easeInOut' | 'linear';

/** 缓动曲线预设（与全局 harmonyEase 一致的高级丝滑曲线） */
export type StaggerBezier = [number, number, number, number];
export const STAGGER_EASE: Record<StaggerEaseName, StaggerBezier> = {
  harmony: [0.22, 1, 0.36, 1],
  easeOut: [0.16, 1, 0.3, 1],
  easeInOut: [0.65, 0, 0.35, 1],
  linear: [0, 0, 1, 1],
};

/**
 * 动画预设 — 把「间隔/位移/时长/缓动」打包成三档语义化预设。
 * - 灵动：快速轻快，效率感强（短间隔 + 短位移 + 缓出）
 * - 适中：平衡自然，日常默认（中间隔 + 中位移 + harmony）
 * - 优雅：从容舒缓，沉浸感强（长间隔 + 长位移 + 缓入缓出）
 */
export type AnimationPreset = "灵动" | "适中" | "优雅";

export interface AnimationPresetConfig {
  stagger: number;
  distance: number;
  duration: number;
  ease: StaggerEaseName;
  desc: string;
}

export const ANIMATION_PRESETS: Record<AnimationPreset, AnimationPresetConfig> = {
  灵动: { stagger: 0.05, distance: 12, duration: 0.35, ease: "easeOut", desc: "快速轻快 · 效率优先" },
  适中: { stagger: 0.08, distance: 18, duration: 0.45, ease: "harmony", desc: "平衡自然 · 日常推荐" },
  优雅: { stagger: 0.12, distance: 24, duration: 0.6, ease: "easeInOut", desc: "从容舒缓 · 沉浸感强" },
};

/** 父容器把自定义项（位移/时长/缓动）下发给子项，避免子项拿不到用户设置 */
const StaggerEnterConfig = createContext<{ distance: number; duration: number; ease: StaggerEaseName }>({
  distance: 18,
  duration: 0.45,
  ease: 'harmony',
});

export interface StaggerEnterOptions {
  /** 子项之间的延迟间隔（秒），默认 0.08 */
  stagger?: number;
  /** 父容器整体延迟（秒），默认 0.02 */
  delay?: number;
  /** 子项入场位移距离（px，自上而下滑入），默认 18 */
  distance?: number;
  /** 单子项入场时长（秒），默认 0.45 */
  duration?: number;
  /** 缓动曲线名，默认 harmony */
  ease?: StaggerEaseName;
}

/** 子项「从上至下交错滑入」变体：父容器进入时被动触发 */
export const staggerItemEnter = (distance: number, duration: number, ease: StaggerBezier): Variants => ({
  hidden: { opacity: 0, y: distance },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration, ease },
  },
});

interface StaggerContainerEnterProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  /** 透传自定义项（间隔/位移/缓动/时长/延迟） */
  options?: StaggerEnterOptions;
  /** 便捷参数：间隔 */
  stagger?: number;
  /** 便捷参数：位移距离 */
  distance?: number;
  /** 便捷参数：缓动 */
  ease?: StaggerEaseName;
}

export const StaggerContainerEnter = forwardRef<HTMLDivElement, StaggerContainerEnterProps>(
  ({ children, className, options, stagger, distance, ease, ...props }, ref) => {
    const opt = {
      stagger: stagger ?? options?.stagger ?? 0.08,
      delay: options?.delay ?? 0.02,
      distance: distance ?? options?.distance ?? 18,
      duration: options?.duration ?? 0.45,
      ease: ease ?? options?.ease ?? 'harmony',
    };
    if (!useMotionEnabled()) {
      return (
        <StaggerEnterConfig.Provider value={{ distance: opt.distance, duration: opt.duration, ease: opt.ease }}>
          <div ref={ref} className={className} {...(props as Record<string, unknown>)}>{children}</div>
        </StaggerEnterConfig.Provider>
      );
    }
    return (
      <StaggerEnterConfig.Provider value={{ distance: opt.distance, duration: opt.duration, ease: opt.ease }}>
        <motion.div
          ref={ref}
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: opt.stagger,
                delayChildren: opt.delay,
              },
            },
          }}
          className={className}
          {...props}
        >
          {children}
        </motion.div>
      </StaggerEnterConfig.Provider>
    );
  },
);
StaggerContainerEnter.displayName = 'StaggerContainerEnter';

interface StaggerItemEnterProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  /** 自定义项（位移/时长/缓动），缺省沿用父容器默认值 */
  options?: StaggerEnterOptions;
  /** 便捷：位移距离 */
  distance?: number;
  /** 便捷：时长 */
  duration?: number;
  /** 便捷：缓动 */
  ease?: StaggerEaseName;
}

export const StaggerItemEnter = forwardRef<HTMLDivElement, StaggerItemEnterProps>(
  ({ children, className, options, distance, duration, ease, ...props }, ref) => {
    const ctx = useContext(StaggerEnterConfig);
    const dist = distance ?? options?.distance ?? ctx.distance;
    const dur = duration ?? options?.duration ?? ctx.duration;
    const e = ease ?? options?.ease ?? ctx.ease;
    if (!useMotionEnabled()) {
      return <div ref={ref} className={className} {...(props as Record<string, unknown>)}>{children}</div>;
    }
    return (
      <motion.div
        ref={ref}
        variants={staggerItemEnter(dist, dur, STAGGER_EASE[e])}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);
StaggerItemEnter.displayName = 'StaggerItemEnter';

// Re-export motion & new components for convenience
export { motion, springBounce };
