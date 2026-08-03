import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Lock } from "lucide-react"

/**
 * 未登录时包裹的内容不可访问，改为显示「请先登录」提示 + 去登录按钮。
 * 已登录则直接渲染 children。
 */
export function RequireLogin({ children, feature }: { children: ReactNode; feature?: string }) {
  const { isAuthed } = useAuth()
  const navigate = useNavigate()

  if (isAuthed) return <>{children}</>

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border g-border g-panel p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Lock className="h-6 w-6" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-foreground">请先登录</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {feature ? `登录后即可使用${feature}` : "登录后即可使用该功能"}
      </p>
      <button
        type="button"
        onClick={() => navigate("/login")}
        className="mt-4 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition active:scale-95 hover:bg-primary/90"
      >
        去登录
      </button>
    </div>
  )
}
