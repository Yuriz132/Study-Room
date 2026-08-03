import { promises as fs } from 'fs'
import path from 'path'

// ============================================
// 私信（1v1 DM）存储模块
// 存储：backend/data/dm.json
// 结构：{ [convKey]: DmMessage[] }，convKey = [a,b].sort().join('__')
// ============================================

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')
const DM_FILE = path.join(DATA_DIR, 'dm.json')

export interface DmMessage {
  id: string
  conv: string
  from: string
  to: string
  text: string
  type: 'message' | 'system'
  timestamp: number
  read: boolean
}

type DmStore = Record<string, DmMessage[]>

const MAX_PER_CONV = 200
let dmCache: DmStore | null = null

export function convKey(a: string, b: string): string {
  return [a, b].sort().join('__')
}

export async function loadDm(): Promise<DmStore> {
  if (dmCache) return dmCache
  try {
    const raw = await fs.readFile(DM_FILE, 'utf-8')
    dmCache = JSON.parse(raw) as DmStore
  } catch {
    dmCache = {}
  }
  return dmCache
}

async function saveDm(d: DmStore): Promise<void> {
  dmCache = d
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(DM_FILE, JSON.stringify(d, null, 2), 'utf-8')
}

export async function appendDm(msg: DmMessage): Promise<void> {
  const s = await loadDm()
  if (!s[msg.conv]) s[msg.conv] = []
  s[msg.conv].push(msg)
  if (s[msg.conv].length > MAX_PER_CONV) s[msg.conv] = s[msg.conv].slice(-MAX_PER_CONV)
  await saveDm(s)
}

export async function markRead(me: string, friend: string): Promise<void> {
  const conv = convKey(me, friend)
  const s = await loadDm()
  const msgs = s[conv]
  if (!msgs) return
  let changed = false
  for (const m of msgs) {
    if (m.to === me && !m.read) {
      m.read = true
      changed = true
    }
  }
  if (changed) await saveDm(s)
}

export async function computeUnread(me: string): Promise<{ total: number; byFriend: Record<string, number> }> {
  const s = await loadDm()
  const byFriend: Record<string, number> = {}
  let total = 0
  for (const conv in s) {
    for (const m of s[conv]) {
      if (m.to === me && !m.read) {
        total++
        byFriend[m.from] = (byFriend[m.from] || 0) + 1
      }
    }
  }
  return { total, byFriend }
}
