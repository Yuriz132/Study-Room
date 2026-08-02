import { Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";

interface AnimatedRoutesProps {
  children: React.ReactNode;
}

/**
 * AnimatedRoutes - 页面切换动画容器
 *
 * - mode="wait"：旧页面退出动画播完后，新页面再进入，避免 popLayout 退场
 *   重叠导致的布局回流（页面内容在切换瞬间“从中间跳到顶部”的根因之一）。
 * - 每次路由切换都 window.scrollTo(0,0)：避免新页面停留在旧滚动位置、
 *   随后被滚到顶而产生的视觉跳动（根因之二）。
 *
 * ⚠️ 重要：Navbar/Header/Sidebar 必须放在 AnimatedRoutes 外部，
 * 否则每次页面切换都会重新创建并参与动画。
 */
export function AnimatedRoutes({ children }: AnimatedRoutesProps) {
  const location = useLocation();

  // 切页即回到顶部，消除“停在原滚动位置→跳到顶”的跳动
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {children}
      </Routes>
    </AnimatePresence>
  );
}
