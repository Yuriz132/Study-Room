import { useNavigate, Link } from 'react-router-dom'
import { User } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export function AccountMenu() {
  const { user, isAuthed } = useAuth()
  const navigate = useNavigate()

  // 未登录：跳转到 /login
  if (!isAuthed) {
    return (
      <Link
        to="/login"
        onClick={(e) => {
          e.preventDefault()
          navigate('/login')
        }}
        className="relative z-10 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        aria-label="登录"
      >
        <User className="h-4 w-4" />
        <span className="hidden sm:inline">登录</span>
      </Link>
    )
  }

  // 已登录：点击个人图标直接进入 /account 账号管理页
  return (
    <Link
      to="/account"
      onClick={(e) => {
        e.preventDefault()
        navigate('/account')
      }}
      className="relative z-10 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm nav-item-active transition-colors"
      aria-label="账号管理"
    >
      <User className="h-4 w-4" />
      <span className="hidden max-w-[8rem] truncate sm:inline">{user}</span>
    </Link>
  )
}
