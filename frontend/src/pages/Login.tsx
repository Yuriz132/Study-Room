import { useState, useRef, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, Smartphone, Mail } from "lucide-react";
import { ExplodeIn, FlyIn } from "@/components/MotionPrimitives";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { LegalTermsContent } from "@/components/LegalTerms";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Login() {
  const { login, register, loginLocal } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const geetestResult = useRef<{ lot_number: string; captcha_output: string; pass_token: string; gen_time: string } | null>(null);
  const captchaObjRef = useRef<any>(null);
  // 极验 captcha ID from Vite env (statically replaced at build time)
  const geetestCaptchaId: string | undefined = (() => {
    try { const k = import.meta.env.VITE_GEETEST_CAPTCHA_ID as string | undefined; return k || undefined; }
    catch { return undefined; }
  })();

  // Load 极验 Geetest v4 行为验证
  // 关键点：组件 mount 时默认是登录模式，#geetest-widget 容器未渲染；
  // 所以必须等切换到注册模式后再初始化，否则 appendTo 会找不到目标。
  useEffect(() => {
    if (!geetestCaptchaId || mode !== 'register') return;

    const loadScript = () => {
      return new Promise<void>((resolve) => {
        if (document.querySelector('script[src*="static.geetest.com/v4/gt4.js"]')) {
          resolve();
          return;
        }
        const s = document.createElement('script');
        s.src = 'https://static.geetest.com/v4/gt4.js';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => resolve();
        document.head.appendChild(s);
      });
    };

    loadScript().then(() => {
      if (!(window as any).initGeetest4) return;
      (window as any).initGeetest4({
        captchaId: geetestCaptchaId,
        product: 'popup',
        language: 'zho',
      }, (captchaObj: any) => {
        captchaObjRef.current = captchaObj;
        captchaObj.appendTo('#geetest-widget');
        captchaObj.onReady(() => {
          // 验证码就绪
        }).onSuccess(() => {
          const result = captchaObj.getValidate();
          if (result) geetestResult.current = result;
        }).onError((err: any) => {
          console.error('Geetest error:', err?.msg || err);
          setError('验证码加载失败，请刷新页面重试');
        });
      });
    });

    return () => {
      if (captchaObjRef.current) {
        try { captchaObjRef.current.destroy(); } catch {}
        captchaObjRef.current = null;
      }
      geetestResult.current = null;
    };
  }, [geetestCaptchaId, mode]);
  const [agreed, setAgreed] = useState(false);
  const [showAgreementDialog, setShowAgreementDialog] = useState(false);
  const agreementRef = useRef<HTMLDivElement>(null);

  const scrollToAgreement = () => {
    agreementRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const name = username.trim();
    if (name.length < 3) return setError("用户名至少 3 个字符（字母/数字/下划线）");
    if (password.length < 6) return setError("密码至少 6 位");
    if (!agreed) return setError("请先勾选同意服务协议与隐私政策");
    setBusy(true);
    try {
      if (mode === "login") await login(name, password);
      else {
        const hpVal = ((e.target as HTMLFormElement).elements.namedItem('hp') as HTMLInputElement)?.value || '';
        if (geetestCaptchaId && !geetestResult.current) { setError('请先完成人机验证'); setBusy(false); return; }
        await register(name, password, { hp: hpVal, email: email.trim() || undefined, phone: phone.trim() || undefined, geetest: geetestResult.current ?? undefined });
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "操作失败，请稍后重试";
      setError(msg);
      setBusy(false);
    }
  };

  const guest = () => {
    loginLocal("本地游客");
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-10">
      <ExplodeIn initialScale={0.75}>
        <div className="w-full rounded-3xl border g-border g-panel p-8 text-center backdrop-blur-xl">
          <img src={`${window.location.pathname.startsWith("/vs") ? "/vs" : ""}/logo.png?v=2`} alt="升本词汇" className="mx-auto h-20 w-20 rounded-2xl object-contain shadow-lg" />
          <h1 className="mt-3 bg-gradient-to-r from-primary to-sky-300 bg-clip-text font-bold text-transparent" style={{ fontSize: "2rem" }}>
            升本词汇
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">登录后，学习进度可同步到云端（服务端同步将在后续版本开放）</p>

          <div className="mt-6 flex gap-2">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-lg py-2 text-sm transition-all active:scale-95",
                  mode === m ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-3 text-left">
            <label className="flex items-center gap-2 rounded-lg g-panel px-4 py-3 ring-1 g-ring focus-within:ring-primary">
              <User className="h-4 w-4 text-muted-foreground" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名"
                autoComplete="username"
                className="w-full border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <label className="flex items-center gap-2 rounded-lg g-panel px-4 py-3 ring-1 g-ring focus-within:ring-primary">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>

            {/* 注册选填：邮箱 / 手机号（用于找回密码） */}
            {mode === "register" && (
              <>
                <label className="flex items-center gap-2 rounded-lg g-panel px-4 py-3 ring-1 g-ring focus-within:ring-primary">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="邮箱（选填，用于找回密码）"
                    autoComplete="email"
                    className="w-full border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-lg g-panel px-4 py-3 ring-1 g-ring focus-within:ring-primary">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="手机号（选填，用于找回密码）"
                    autoComplete="tel"
                    className="w-full border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </label>
              </>
            )}

            {/* Honeypot — hidden from real users, filled by bots */}
            <input
              name="hp"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
              aria-hidden="true"
            />

            {/* 极验行为验证 — 注册时展示（未配置 captcha ID 则隐藏） */}
            {mode === 'register' && geetestCaptchaId && (
              <div className="flex justify-center py-1">
                <div id="geetest-widget" />
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            {/* 同意协议勾选框 — 点击时弹出二次确认，避免无意识勾选 */}
            <label className="flex items-start gap-2 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => {
                  if (e.target.checked) {
                    // 勾选时弹出确认弹窗（取消勾选则直接取消）
                    setShowAgreementDialog(true)
                  } else {
                    setAgreed(false)
                  }
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                我已阅读并同意
                <button type="button" onClick={scrollToAgreement} className="text-primary underline underline-offset-2 mx-0.5">服务协议</button>
                与隐私政策
              </span>
            </label>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              {busy ? "处理中…" : mode === "login" ? "登录" : "注册并登录"}
            </button>

            {mode === "login" && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-primary"
                >
                  忘记密码？
                </button>
              </div>
            )}
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground/60">
            <span className="h-px flex-1 g-panel" />
            或
            <span className="h-px flex-1 g-panel" />
          </div>

          <button
            type="button"
            onClick={guest}
            className="flex w-full items-center justify-center gap-2 rounded-lg border g-border g-panel py-3 text-sm font-medium text-foreground transition-all hover:-translate-y-0.5 active:scale-95"
          >
            <Smartphone className="h-4 w-4 text-primary" /> 本地游客模式（仅本机保存）
          </button>
        </div>
      </ExplodeIn>

      <FlyIn delay={0.12}>
        <p className="mt-4 px-6 text-center text-xs text-muted-foreground">
          本地游客：学习记录仅保存在本机浏览器；账号登录后可跨设备同步。
        </p>
      </FlyIn>

      {/* 服务协议二次确认弹窗 — 防止用户无意识勾选 */}
      <AlertDialog open={showAgreementDialog} onOpenChange={setShowAgreementDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-xl">隐私政策</AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm leading-relaxed pt-2">
              请阅读并同意
              <a
                href="#service-agreement"
                onClick={(e) => { e.preventDefault(); scrollToAgreement(); setShowAgreementDialog(false); }}
                className="text-primary underline underline-offset-2 mx-1 font-medium"
              >
                《服务协议》
              </a>
              与
              <a
                href="#service-agreement"
                onClick={(e) => { e.preventDefault(); scrollToAgreement(); setShowAgreementDialog(false); }}
                className="text-primary underline underline-offset-2 mx-1 font-medium"
              >
                《隐私政策》
              </a>
              后再继续注册 / 登录
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border g-border g-panel p-3 text-xs leading-relaxed text-muted-foreground/90 max-h-40 overflow-y-auto">
            <p className="mb-1.5"><span className="font-medium text-foreground">一、平台性质：</span>本站为本班同学免费内部学习平台，非营利性质，不对外公开推广。</p>
            <p className="mb-1.5"><span className="font-medium text-foreground">二、内容规范：</span>用户评论、上传图片仅限学习交流；禁止发布盗版资源、不良图文、广告引流内容；禁止向外分享链接。</p>
            <p className="mb-1.5"><span className="font-medium text-foreground">三、法律责任：</span>违规内容一经发现将立即删除，发布者账号将被限制访问。</p>
            <p className="mb-1.5"><span className="font-medium text-foreground">四、知识产权：</span>本站收录的词汇、音频等学习资源仅供内部教学使用。</p>
            <p className="mb-1.5"><span className="font-medium text-foreground">五、隐私保护：</span>本站仅收集用户名与加密密码用于账号登录；可选填的邮箱/手机号仅用于找回密码，不会向任何第三方提供；学习记录存储于服务器以便跨设备同步。</p>
            <p><span className="font-medium text-foreground">六、生效条款：</span>访问或注册本站即视为您已阅读、理解并同意以上全部约定。</p>
          </div>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              onClick={() => setShowAgreementDialog(false)}
              className="flex-1 rounded-lg border g-border g-panel py-2.5"
            >
              拒绝
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setAgreed(true); setShowAgreementDialog(false); }}
              className="flex-1 rounded-lg bg-primary py-2.5 hover:bg-primary/90"
            >
              同意
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 完整服务协议与隐私政策（底部） */}
      <FlyIn delay={0.18}>
        <div id="service-agreement" ref={agreementRef} className="mt-6 w-full max-w-md rounded-2xl border g-border g-panel p-5">
          <h3 className="mb-3 text-center text-sm font-semibold text-foreground">服务协议与隐私政策</h3>
          <LegalTermsContent />
        </div>
      </FlyIn>
    </div>
  );
}
