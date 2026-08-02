import { useState, useRef, type FormEvent } from "react";
import { User, Lock, Smartphone } from "lucide-react";
import { ExplodeIn, FlyIn } from "@/components/MotionPrimitives";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

export default function Login() {
  const { login, register, loginLocal } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
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
      else await register(name, password);
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

            {error && <p className="text-sm text-red-400">{error}</p>}

            {/* 同意协议勾选框 */}
            <label className="flex items-start gap-2 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
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

      {/* 完整服务协议与隐私政策（底部） */}
      <FlyIn delay={0.18}>
        <div ref={agreementRef} className="mt-6 w-full max-w-md rounded-2xl border g-border g-panel p-5">
          <h3 className="mb-3 text-center text-sm font-semibold text-foreground">服务协议与隐私政策</h3>
          <div className="space-y-2 text-[11px] leading-relaxed text-muted-foreground/80">
            <div>
              <h4 className="mb-0.5 text-xs font-medium text-foreground/80">一、平台性质</h4>
              <p>本站为本班同学免费内部学习平台，非营利性质，不对外公开推广。</p>
            </div>
            <div>
              <h4 className="mb-0.5 text-xs font-medium text-foreground/80">二、内容规范</h4>
              <p>用户评论、上传图片仅限学习交流。禁止发布盗版资源、不良图文、他人隐私信息及广告引流内容；禁止向外分享访问链接、邀请非本班人员访问。</p>
            </div>
            <div>
              <h4 className="mb-0.5 text-xs font-medium text-foreground/80">三、法律责任</h4>
              <p>用户在平台上发布的图文内容由发布者自行承担法律责任。违规内容一经发现将立即删除，发布者账号将被限制访问。</p>
            </div>
            <div>
              <h4 className="mb-0.5 text-xs font-medium text-foreground/80">四、知识产权</h4>
              <p>本站收录的词汇、音频等学习资源仅供内部教学使用。如有版权争议，请通过「更多」页面底部联系站长，我们将及时处理。</p>
            </div>
            <div>
              <h4 className="mb-0.5 text-xs font-medium text-foreground/80">五、隐私保护</h4>
              <p>本站仅收集用户名与加密密码用于账号登录，学习记录（已学单词、笔记、收藏等）存储于服务器以便跨设备同步。我们不会向任何第三方提供您的个人数据。</p>
            </div>
            <div>
              <h4 className="mb-0.5 text-xs font-medium text-foreground/80">六、生效条款</h4>
              <p>访问或注册本站即视为您已阅读、理解并同意以上全部约定。本协议可能根据实际情况更新，更新后继续使用即视为接受新条款。</p>
            </div>
          </div>
        </div>
      </FlyIn>
    </div>
  );
}
