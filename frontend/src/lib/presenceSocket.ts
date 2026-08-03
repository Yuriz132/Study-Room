import { io, type Socket } from 'socket.io-client'

// 全局唯一的「在线状态」Socket 连接：好友列表与社区页共用，
// 实时接收 presence:list / presence:count。即使未登录也建立连接（仅接收广播，不计入在线）。
let shared: Socket | null = null
let sharedToken: string | null = null

export function getPresenceSocket(token: string | null): Socket {
  const socketPath = window.location.pathname.startsWith('/vs') ? '/vs/socket.io' : '/socket.io'
  if (shared && sharedToken === token && shared.connected) return shared
  if (shared) {
    try { shared.disconnect() } catch { /* noop */ }
    shared = null
  }
  shared = io({
    path: socketPath,
    auth: token ? { token } : {},
    transports: ['websocket', 'polling'],
  })
  sharedToken = token
  return shared
}
