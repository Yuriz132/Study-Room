import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, Smartphone, ShieldCheck, ArrowLeft, KeyRound } from "lucide-react";
import { ExplodeIn, FlyIn } from "@/components/MotionPrimitives";
import { useAuth } from "@/context/AuthContext";
import { apiForgot, apiResetPassword } from "@/lib/authApi";
import { cn } from "@/lib/utils";

export default function ForgotPassword() {
  const { login } = useAuth();
  const [account, setAccount] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.trim());
  const isPhone = /^1[3-9]\d{9}$/.test(account.trim());

  const requestCode = async () => {
    setError("");
    setInfo("");
    const acc = account.trim();
    if (!acc) return setError("请输入注册时填写的邮箱或手机号");
    if (!isEmail && !isPhone) return setError("请输入正确的邮箱或 11 位手机号");
    setBusy(true);
    try {
      const res = await apiForgot(acc);
      if (!res.exists) {
        setError("该邮箱/手机号未注册，请确认后重试");
        return;
      }
      if (res.code) {
        // 验证码直接展示并自动填入（平台未接入短信/邮件服务）
        setCode(res.code);
        setInfo("验证码已生成并自动填入，点击「重置密码」继续（10 分钟内有效）");
      } else {
        setInfo(res.hint ?? "验证码已生成，请进入下一步");
      }
      setStep(2);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "获取验证码失败，请稍后重试",
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) return setError("新密码至少 6 位");
    if (newPassword !== confirm) return setError("两次输入的密码不一致");
    if (code.trim().length !== 6) return setError("请输入 6 位验证码");
    setBusy(true);
    try {
      const res = await apiResetPassword(account.trim(), code.trim(), newPassword);
      if (!res.ok) {
        setError(res.message ?? "重置失败，请稍后重试");
        return;
      }
      setInfo("密码重置成功，正在自动登录…");
      if (res.username) {
        // login 内部会合并云端进度并跳转回首页
        await login(res.username, newPassword);
      }
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "重置失败，请稍后重试",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-10">
      <ExplodeIn initialScale={0.75}>
        <div className="w-full rounded-3xl border g-border g-panel p-8 backdrop-blur-xl">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
              <KeyRound className="h-7 w-7 text-primary" />
            </div>
            <h1 className="mt-3 text-xl font-bold text-foreground">找回密码</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              输入注册时填写的邮箱或手机号，验证后即可重设密码
            </p>
          </div>

          {step === 1 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                requestCode();
              }}
              className="mt-6 space-y-3 text-left"
            >
              <label className="flex items-center gap-2 rounded-lg g-panel px-4 py-3 ring-1 g-ring focus-within:ring-primary">
                {isPhone ? <Smartphone className="h-4 w-4 text-muted-foreground" /> : <Mail className="h-4 w-4 text-muted-foreground" />}
                <input
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="注册时填写的邮箱或手机号"
                  autoComplete="email"
                  className="w-full border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
              {error && <p className="text-sm text-red-400">{error}</p>}
              {info && <p className="text-sm text-emerald-400">{info}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
              >
                {busy ? "处理中…" : "获取验证码"}
              </button>
            </form>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-3 text-left">
              {info && <p className="text-sm text-emerald-400">{info}</p>}

              <label className="flex items-center gap-2 rounded-lg g-panel px-4 py-3 ring-1 g-ring focus-within:ring-primary">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6 位验证码"
                  inputMode="numeric"
                  className="w-full border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
              <label className="flex items-center gap-2 rounded-lg g-panel px-4 py-3 ring-1 g-ring focus-within:ring-primary">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="新密码（至少 6 位）"
                  autoComplete="new-password"
                  className="w-full border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
              <label className="flex items-center gap-2 rounded-lg g-panel px-4 py-3 ring-1 g-ring focus-within:ring-primary">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="确认新密码"
                  autoComplete="new-password"
                  className="w-full border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className={cn(
                  "w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-60",
                )}
              >
                {busy ? "处理中…" : "重置密码"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setCode("");
                  setNewPassword("");
                  setConfirm("");
                }}
                className="w-full text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-primary"
              >
                ‹ 更换邮箱/手机号
              </button>
            </form>
          )}

          <div className="mt-5 text-center">
            <Link to="/login" className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary">
              <ArrowLeft className="h-3.5 w-3.5" /> 返回登录
            </Link>
          </div>
        </div>
      </ExplodeIn>

      <FlyIn delay={0.12}>
        <p className="mt-4 px-6 text-center text-xs text-muted-foreground">
          平台未接入短信/邮件服务，验证码会直接显示在页面上；请妥善保管账号信息。
        </p>
      </FlyIn>
    </div>
  );
}
