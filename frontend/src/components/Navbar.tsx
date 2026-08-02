import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Search, Star, LayoutGrid, BookMarked, AudioLines, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiquidGlass } from '@/components/LiquidGlass';
import { AccountMenu } from '@/components/AccountMenu';

const navItems = [
  { to: '/', label: '概览', icon: LayoutGrid },
  { to: '/browse', label: '浏览', icon: BookOpen },
  { to: '/custom', label: '词库', icon: BookMarked },
  { to: '/quiz', label: '测验', icon: AudioLines },
  { to: '/community', label: '社区', icon: Users },
  { to: '/search', label: '搜索', icon: Search },
  { to: '/starred', label: '生词本', icon: Star },
];

// 空闲多久后自动上滑隐藏（ms）
const IDLE_HIDE_MS = 4500;

export function Navbar() {
  const location = useLocation();
  const [hidden, setHidden] = useState(false);
  const hideTimer = useRef<number | null>(null);

  // 滑动高亮指示层的位置/尺寸
  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  // 根据当前路由计算高亮层坐标（相对 nav 容器）
  const calcIndicator = () => {
    const idx = navItems.findIndex((item) =>
      item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
    );
    const el = idx >= 0 ? linkRefs.current[idx] : null;
    if (el && navRef.current) {
      const navRect = navRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicator({ left: elRect.left - navRect.left, width: elRect.width, ready: true });
    }
  };

  // 路由变化时平滑移动高亮层
  useLayoutEffect(() => {
    calcIndicator();
  }, [location.pathname]);

  // 尺寸变化（响应式显示文字等）重新对齐
  useEffect(() => {
    const onResize = () => calcIndicator();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // 不滑动 / 不操作超过 2s → 顶栏上滑隐藏；任意操作 → 立即弹出并重置计时
  useEffect(() => {
    const wake = () => {
      setHidden(false);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setHidden(true), IDLE_HIDE_MS);
    };
    wake(); // 启动首次计时

    const events = ['scroll', 'mousemove', 'touchstart', 'touchmove', 'pointerdown', 'click', 'keydown', 'wheel'];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, wake));
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  // 顶栏空闲自动隐藏（无左右滑动）

  return (
    <header className="sticky top-0 z-50 w-full">
      <LiquidGlass
        as="div"
        className={cn(
          'liquid-glass lg-imm-bar mx-auto mt-3 flex max-w-5xl items-center justify-center gap-1 px-4 py-2.5 sm:px-6',
          hidden ? 'lg-imm-hidden' : 'lg-imm-visible'
        )}
        style={{ borderRadius: 'calc(var(--radius) + 8px)' }}
      >
        <nav ref={navRef} className="relative flex items-center gap-1">
          {/* 滑动高亮指示层：选中项之间平移移动（视觉上的"滑过去"） */}
          {indicator.ready && (
            <span
              aria-hidden="true"
              className="nav-indicator"
              style={{ transform: `translateX(${indicator.left}px)`, width: `${indicator.width}px` }}
            />
          )}
          {navItems.map((item, i) => {
            const active = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                ref={(el) => { linkRefs.current[i] = el; }}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative z-10 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-colors duration-300',
                  active
                    ? 'nav-item-active'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('h-4 w-4 transition-transform', active && 'nav-icon-bounce')} />
                <span className={cn('hidden sm:inline', active && 'nav-label-pop')}>{item.label}</span>
              </Link>
            );
          })}
          <AccountMenu />
        </nav>
      </LiquidGlass>
    </header>
  );
}
