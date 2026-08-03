import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Timer, Sparkles, BookOpen, Layers, Volume2, Lock, Bell, Gauge, Trash2, RefreshCcw, Calendar, ChevronRight, Swords, Zap, Sun, Moon, Monitor, Palette, PenTool, UserCircle2, Image as ImageIcon, X, Shield, CheckCircle, XCircle } from "lucide-react";
import { ANIMATION_PRESETS } from "@/components/MotionPrimitives";
import { Switch } from "@/components/ui/switch";
import { useSettings, type Theme, type Skin, compressWallpaper } from "@/context/SettingsContext";
import { useAuth } from "@/context/AuthContext";
import { apiAdminDeleteUser } from "@/lib/authApi";
import { Leaderboard } from "@/components/Leaderboard";

export default function More() {
  const navigate = useNavigate();
  const {
    pomodoroVisible, setPomodoroVisible,
    proverbEnabled, setProverbEnabled,
    showRoots, setShowRoots,
    showSimilar, setShowSimilar,
    autoSpeak, setAutoSpeak,
    wakeLock, setWakeLock,
    sound, setSound,
    speechRate, setSpeechRate,
    motionEnabled, setMotionEnabled,
    clearAllCache,
  } = useSettings();
  const { user, isAuthed, isAdmin, banUserAvatar } = useAuth();

  const [confirming, setConfirming] = useState(false);
  const [banUser, setBanUser] = useState("");
  const [banMsg, setBanMsg] = useState("");
  const [delUser, setDelUser] = useState("");
  const [delMsg, setDelMsg] = useState("");

  return (
    <div className="min-h-screen pb-24 pt-6">
      <div className="mx-auto w-full max-w-2xl px-4">
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-foreground">更多设置</h1>
          <p className="mt-1 text-xs text-muted-foreground">个性化你的学习体验</p>
        </header>

        <SectionTitle>账户</SectionTitle>
        <button
          onClick={() => navigate("/account")}
          className="mb-2 flex w-full items-center justify-between rounded-2xl border g-border g-panel px-3.5 py-3 text-left transition-all active:scale-[0.99]"
        >
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg g-icon">
              <UserCircle2 className="h-4 w-4 text-sky-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">
                {isAuthed && user ? user : "未登录"}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground/80">
                {isAuthed ? "点击进入账号管理（退出登录）" : "登录后个人数据保存在云端，解锁更多功能"}
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        <LinkRow to="/pk" icon={<Swords className="h-4 w-4 text-rose-400" />} title="单词 PK" desc="实时匹配对手，比拼谁背得又快又准" />
        <div className="mb-4"><Leaderboard /></div>

        <SectionTitle>界面</SectionTitle>
        <ThemeCard />
        <SkinCard />
        <WallpaperCard />
        <FontColorCard />
        <SettingCard icon={<Zap className="h-4 w-4 text-amber-300" />} title="界面动效" desc="页面切换、卡片飞入等过渡动画（弱机或系统开启「减少动态效果」时自动关闭以保证流畅）">
          <Switch checked={motionEnabled} onCheckedChange={setMotionEnabled} aria-label="界面动效" />
        </SettingCard>
        {motionEnabled && <AnimationPresetCard />}
        <SettingCard icon={<Sparkles className="h-4 w-4 text-violet-400" />} title="AI 每日英语谚语" desc="首页显示 AI 生成的英语谚语 + 中文注释（关掉则只显示当日日期）">
          <Switch checked={proverbEnabled} onCheckedChange={setProverbEnabled} aria-label="显示 AI 谚语" />
        </SettingCard>
        <SettingCard icon={<BookOpen className="h-4 w-4 text-emerald-400" />} title="显示词根词缀" desc="翻转单词卡片时展示本地预生成的词根词缀拆解">
          <Switch checked={showRoots} onCheckedChange={setShowRoots} aria-label="显示词根词缀" />
        </SettingCard>
        <SettingCard icon={<Layers className="h-4 w-4 text-amber-400" />} title="显示形近词" desc="根据词形相近（编辑距离 1-2）或易混对照组展示">
          <Switch checked={showSimilar} onCheckedChange={setShowSimilar} aria-label="显示形近词" />
        </SettingCard>

        <button
          onClick={() => navigate("/plans")}
          className="mb-2 flex w-full items-center justify-between rounded-2xl border g-border g-panel px-3.5 py-3 text-left transition-all active:scale-[0.99]"
        >
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg g-panel">
              <Calendar className="h-4 w-4 text-sky-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">学习计划 & 日历</div>
              <div className="mt-0.5 text-xs text-muted-foreground/80">设定目标、追踪连续学习天数与每日进度</div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        <LinkRow to="/summary" icon={<Sparkles className="h-4 w-4 text-violet-400" />} title="AI 个人总结" desc="根据学习数据生成下一步建议" />

        <SectionTitle>番茄钟</SectionTitle>
        <SettingCard icon={<Timer className="h-4 w-4 text-sky-400" />} title="显示悬浮番茄钟" desc="左下角显示可折叠的计时组件（关闭后不显示）">
          <Switch checked={pomodoroVisible} onCheckedChange={setPomodoroVisible} aria-label="显示番茄钟" />
        </SettingCard>
        <SettingCard icon={<Bell className="h-4 w-4 text-rose-400" />} title="计时结束发声" desc="倒计时到点播放短铃声 + 振动">
          <Switch checked={sound} onCheckedChange={setSound} aria-label="启用铃声" />
        </SettingCard>

        <SectionTitle>设备</SectionTitle>
        <SettingCard icon={<Volume2 className="h-4 w-4 text-cyan-400" />} title="自动朗读单词" desc="翻转卡片时自动用 TTS 朗读英文">
          <Switch checked={autoSpeak} onCheckedChange={setAutoSpeak} aria-label="自动朗读" />
        </SettingCard>
        <SettingCard icon={<Gauge className="h-4 w-4 text-amber-400" />} title="朗读速度" desc="0.5× ~ 2.0×（系统 TTS 引擎决定实际效果）">
          <div className="flex items-center gap-2">
            <input type="range" min="0.5" max="2" step="0.1" value={speechRate} onChange={(e) => setSpeechRate(Number(e.target.value))} className="w-20 accent-primary" aria-label="朗读速度" />
            <span className="w-10 text-center font-mono text-xs text-foreground">{speechRate.toFixed(1)}×</span>
          </div>
        </SettingCard>
        <SettingCard icon={<Lock className="h-4 w-4 text-purple-400" />} title="学习时屏幕常亮" desc="请求 Wake Lock API（仅在沉浸学习页生效，浏览器可能拒绝）">
          <Switch checked={wakeLock} onCheckedChange={setWakeLock} aria-label="屏幕常亮" />
        </SettingCard>

        <SectionTitle>数据</SectionTitle>
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="mt-2 flex w-full items-center justify-between rounded-2xl border border-rose-500/15 bg-rose-500/5 px-4 py-3 text-left transition-all active:scale-[0.99]">
            <div className="flex items-center gap-3">
              <Trash2 className="h-4 w-4 shrink-0 text-rose-400" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">清除学习缓存</div>
                <div className="text-xs text-muted-foreground">已知、收藏、统计、AI 缓存等将重置为初始状态</div>
              </div>
            </div>
            <RefreshCcw className="h-4 w-4 shrink-0 text-rose-400" />
          </button>
        ) : (
          <div className="mt-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
            <p className="mb-3 text-sm text-foreground">确定要清除所有学习数据吗？此操作不可恢复。</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className="flex-1 rounded-xl border g-border g-panel py-2 text-sm text-foreground transition-all active:scale-95">取消</button>
              <button onClick={() => { clearAllCache(); setConfirming(false); }} className="flex-1 rounded-xl bg-rose-500 py-2 text-sm font-medium text-white transition-all active:scale-95">确定清除</button>
            </div>
          </div>
        )}

        {isAdmin && (
          <>
            <SectionTitle>管理</SectionTitle>
            <div className="mb-4 rounded-2xl border g-border g-panel px-3.5 py-3">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/15">
                  <Shield className="h-4 w-4 text-rose-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">头像封禁</div>
                  <div className="text-xs text-muted-foreground/80">输入用户名，封禁或解封该用户的头像</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input value={banUser} onChange={(e) => setBanUser(e.target.value)}
                  placeholder="用户名" maxLength={20}
                  className="flex-1 rounded-xl border g-border g-panel px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50" />
                <button
                  onClick={async () => {
                    const u = banUser.trim(); if (!u) return;
                    try { await banUserAvatar(u, true); setBanMsg(`已封禁 ${u} 的头像`); }
                    catch { setBanMsg("操作失败，请确认用户存在且你是管理员"); }
                  }}
                  className="flex items-center gap-1 rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-400 transition hover:bg-rose-500/25 active:scale-95"
                ><XCircle className="h-3.5 w-3.5" /> 封禁</button>
                <button
                  onClick={async () => {
                    const u = banUser.trim(); if (!u) return;
                    try { await banUserAvatar(u, false); setBanMsg(`已解封 ${u} 的头像`); }
                    catch { setBanMsg("操作失败，请确认用户存在且你是管理员"); }
                  }}
                  className="flex items-center gap-1 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/25 active:scale-95"
                ><CheckCircle className="h-3.5 w-3.5" /> 解封</button>
              </div>
              {banMsg && <p className="mt-2 text-xs text-muted-foreground">{banMsg}</p>}
            </div>

            <div className="mb-4 rounded-2xl border g-border g-panel px-3.5 py-3">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/15">
                  <Trash2 className="h-4 w-4 text-rose-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">注销用户</div>
                  <div className="text-xs text-muted-foreground/80">输入用户名，永久注销该账号（含好友与私信）</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input value={delUser} onChange={(e) => setDelUser(e.target.value)}
                  placeholder="用户名" maxLength={20}
                  className="flex-1 rounded-xl border g-border g-panel px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50" />
                <button
                  onClick={async () => {
                    const u = delUser.trim(); if (!u) return;
                    if (!window.confirm(`确定要注销用户「${u}」吗？此操作不可恢复。`)) return;
                    try { await apiAdminDeleteUser(u); setDelMsg(`已注销用户 ${u}`); setDelUser(''); }
                    catch { setDelMsg('操作失败，请确认用户存在且你是管理员'); }
                  }}
                  className="flex items-center gap-1 rounded-xl bg-rose-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-rose-600 active:scale-95"
                ><Trash2 className="h-3.5 w-3.5" /> 注销</button>
              </div>
              {delMsg && <p className="mt-2 text-xs text-muted-foreground">{delMsg}</p>}
            </div>
          </>
        )}

        <SectionTitle>关于</SectionTitle>

        {/* 作者抖音 */}
        <div className="mb-2 rounded-2xl border border-rose-500/20 bg-gradient-to-r from-rose-500/8 to-pink-500/8 px-3.5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-lg">
              🎵
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">作者抖音</div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  '打开抖音搜索，查看TA的更多作品。 https://v.douyin.com/ZMd25VI_-Pk/ $7 CA7324 1@2.com :4pm'
                ).catch(() => {});
                window.open('https://v.douyin.com/ZMd25VI_-Pk/', '_blank');
              }}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-rose-500/15 px-3 py-1.5 text-sm font-medium text-rose-400 transition active:scale-95 hover:bg-rose-500/25"
            >
              看看作者
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground/60">B501班升本词汇</p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 ml-1 mt-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</h2>;
}

function LinkRow({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="mb-2 flex w-full items-center justify-between rounded-2xl border g-border g-panel px-3.5 py-3 text-left transition-all active:scale-[0.99]"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg g-panel">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground/80">{desc}</div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function SettingCard({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-start justify-between gap-3 rounded-2xl border g-border g-panel px-3.5 py-3">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg g-panel">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{title}</div>
          {desc && <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground/80">{desc}</div>}
        </div>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

function ThemeSwitcher({ value, onChange, className = "" }: { value: Theme; onChange: (v: Theme) => void; className?: string }) {
  const opts: { key: Theme; label: string; icon: React.ReactNode }[] = [
    { key: "light", label: "浅色", icon: <Sun className="h-4 w-4" /> },
    { key: "dark", label: "深色", icon: <Moon className="h-4 w-4" /> },
    { key: "system", label: "系统", icon: <Monitor className="h-4 w-4" /> },
  ];
  return (
    <div className={"flex gap-1 rounded-xl border g-border g-panel p-1 " + className}>
      {opts.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className={"flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all active:scale-95 " + (active ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const SKIN_OPTS: { key: Skin; label: string; desc: string }[] = [
  { key: "default",   label: "默认",      desc: "跟随系统外观主题" },
  { key: "handdrawn", label: "手绘风格",   desc: "素描速写 · 纸纹底" },
  { key: "newspaper", label: "报纸",       desc: "经典报章 · 新闻纸" },
  { key: "matcha",    label: "薄荷抹茶",   desc: "清新绿调 · 柔光" },
  { key: "minimal",   label: "极简线条",   desc: "纯粹黑白 · 无装饰" },
  { key: "crayon",    label: "卡通蜡笔",   desc: "童趣涂鸦 · 波点" },
  { key: "mengnan",   label: "猛男粉",     desc: "热粉霓虹 · 光晕" },
];

/* 主题风格预览缩略图：点开前按钮上直接展示当前皮肤的样子 */
const SKIN_PREVIEW: Record<string, { bg: string; bar: string; border: string; radius: string }> = {
  default:   { bg: "linear-gradient(135deg,#eef2f7,#dde3ec)", bar: "#64748b", border: "1px solid rgba(100,116,139,0.35)", radius: "7px" },
  handdrawn: { bg: "#fbfaf4", bar: "#2b2b2b", border: "1.6px solid #2b2b2b", radius: "14px 6px 14px 6px" },
  newspaper: { bg: "#f3ecdb", bar: "#b91c1c", border: "1px solid rgba(120,90,40,0.3)", radius: "2px" },
  matcha:    { bg: "linear-gradient(135deg,#e7f4e8,#d3ebd5)", bar: "#2e9e5b", border: "1px solid rgba(46,158,91,0.35)", radius: "16px" },
  minimal:   { bg: "#ffffff", bar: "#111827", border: "1px solid rgba(17,24,39,0.2)", radius: "5px" },
  crayon:    { bg: "linear-gradient(135deg,#fff3e0,#ffe2c2)", bar: "#f97316", border: "2.5px solid #f97316", radius: "18px 10px 16px 10px" },
  mengnan:   { bg: "linear-gradient(135deg,#ffe1ee,#ffc6e0)", bar: "#ec4899", border: "1px solid rgba(236,72,153,0.4)", radius: "16px" },
};

function SkinPreview({ skin }: { skin: Skin }) {
  const p = SKIN_PREVIEW[skin] || SKIN_PREVIEW.default;
  return (
    <div
      className="h-8 w-8 shrink-0 overflow-hidden ring-1 ring-border/40"
      style={{ background: p.bg, border: p.border, borderRadius: p.radius }}
    >
      <div className="h-1.5 w-full" style={{ background: p.bar }} />
      <div className="space-y-0.5 px-1 pt-1">
        <div className="h-1 w-3/4 rounded-full" style={{ background: p.bar, opacity: 0.55 }} />
        <div className="h-1 w-1/2 rounded-full" style={{ background: p.bar, opacity: 0.3 }} />
      </div>
    </div>
  );
}

function SkinCard() {
  const { skin, setSkin } = useSettings();
  const current = SKIN_OPTS.find((o) => o.key === skin) || SKIN_OPTS[0];
  return (
    <PopoverMenu
      icon={<PenTool className="h-4 w-4 text-rose-400" />}
      title="主题风格"
      value={current.label}
      preview={<SkinPreview skin={skin} />}
      popoverTitle="选择主题风格"
    >
      {(close) => (
        <div className="flex flex-col gap-0.5 pb-1">
          {SKIN_OPTS.map((o) => {
            const active = skin === o.key;
            return (
              <button
                key={o.key}
                onClick={() => { setSkin(o.key); close(); }}
                className={"flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98] " + (active ? "bg-primary/10 text-primary" : "hover:bg-muted/40 text-foreground")}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{o.label}</div>
                  <div className={"mt-0.5 text-xs " + (active ? "text-primary/70" : "text-muted-foreground")}>{o.desc}</div>
                </div>
                {active && <CheckCircle className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </PopoverMenu>
  );
}
function ThemeCard() {
  const { theme, setTheme } = useSettings();
  return (
    <div className="mb-2 rounded-2xl border g-border g-panel px-3.5 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg g-icon">
          <Palette className="h-4 w-4 text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">外观主题</div>
          <div className="mt-0.5 text-xs text-muted-foreground/80">浅色 / 深色，或跟随系统自动切换</div>
        </div>
      </div>
      <ThemeSwitcher value={theme} onChange={setTheme} className="mt-3" />
    </div>
  );
}

/** 自定义壁纸卡片：上传/更换/移除全站背景图 */
function WallpaperCard() {
  const { wallpaper, setWallpaper } = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { alert("壁纸文件不能超过 8MB"); return; }
    try {
      const data = await compressWallpaper(file);
      setWallpaper(data);
    } catch {
      alert("壁纸处理失败，请换一张图片试试");
    }
  };

  return (
    <div className="mb-2 rounded-2xl border g-border g-panel px-3.5 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg g-icon">
          <ImageIcon className="h-4 w-4 text-sky-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">自定义壁纸</div>
          <div className="mt-0.5 text-xs text-muted-foreground/80">背景图覆盖全站（设置后首页渐变会被替换）</div>
        </div>
      </div>
      {wallpaper ? (
        <div className="mt-3 space-y-2">
          <div className="relative overflow-hidden rounded-lg border g-border">
            <img src={wallpaper} alt="壁纸预览" className="h-28 w-full object-cover" />
            <button
              onClick={() => setWallpaper("")}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-all hover:bg-black/80"
              aria-label="移除壁纸"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border g-border g-panel py-2 text-xs text-muted-foreground transition hover:text-foreground active:scale-95"
          >
            <ImageIcon className="h-3.5 w-3.5" /> 更换壁纸
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border g-border g-panel py-2.5 text-xs text-primary transition hover:-translate-y-0.5 active:scale-95"
        >
          <ImageIcon className="h-3.5 w-3.5" /> 上传图片作为壁纸
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

function FontColorCard() {
  const { fontColor, setFontColor } = useSettings();
  const [swatch, setSwatch] = useState<string>(fontColor || "#ffffff");
  useEffect(() => {
    if (!fontColor) setSwatch("#ffffff");
    else setSwatch(fontColor);
  }, [fontColor]);

  const PRESETS = ["#ffffff","#e2e8f0","#fbbf24","#f87171","#34d399","#60a5fa","#a78bfa","#f472b6","#000000"];

  return (
    <PopoverMenu
      icon={<Palette className="h-4 w-4 text-amber-400" />}
      title="字体颜色"
      value={
        fontColor ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded-full border border-border" style={{ backgroundColor: fontColor }} />
            <span className="font-mono text-[11px]">{fontColor}</span>
          </span>
        ) : "跟随主题自动适配"
      }
      popoverTitle="选择字体颜色"
    >
      {(close) => (
        <div className="space-y-2.5 p-1">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => { setFontColor(""); close(); }}
              className={"flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition active:scale-95 " + (!fontColor ? "bg-primary/10 text-primary" : "hover:bg-muted/40 text-foreground")}
            >
              <div className="h-5 w-5 rounded-full border-2 border-dashed border-current" /> 默认
            </button>
            {PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => { setFontColor(c); close(); }}
                className={"h-9 w-9 rounded-xl border-2 transition active:scale-90 " + (fontColor === c ? "border-primary ring-1 ring-primary" : "border-transparent")}
                style={{ backgroundColor: c }}
                aria-label={"字体颜色 " + c}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <input
              type="color"
              value={swatch}
              onChange={(e) => setFontColor(e.target.value)}
              className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border g-border g-panel"
              aria-label="选择字体颜色"
            />
            <div className="flex-1 truncate text-sm font-semibold" style={fontColor ? { color: fontColor } : undefined}>
              Aa 预览效果
            </div>
            <button
              onClick={() => { setFontColor(""); close(); }}
              disabled={!fontColor}
              className="shrink-0 rounded-full g-panel px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-40"
            >
              恢复默认
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground/60">
            深色背景建议浅色，浅色背景建议深色
          </p>
        </div>
      )}
    </PopoverMenu>
  );
}
/* ============================================================
   共享组件：锚点气泡菜单（Popover Menu）
   触发按钮展示当前选中项；点击在按钮上方弹出浮层单选。
   ============================================================ */

function PopoverMenu({
  icon, title, value, popoverTitle, preview, children,
}: {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  popoverTitle: string;
  preview?: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const updateCoords = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setCoords({ top: r.top, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const onScroll = () => updateCoords();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updateCoords]);

  useLayoutEffect(() => {
    if (!open || !coords) return;
    const btn = triggerRef.current;
    const pop = popRef.current;
    if (!btn || !pop) return;
    const r = btn.getBoundingClientRect();
    const popH = pop.offsetHeight;
    const gap = 8;
    const maxW = Math.min(r.width, 360);
    const middle = window.innerHeight / 2;
    const btnCenter = r.top + r.height / 2;
    const spaceAbove = r.top;
    const spaceBelow = window.innerHeight - r.bottom;
    let above: boolean;
    if (btnCenter < middle) {
      // 上半屏：优先向上弹（用户规则），空间不足则向下
      above = spaceAbove >= popH + gap;
    } else {
      // 下半屏：优先向下弹（用户规则），空间不足则向上
      above = !(spaceBelow >= popH + gap);
    }
    if (above) {
      setStyle({ left: r.left, width: maxW, bottom: window.innerHeight - r.top + gap });
    } else {
      setStyle({ left: r.left, width: maxW, top: r.bottom + gap });
    }
  }, [open, coords]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex w-full items-center gap-2.5 rounded-2xl border g-border g-panel px-3.5 py-3 text-left transition active:scale-[0.99]"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center">
          {preview ?? <div className="flex h-8 w-8 items-center justify-center rounded-lg g-icon">{icon}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{title}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground/80">{value}</div>
        </div>
        <ChevronRight className={"h-4 w-4 shrink-0 text-muted-foreground transition-transform " + (open ? "rotate-90" : "")} />
      </button>

      {open && coords && createPortal(
        <div className="fixed inset-0 z-50" onClick={close}>
          <div
            ref={popRef}
            onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", ...style }}
            className="animate-[popIn_0.15s_ease-out] rounded-2xl border g-border bg-background/98 backdrop-blur-xl p-2 shadow-2xl"
          >
            <div className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{popoverTitle}</div>
            {children(close)}
          </div>
          <style>{`@keyframes popIn { from { opacity:0; transform: translateY(8px) scale(0.96); } to { opacity:1; transform: none; } }`}</style>
        </div>,
        document.body
      )}
    </>
  );
}

/** 动画预设卡片（收起的锚点气泡菜单） */
function AnimationPresetCard() {
  const { animationPreset, setAnimationPreset } = useSettings();
  const current = ANIMATION_PRESETS[animationPreset];
  return (
    <PopoverMenu
      icon={<Sparkles className="h-4 w-4 text-violet-300" />}
      title="动画风格"
      value={animationPreset + " · " + current.desc}
      popoverTitle="选择动画风格"
    >
      {(close) => (
        <div className="flex flex-col gap-0.5 pb-1">
          {(["灵动", "适中", "优雅"] as const).map((p) => {
            const active = animationPreset === p;
            const cfg = ANIMATION_PRESETS[p];
            return (
              <button
                key={p}
                onClick={() => { setAnimationPreset(p); close(); }}
                className={"flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98] " + (active ? "bg-primary/10 text-primary" : "hover:bg-muted/40 text-foreground")}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{p}</div>
                  <div className={"mt-0.5 text-xs " + (active ? "text-primary/70" : "text-muted-foreground")}>{cfg.desc}</div>
                </div>
                {active && <CheckCircle className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </PopoverMenu>
  );
}