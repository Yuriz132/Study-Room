import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, Upload, Trash2, AlertCircle, AlertTriangle, Pencil } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiDeleteAccount } from "@/lib/authApi";
import { compressAvatar } from "@/context/SettingsContext";
import { cn } from "@/lib/utils";
import { FlyIn } from "@/components/MotionPrimitives";
import TopBar from "@/components/TopBar";

export default function Account() {
  const { user, isAuthed, logout, avatar, avatarBanned, signature, updateSignature, setUserAvatar, removeUserAvatar } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const hasCloud = !!token;
  const [sigEditing, setSigEditing] = useState(false);
  const [sigDraft, setSigDraft] = useState("");
  const [sigSaving, setSigSaving] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState("");
  const [delErr, setDelErr] = useState("");
  const [delBusy, setDelBusy] = useState(false);

  const handleDelete = async () => {
    if (!delPw) { setDelErr("请输入密码"); return; }
    try {
      setDelBusy(true);
      setDelErr("");
      await apiDeleteAccount(delPw);
      logout();
      navigate("/");
    } catch (e: any) {
      setDelErr(e?.response?.data?.message || "注销失败，请重试");
    } finally {
      setDelBusy(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { alert("头像文件不能超过 5MB"); return; }
    try {
      setSaving(true);
      const dataUri = await compressAvatar(f);
      await setUserAvatar(dataUri);
    } catch { alert("头像上传失败，请换一张图片试试"); }
    finally { setSaving(false); e.target.value = ""; }
  };

  const handleRemove = async () => {
    try { setSaving(true); await removeUserAvatar(); }
    catch { alert("移除头像失败"); }
    finally { setSaving(false); }
  };

  const saveSig = async () => {
    try {
      setSigSaving(true);
      await updateSignature(sigDraft);
      setSigEditing(false);
    } catch { alert("保存失败，请重试"); }
    finally { setSigSaving(false); }
  };

  if (!isAuthed) {
    return (
      <div className="hv-fade space-y-4">
        <TopBar title="我的" />
        <div className="rounded-2xl border g-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">你还没有登录</p>
          <button
            onClick={() => navigate("/login")}
            className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition active:scale-95"
          >
            去登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hv-fade space-y-4">
      <TopBar title="我的" />

      <FlyIn>
        <div className="rounded-2xl border g-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 group">
              {avatar && !avatarBanned ? (
                <img src={avatar} className="h-full w-full object-cover" alt="头像" />
              ) : (
                <User className="h-7 w-7 text-primary" />
              )}
              {hasCloud && !avatarBanned && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                    disabled={saving}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={saving}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="上传头像"
                  >
                    <Upload className="h-5 w-5 text-white" />
                  </button>
                </>
              )}
              {saving && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground truncate">{user}</h2>
                <span className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs",
                  hasCloud ? "bg-emerald-500/10 text-emerald-500" : "g-panel text-muted-foreground"
                )}>
                  {hasCloud ? "云端同步" : "本地模式"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {avatarBanned
                  ? "你的头像已被管理员封禁"
                  : hasCloud
                    ? avatar ? "点击头像可更换" : "点击头像上传自定义头像"
                    : "登录云端账号后可自定义头像"}
              </p>
            </div>
          </div>
          {avatarBanned && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
              <AlertCircle className="h-3.5 w-3.5" /> 你的头像已被管理员封禁，暂时无法修改
            </div>
          )}
          {hasCloud && !avatarBanned && avatar && (
            <button onClick={handleRemove} disabled={saving}
              className="mt-2 flex items-center gap-1 text-xs text-muted-foreground transition hover:text-destructive">
              <Trash2 className="h-3 w-3" /> 移除头像
            </button>
          )}
        </div>

        {/* 个性签名 */}
        <div className="rounded-2xl border g-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">个性签名</h3>
            <button
              onClick={() => { setSigDraft(signature ?? ""); setSigEditing(true); }}
              className="inline-flex items-center gap-1 rounded-lg g-panel px-2.5 py-1.5 text-xs text-foreground transition hover:bg-muted/40"
            >
              <Pencil className="h-3.5 w-3.5" /> 编辑
            </button>
          </div>
          <p className="mt-2 break-words text-sm leading-relaxed text-foreground/80">
            {signature ? (
              signature
            ) : (
              <span className="text-muted-foreground/60">还没有签名，点「编辑」写一句话介绍自己（≤80 字）</span>
            )}
          </p>
        </div>

        {/* 退出登录 */}
        <button
          onClick={() => { logout(); navigate("/"); }}
          className="flex w-full items-center justify-center gap-2 rounded-full border g-border g-panel py-3 text-sm text-destructive transition hover:-translate-y-0.5 active:scale-95"
        >
          <LogOut className="h-4 w-4" /> 退出登录
        </button>

        {hasCloud && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-rose-500">
              <AlertTriangle className="h-4 w-4" /> 危险操作
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              注销账号将永久删除你的云端资料、好友关系与私信记录，且无法恢复。
            </p>
            <button
              onClick={() => { setDelPw(""); setDelErr(""); setDelOpen(true); }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 py-2.5 text-sm font-medium text-white transition active:scale-95"
            >
              <Trash2 className="h-4 w-4" /> 注销账号
            </button>
          </div>
        )}

        {/* 编辑签名弹窗 */}
        {sigEditing && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4" onClick={() => setSigEditing(false)}>
            <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-3 text-base font-semibold text-foreground">编辑个性签名</h3>
              <textarea
                value={sigDraft}
                maxLength={80}
                onChange={(e) => setSigDraft(e.target.value)}
                rows={3}
                placeholder="一句话介绍自己（≤80 字）"
                className="w-full resize-none rounded-xl g-border bg-transparent p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="mt-1 text-right text-[11px] text-muted-foreground/60">{sigDraft.length}/80</div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setSigEditing(false)} className="flex-1 rounded-xl g-border g-panel py-2.5 text-sm text-muted-foreground">取消</button>
                <button onClick={saveSig} disabled={sigSaving} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
                  {sigSaving ? "保存中…" : "保存"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* 注销账号密码确认 */}
        {delOpen && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4" onClick={() => setDelOpen(false)}>
            <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-2 text-base font-semibold text-foreground">确认注销账号</h3>
              <p className="text-sm text-muted-foreground">请输入登录密码以确认注销，此操作不可恢复。</p>
              <input
                type="password"
                value={delPw}
                onChange={(e) => setDelPw(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !delBusy) handleDelete(); }}
                placeholder="登录密码"
                autoFocus
                className="mt-3 w-full rounded-xl g-border bg-transparent px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-rose-500/40"
              />
              {delErr && <p className="mt-2 text-xs text-rose-500">{delErr}</p>}
              <div className="mt-4 flex gap-2">
                <button onClick={() => setDelOpen(false)} className="flex-1 rounded-xl g-border g-panel py-2.5 text-sm text-muted-foreground">取消</button>
                <button onClick={handleDelete} disabled={delBusy} className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                  {delBusy ? "注销中…" : "确认注销"}
                </button>
              </div>
            </div>
          </div>
        )}

      </FlyIn>
    </div>
  );
}
