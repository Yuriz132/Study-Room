import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, Upload, Trash2, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { compressAvatar } from "@/context/SettingsContext";
import { cn } from "@/lib/utils";
import { FlyIn } from "@/components/MotionPrimitives";
import TopBar from "@/components/TopBar";

export default function Account() {
  const { user, isAuthed, logout, avatar, avatarBanned, setUserAvatar, removeUserAvatar } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const hasCloud = !!token;

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

        {/* 退出登录 */}
        <button
          onClick={() => { logout(); navigate("/"); }}
          className="flex w-full items-center justify-center gap-2 rounded-full border g-border g-panel py-3 text-sm text-destructive transition hover:-translate-y-0.5 active:scale-95"
        >
          <LogOut className="h-4 w-4" /> 退出登录
        </button>
      </FlyIn>
    </div>
  );
}
