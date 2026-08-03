import { io, type Socket } from 'socket.io-client'

// 全局唯一的 PK Socket 连接：Battle 页与全局邀请弹窗共用，
// 避免出现多端重复连接、或切页后收不到 pk:inviteReceived 的问题。
let shared: Socket | null = null
let sharedToken: string | null = null

type Handler = (payload: any) => void
const bus = new Map<string, Set<Handler>>()

/** 订阅某个 PK 事件，返回取消订阅函数（可安全重复调用，不累积监听器） */
export function onPk(event: string, handler: Handler): () => void {
  if (!bus.has(event)) bus.set(event, new Set())
  bus.get(event)!.add(handler)
  return () => {
    bus.get(event)?.delete(handler)
  }
}

const PK_EVENTS = [
  'pk:matched', 'pk:round', 'pk:roundEnd', 'pk:result',
  'pk:queued', 'pk:timeout', 'pk:opponentLeft', 'pk:error', 'pk:cancelled',
  'pk:inviteReceived', 'pk:inviteFailed', 'pk:inviteDeclined',
]

function ensureForwarders(sock: Socket) {
  for (const ev of PK_EVENTS) {
    sock.on(ev, (payload: any) => {
      const set = bus.get(ev)
      if (set) set.forEach((h) => h(payload))
    })
  }
}

export function getPkSocket(token: string | null): Socket | null {
  if (!token) return null
  if (shared && sharedToken === token && shared.connected) return shared
  if (shared) {
    try { shared.disconnect() } catch { /* noop */ }
    shared = null
  }
  const socketPath = window.location.pathname.startsWith('/vs') ? '/vs/socket.io' : '/socket.io'
  shared = io({ path: socketPath, auth: { token }, transports: ['websocket', 'polling'] })
  sharedToken = token
  ensureForwarders(shared)
  return shared
}

export function closePkSocket() {
  if (shared) {
    try { shared.disconnect() } catch { /* noop */ }
    shared = null
    sharedToken = null
  }
}

/** 通过共享 socket 发送事件 */
export function emitPk(event: string, data?: unknown) {
  shared?.emit(event, data)
}
