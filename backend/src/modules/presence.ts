import { Server, Socket } from 'socket.io'
import { getUserByToken } from './auth'

/**
 * 统一在线状态（presence）——全局唯一来源
 * - Map<username, Set<socketId>>：同一用户的多个端（chat/pk/dm/study）都算在线
 * - 仅当该用户所有 socket 全部断开，才视为离线
 * - 连接/断开导致「在线↔离线」状态翻转时，向全站广播：
 *     presence:list  —— 当前在线用户名数组
 *     presence:count —— 当前在线人数
 *   新连接建立时也会收到一份当前快照，避免初始为 0。
 */

const presence = new Map<string, Set<string>>()
let ioRef: Server | null = null

function snapshot(): { list: string[]; count: number } {
  const list = Array.from(presence.keys())
  return { list, count: list.length }
}

function broadcast(): void {
  if (!ioRef) return
  const { list, count } = snapshot()
  ioRef.emit('presence:list', list)
  ioRef.emit('presence:count', count)
}

export function registerPresence(io: Server): void {
  ioRef = io
  io.on('connection', async (socket: Socket) => {
    const token = (socket.handshake.auth && (socket.handshake.auth as Record<string, unknown>).token) as string | undefined
    const user = token ? await getUserByToken(token) : null
    if (!user) return
    const username = user.username
    socket.data.username = username

    let set = presence.get(username)
    if (!set) {
      set = new Set<string>()
      presence.set(username, set)
    }
    const wasOffline = set.size === 0
    set.add(socket.id)

    // 给新连接发送当前快照（无论是否刚上线）
    const { list, count } = snapshot()
    socket.emit('presence:list', list)
    socket.emit('presence:count', count)

    // 仅「离线→在线」翻转时才全站广播，减少噪音
    if (wasOffline) broadcast()

    socket.on('disconnect', () => {
      const s = presence.get(username)
      if (!s) return
      s.delete(socket.id)
      if (s.size === 0) {
        presence.delete(username)
        broadcast() // 仅「在线→离线」翻转时才全站广播
      }
    })
  })
}

export function isOnline(username: string): boolean {
  const s = presence.get(username)
  return !!s && s.size > 0
}

export function getOnlineUsers(): string[] {
  return Array.from(presence.keys())
}

export function onlineCount(): number {
  return presence.size
}
