import { useState, useEffect } from "react"
import { BrowserRouter, Route, NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useMotionEnabled } from "@/lib/motionPref";
import { getPkSocket, onPk, emitPk } from "@/lib/pkSocket";
import { Home, BookOpen, Brain, Star, MessageCircle, MoreHorizontal, Users } from "lucide-react";
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider, useSettings } from "./context/SettingsContext";
import Index from "./pages/Index";
import Browse from "./pages/Browse";
import Flashcards from "./pages/Flashcards";
import SearchPage from "./pages/Search";
import Starred from "./pages/Starred";
import Plans from "./pages/Plans";
import Summary from "./pages/Summary";
import ArticleGen from "./pages/ArticleGen";
import CustomLibrary from "./pages/CustomLibrary";
import CustomFlashcards from "./pages/CustomFlashcards";
import Listen from "./pages/Listen";
import Login from "./pages/Login";
import Account from "./pages/Account";
import More from "./pages/More";
import Community from "./pages/Community";
import Friends from "./pages/Friends";
import User from "./pages/User";
import StudyRoom from "./pages/StudyRoom";
import Battle from "./pages/Battle";
import PublicNotes from "./pages/PublicNotes";
import ImmersiveLearn from "./components/ImmersiveLearn";
import { PomodoroTimer } from "./components/PomodoroTimer";
import { AnimatedRoutes } from "./components/AnimatedRoutes";
import { PageTransition } from "./components/PageTransition";

const navItems = [
  { to: "/", label: "首页", icon: Home },
  { to: "/browse", label: "词库", icon: BookOpen },
  { to: "/search", label: "学习法", icon: Brain },
  { to: "/starred", label: "收藏", icon: Star },
  { to: "/community", label: "社区", icon: MessageCircle },
  { to: "/friends", label: "好友", icon: Users },
  { to: "/more", label: "更多", icon: MoreHorizontal },
];

function NavBar() {
  const { pathname } = useLocation();
  const motionOn = useMotionEnabled();
  const isImmersive = pathname === "/immersive";
  if (isImmersive) return null;

  // 选中项：精确匹配子路由（/browse/:part 等仍高亮「词库」）
  const friendsIdx = navItems.findIndex((n) => n.to === '/friends')
  const activeIdx = navItems.findIndex((n) =>
    n.to === "/" ? pathname === "/" : pathname === n.to || pathname.startsWith(n.to + "/")
  );
  let idx = activeIdx >= 0 ? activeIdx : 0
  if (activeIdx < 0 && friendsIdx >= 0 && (pathname.startsWith('/user') || pathname.startsWith('/study') || pathname.startsWith('/friends'))) {
    idx = friendsIdx
  }

  // reduced-motion 系统偏好：保留外壳连续滑动（不跳变），但去掉弹性形变与图标交叉淡入淡出
  const reduceMotion = !motionOn;

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      {/* 外壳：单一连续磨砂玻璃胶囊，边框始终不断裂；内部高亮与图标在其中平滑过渡。
          毛玻璃用内联 backdrop-filter（不随移动端 media query 降级），保证手机上也明显。 */}
      <div
        className="relative flex items-center gap-1 rounded-full p-1.5 shadow-xl shadow-black/25"
        style={{
          backdropFilter: "blur(22px) saturate(1.8)",
          WebkitBackdropFilter: "blur(22px) saturate(1.8)",
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--glass-nav) 88%, white 6%), color-mix(in oklab, var(--glass-nav) 78%, black 4%))",
          border: "1px solid color-mix(in oklab, var(--border) 70%, white 30%)",
          boxShadow:
            "0 8px 30px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.08)",
        }}
      >
        {navItems.map((n, i) => {
          const isActive = i === idx;
          const Icon = n.icon;
          return (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              aria-label={n.label}
              className="relative flex h-11 w-11 items-center justify-center rounded-full"
            >
              {/* 共享高亮：用 layoutId 让同一颗胶囊在槽位间流畅滑动 + 轻微形变，外壳不中断。
                  reduced-motion 下仍保留 layoutId（连续位移），仅去掉弹性形变。 */}
              {isActive && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-full bg-primary"
                  initial={reduceMotion ? false : { scale: 0.82, opacity: 0.4 }}
                  animate={
                    reduceMotion
                      ? { scale: 1, opacity: 1 }
                      : { scale: 1, opacity: 1, borderRadius: ["42% 42% 46% 46%", "50% 50% 50% 50%", "48% 48% 52% 52%"] }
                  }
                  transition={
                    reduceMotion
                      ? { duration: 0.18 }
                      : { type: "spring", stiffness: 380, damping: 30, borderRadius: { duration: 0.5 } }
                  }
                />
              )}
              {/* 图标：固定槽位内交叉淡入淡出，旧图标淡出、新图标淡入。
                  reduced-motion 下直接渲染静态图标，避免割裂。 */}
              <span className="relative z-10 flex items-center justify-center">
                {reduceMotion ? (
                  <Icon className={"h-5 w-5 " + (isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={isActive ? "on" : "off"}
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute flex items-center justify-center"
                    >
                      <Icon className={"h-5 w-5 " + (isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                    </motion.span>
                  </AnimatePresence>
                )}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}


function PkInviteListener() {
  const navigate = useNavigate()
  const [invite, setInvite] = useState<{ from: string; mode: string } | null>(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  useEffect(() => {
    if (!token) return
    getPkSocket(token)
    const off = onPk('pk:inviteReceived', (d: { from: string; mode: string }) => {
      setInvite({ from: d.from, mode: d.mode || 'human' })
    })
    return off
  }, [token])
  if (!invite) return null
  const from = invite.from
  const decline = () => { emitPk('pk:declineInvite', { fromUsername: from }); setInvite(null) }
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={decline}>
      <div className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-foreground">{from} 邀请你单词 PK</h3>
        <p className="mt-1 text-sm text-muted-foreground">要不要来一局实时对战，比一比谁背得又快又准？</p>
        <div className="mt-4 flex gap-2">
          <button onClick={decline} className="flex-1 rounded-xl g-border g-panel py-2.5 text-sm text-muted-foreground">拒绝</button>
          <button onClick={() => { setInvite(null); navigate('/pk?invite=' + encodeURIComponent(from)) }} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground">接受</button>
        </div>
      </div>
    </div>
  )
}

function GlobalOverlays() {
  const { pomodoroVisible } = useSettings();
  return pomodoroVisible ? <PomodoroTimer /> : null;
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter basename={window.location.pathname.startsWith('/vs') ? '/vs' : ''}>
          <div className="min-h-screen">
            <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
              <AnimatedRoutes>
                <Route path="/" element={<PageTransition transition="stagger"><Index /></PageTransition>} />
                <Route path="/browse" element={<PageTransition transition="stagger"><Browse /></PageTransition>} />
                <Route path="/browse/:part" element={<PageTransition transition="stagger"><Browse /></PageTransition>} />
                <Route path="/browse/:part/:list" element={<PageTransition transition="stagger"><Browse /></PageTransition>} />
                <Route path="/flashcards/:part/:list" element={<PageTransition transition="stagger"><Flashcards /></PageTransition>} />
                <Route path="/flashcards/custom/:listId" element={<PageTransition transition="stagger"><CustomFlashcards /></PageTransition>} />
                <Route path="/review" element={<PageTransition transition="stagger"><Flashcards /></PageTransition>} />
                <Route path="/search" element={<PageTransition transition="stagger"><SearchPage /></PageTransition>} />
                <Route path="/starred" element={<PageTransition transition="stagger"><Starred /></PageTransition>} />
                <Route path="/plans" element={<PageTransition transition="stagger"><Plans /></PageTransition>} />
                <Route path="/summary" element={<PageTransition transition="stagger"><Summary /></PageTransition>} />
                <Route path="/article" element={<PageTransition transition="stagger"><ArticleGen /></PageTransition>} />
                <Route path="/custom" element={<PageTransition transition="stagger"><CustomLibrary /></PageTransition>} />
                <Route path="/custom/:listId" element={<PageTransition transition="stagger"><CustomLibrary /></PageTransition>} />
                <Route path="/listen" element={<PageTransition transition="stagger"><Listen /></PageTransition>} />
                <Route path="/more" element={<PageTransition transition="stagger"><More /></PageTransition>} />
                <Route path="/community" element={<PageTransition transition="stagger"><Community /></PageTransition>} />
                <Route path="/friends" element={<PageTransition transition="stagger"><Friends /></PageTransition>} />
                <Route path="/user/:username" element={<PageTransition transition="stagger"><User /></PageTransition>} />
                <Route path="/study/:friend" element={<PageTransition transition="stagger"><StudyRoom /></PageTransition>} />
                <Route path="/public-notes" element={<PageTransition transition="stagger"><PublicNotes /></PageTransition>} />
                <Route path="/pk" element={<PageTransition transition="stagger"><Battle /></PageTransition>} />
                <Route path="/login" element={<PageTransition transition="stagger"><Login /></PageTransition>} />
                <Route path="/account" element={<PageTransition transition="stagger"><Account /></PageTransition>} />
                <Route path="/immersive" element={<PageTransition transition="stagger"><ImmersiveLearn /></PageTransition>} />
                <Route path="*" element={<PageTransition transition="stagger"><Index /></PageTransition>} />
              </AnimatedRoutes>
            </main>
            <NavBar />
            <GlobalOverlays />
            <PkInviteListener />
          </div>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
