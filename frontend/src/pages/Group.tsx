import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Users, Megaphone, CalendarCheck, BookOpen, Crown, Shield, UserMinus,
  UserPlus, Send, Trash2, AlertTriangle, Settings, GraduationCap,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useGroupChat } from '@/hooks/use-group-chat'
import { cn } from '@/lib/utils'
import {
  apiGetGroup, apiJoinGroup, apiApproveMember, apiRejectMember, apiSetAnnouncement,
  apiCheckin, apiGetAttendance, apiSetCheckinRule, apiPublishTask, apiAppeal, apiUnban,
  apiRemoveMember, apiSetRole, getErrorMessage,
  type GroupDetail, type GroupMemberView, type AttendanceView, type CheckinRule,
} from '@/lib/group'
import { partStructure } from '@/lib/words-data'

// List N → (part, list) 映射（词库恰好为 List 1..71）
const LIST_PART: Record<number, string> = (() => {
  const map: Record<number, string> = {}
  for (const part of partStructure) {
    for (const list of part.lists) {
      const m = /^List\s+(\d+)$/.exec(list.name)
      if (m) {
        const n = Number(m[1])
        if (!(n in map)) map[n] = part.name
      }
    }
  }
  return map
})()

function listStudyPath(n: number): string | null {
  const part = LIST_PART[n]
  if (!part) return null
  return `/browse/${encodeURIComponent(part)}/${encodeURIComponent('List ' + n)}`
}

function fmtMin(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

function LetterAvatar({ name, size = 36, onClick }: { name: string; size?: number; onClick?: () => void }) {
  return (
    <span
      className={'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary' + (onClick ? ' cursor-pointer' : '')}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      onClick={onClick}
    >
      {name ? name[0] : '?'}
    </span>
  )
}

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export default function GroupPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAuthed } = useAuth()
  const { messages, joined, error, announcement, send, deleteMessage } = useGroupChat(id)

  const [detail, setDetail] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [tab, setTab] = useState<'chat' | 'checkin' | 'task' | 'manage'>('chat')

  // 入群表单
  const [note, setNote] = useState('')
  const [joinState, setJoinState] = useState<'idle' | 'pending' | 'done' | 'banned'>('idle')
  const [appealText, setAppealText] = useState('')

  // 管理面板
  const [showManage, setShowManage] = useState(false)
  const [attend, setAttend] = useState<AttendanceView | null>(null)
  const [annText, setAnnText] = useState('')
  const [taskText, setTaskText] = useState('')
  const [rule, setRule] = useState<CheckinRule | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const d = await apiGetGroup(id)
      setDetail(d)
      setAnnText(d.announcement?.text || '')
      setRule(d.checkin)
      setJoinState(
        d.myStatus === 'approved' ? 'done' : d.myStatus === 'pending' ? 'pending' : d.myStatus === 'banned' ? 'banned' : 'idle'
      )
    } catch (e) {
      setErr(getErrorMessage(e))
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    if (isAuthed) load()
    else {
      setLoading(false)
      setErr('请先登录后查看群聊')
    }
  }, [isAuthed, load])

  // 进入聊天后刷新未读
  useEffect(() => {
    if (joined) {
      const t = setTimeout(load, 400)
      return () => clearTimeout(t)
    }
  }, [joined, load])

  const act = async (fn: () => Promise<unknown>, key: string, after?: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
      if (after) await after()
      else await load()
    } catch (e) {
      setErr(getErrorMessage(e))
    }
    setBusy('')
  }

  const isManager = detail?.canManage || false

  const showManagePanel = useMemo(() => isManager && showManage, [isManager, showManage])

  const loadAttend = useCallback(async () => {
    if (!id) return
    try {
      const a = await apiGetAttendance(id)
      setAttend(a)
      setRule(a.checkin)
    } catch (e) {
      setErr(getErrorMessage(e))
    }
  }, [id])

  useEffect(() => {
    if (showManagePanel) loadAttend()
  }, [showManagePanel, loadAttend])

  // ---------- 渲染 ----------
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-20 text-center text-muted-foreground">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (err && !detail) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-10">
        <div className="liquid-glass rounded-3xl p-8 text-center">
          <p className="text-sm text-destructive">{err}</p>
          <button onClick={() => navigate(-1)} className="mt-4 rounded-xl bg-primary px-5 py-2 text-sm text-primary-foreground">返回</button>
        </div>
      </div>
    )
  }

  if (!detail) return null

  // ===== 非成员：入群申请 =====
  if (joinState !== 'done') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-6">
        <header className="mb-3 flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="rounded-full g-border g-panel p-2"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="text-lg font-bold">{detail.name}</h1>
        </header>
        <div className="liquid-glass rounded-3xl p-6">
          {detail.description && <p className="mb-4 text-sm text-muted-foreground">{detail.description}</p>}
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-4 w-4" /> {detail.memberCount} 名成员
            {detail.isPublic && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">公开群</span>}
          </div>

          {joinState === 'banned' && (
            <div className="mb-4 rounded-2xl border border-rose-300/40 bg-rose-500/10 p-4">
              <p className="text-sm font-medium text-rose-600">你已被移出该群</p>
              {detail.myAppeal ? (
                <p className="mt-1 text-xs text-muted-foreground">已提交申诉：{detail.myAppeal}（等待管理员处理）</p>
              ) : (
                <div className="mt-3">
                  <textarea
                    value={appealText}
                    onChange={(e) => setAppealText(e.target.value)}
                    placeholder="说明情况，提交申诉（管理员可撤销拉黑）"
                    className="w-full rounded-xl g-border bg-transparent p-3 text-sm outline-none"
                    rows={3}
                  />
                  <button
                    disabled={busy === 'appeal' || !appealText.trim()}
                    onClick={() => act(() => apiAppeal(detail.id, appealText.trim()), 'appeal')}
                    className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
                  >
                    提交申诉
                  </button>
                </div>
              )}
            </div>
          )}

          {joinState === 'pending' && (
            <div className="rounded-2xl bg-primary/10 p-4 text-center text-sm text-primary">入群申请已提交，等待管理员审核 🕒</div>
          )}

          {joinState === 'idle' && (
            <div>
              {detail.isPublic && (
                <div className="mb-3">
                  <label className="mb-1 block text-xs text-muted-foreground">真实姓名（入群备注，管理员审核用）</label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="请输入真实姓名"
                    className="w-full rounded-xl g-border bg-transparent px-3 py-2.5 text-sm outline-none"
                  />
                </div>
              )}
              <button
                disabled={busy === 'join' || (detail.isPublic && note.trim().length < 2)}
                onClick={() => act(() => apiJoinGroup(detail.id, detail.isPublic ? note.trim() : undefined), 'join', async () => { setJoinState('pending') })}
                className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {detail.isPublic ? '提交入群申请' : '申请加入群聊'}
              </button>
            </div>
          )}

          {detail.isPublic && joinState === 'idle' && (
            <p className="mt-3 text-center text-xs text-muted-foreground/70">公开群入群须填写真实姓名，审核通过后正式成为成员</p>
          )}
        </div>
      </div>
    )
  }

  // ===== 成员视图 =====
  const me = user || ''

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-2 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded-full g-border g-panel p-2"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">{detail.name}</h1>
          <p className="text-xs text-muted-foreground">{detail.memberCount} 名成员{detail.isPublic ? ' · 公开群' : ''}</p>
        </div>
        {isManager && (
          <button onClick={() => setShowManage((v) => !v)} className="rounded-full g-border g-panel p-2" title="管理">
            <Settings className="h-5 w-5" />
          </button>
        )}
      </header>

      {(() => {
        const ann = announcement ?? detail.announcement
        return ann ? (
          <div className="mb-2 flex items-start gap-2 rounded-2xl bg-primary/10 p-3 text-sm text-foreground">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="whitespace-pre-line">{ann.text}</span>
          </div>
        ) : null
      })()}

      {/* 标签栏 */}
      <div className="mb-3 flex gap-1 rounded-full g-border g-panel p-1 text-sm">
        {(['chat', 'checkin', 'task'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('flex-1 rounded-full py-1.5', tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
          >
            {t === 'chat' ? '聊天' : t === 'checkin' ? '考勤' : '早读'}
          </button>
        ))}
        {isManager && (
          <button onClick={() => { setTab('manage'); setShowManage(true) }} className={cn('flex-1 rounded-full py-1.5', tab === 'manage' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
            管理
          </button>
        )}
      </div>

      {err && <p className="mb-2 px-1 text-xs text-destructive">{err}</p>}

      {/* ===== 聊天 ===== */}
      {tab === 'chat' && (
        <div>
          {error && <p className="mb-2 px-1 text-xs text-destructive">{error}</p>}
          <div className="space-y-2">
            {messages.map((m) => {
              const mine = m.username === me
              if (m.type === 'system') {
                return (
                  <div key={m.id} className="mx-auto max-w-[90%] rounded-2xl bg-muted/50 px-3 py-1.5 text-center text-xs text-muted-foreground">
                    {m.text}
                  </div>
                )
              }
              return (
                <div key={m.id} className={cn('group flex items-end gap-2', mine && 'flex-row-reverse')}>
                  <LetterAvatar name={m.username} size={30} onClick={() => navigate('/user/' + encodeURIComponent(m.username))} />
                  <div className={cn('relative max-w-[75%] rounded-2xl px-3 py-2 text-sm', mine ? 'bg-primary text-primary-foreground' : 'g-border g-panel')}>
                    {!mine && <div className="mb-0.5 text-[11px] text-muted-foreground">{m.username}</div>}
                    <span className="whitespace-pre-line">{m.text}</span>
                    {isManager && (
                      <button
                        onClick={() => deleteMessage(m.id)}
                        className="absolute -top-2 -right-2 hidden rounded-full bg-rose-500 p-1 text-white group-hover:block"
                        title="删除"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {messages.length === 0 && <p className="py-10 text-center text-xs text-muted-foreground">还没有消息，来打个招呼吧～</p>}
          </div>

          <div className="fixed bottom-20 left-1/2 z-30 w-full max-w-2xl -translate-x-1/2 px-4">
            <div className="flex gap-2">
              <input
                id="group-input"
                placeholder="说点什么…"
                className="flex-1 rounded-full g-border g-panel px-4 py-2.5 text-sm outline-none"
                onKeyDown={(e) => { if (e.key === 'Enter') { send((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = '' } }}
              />
              <button
                onClick={() => { const el = document.getElementById('group-input') as HTMLInputElement; if (el) { send(el.value); el.value = '' } }}
                className="rounded-full bg-primary p-3 text-primary-foreground"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 考勤 ===== */}
      {tab === 'checkin' && (
        <div className="space-y-3">
          <div className="liquid-glass rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">今日打卡</span>
              <span className="text-xs text-muted-foreground">
                {detail.checkin.weekdays.map((w) => WEEK_LABELS[w]).join('、')} · {fmtMin(detail.checkin.startMin)}–{fmtMin(detail.checkin.endMin)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={cn('text-sm', detail.todayInfo.checkedIn ? 'text-emerald-600' : detail.todayInfo.isCheckinDay ? 'text-amber-600' : 'text-muted-foreground')}>
                {detail.todayInfo.checkedIn ? '✅ 今日已打卡' : detail.todayInfo.isCheckinDay ? (detail.todayInfo.inWindow ? '打卡进行中…' : '未打卡（逾期=缺勤）') : '今天不是打卡日'}
              </span>
              <button
                disabled={busy === 'ck' || !detail.todayInfo.isCheckinDay || !detail.todayInfo.inWindow || detail.todayInfo.checkedIn}
                onClick={() => act(() => apiCheckin(detail.id), 'ck')}
                className="rounded-xl bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
              >
                打卡
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground/70">每周缺勤超过 {detail.checkin.absentThreshold} 次将被移出群聊</p>
          </div>
          {isManager && (
            <button onClick={() => { setShowManage(true); setTab('manage') }} className="w-full rounded-xl g-border g-panel py-2.5 text-sm text-muted-foreground">
              查看全员考勤 / 调整规则 →
            </button>
          )}
        </div>
      )}

      {/* ===== 早读任务 ===== */}
      {tab === 'task' && (
        <div className="space-y-3">
          <div className="liquid-glass rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <GraduationCap className="h-4 w-4 text-primary" />
              今日早读 · List {detail.taskListNumberToday}
            </div>
            {(() => {
              const path = listStudyPath(detail.taskListNumberToday)
              return path ? (
                <button onClick={() => navigate(path)} className="mt-2 inline-flex items-center gap-1 rounded-xl bg-primary/15 px-3 py-1.5 text-xs text-primary">
                  <BookOpen className="h-3.5 w-3.5" /> 去背 List {detail.taskListNumberToday}
                </button>
              ) : null
            })()}
            {isManager && (
              <button
                disabled={busy === 'task'}
                onClick={() => act(() => apiPublishTask(detail.id, taskText.trim() || undefined), 'task')}
                className="mt-3 w-full rounded-xl bg-primary py-2 text-sm text-primary-foreground disabled:opacity-60"
              >
                发布今日早读（List {detail.taskListNumberToday}）
              </button>
            )}
            {isManager && (
              <input
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                placeholder="补充任务说明（可选）"
                className="mt-2 w-full rounded-xl g-border bg-transparent px-3 py-2 text-sm outline-none"
              />
            )}
          </div>
          <div>
            <h3 className="mb-2 px-1 text-sm font-semibold">近期任务</h3>
            <div className="space-y-2">
              {detail.tasks.length === 0 && <p className="px-1 text-xs text-muted-foreground/70">暂无已发布任务</p>}
              {detail.tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-2xl g-border g-panel p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">L{t.listNumber}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">List {t.listNumber}{t.text ? ` · ${t.text}` : ''}</div>
                    <div className="text-xs text-muted-foreground">{t.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== 管理 ===== */}
      {tab === 'manage' && isManager && (
        <GroupManage
          detail={detail}
          attend={attend}
          rule={rule}
          setRule={setRule}
          annText={annText}
          setAnnText={setAnnText}
          busy={busy}
          act={act}
          reload={load}
          reloadAttend={loadAttend}
          onClose={() => setShowManage(false)}
        />
      )}
    </div>
  )
}

// ============================================================
// 管理面板（仅群管理员可见）
// ============================================================
function GroupManage({
  detail, attend, rule, setRule, annText, setAnnText, busy, act, reload, reloadAttend, onClose,
}: {
  detail: GroupDetail
  attend: AttendanceView | null
  rule: CheckinRule | null
  setRule: (r: CheckinRule) => void
  annText: string
  setAnnText: (s: string) => void
  busy: string
  act: (fn: () => Promise<unknown>, key: string, after?: () => Promise<void>) => void
  reload: () => Promise<void>
  reloadAttend: () => Promise<void>
  onClose: () => void
}) {
  const id = detail.id
  const weekToggles = (val: number[]) =>
    [0, 1, 2, 3, 4, 5, 6].map((w) => (
      <button
        key={w}
        onClick={() => {
          const has = val.includes(w)
          setRule({ ...rule!, weekdays: has ? val.filter((x) => x !== w) : [...val, w].sort((a, b) => a - b) })
        }}
        className={cn('h-9 w-9 rounded-full text-sm', val.includes(w) ? 'bg-primary text-primary-foreground' : 'g-border g-panel text-muted-foreground')}
      >
        {WEEK_LABELS[w]}
      </button>
    ))

  const pendingMembers = detail.members.filter((m) => m.status === 'pending')
  const normalMembers = detail.members.filter((m) => m.status === 'approved')

  return (
    <div className="space-y-4">
      {/* 群公告 */}
      <section className="liquid-glass rounded-2xl p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Megaphone className="h-4 w-4 text-primary" />群公告</h3>
        <textarea
          value={annText}
          onChange={(e) => setAnnText(e.target.value)}
          rows={2}
          className="w-full rounded-xl g-border bg-transparent p-3 text-sm outline-none"
          placeholder="设置全员可见的群公告"
        />
        <button
          disabled={busy === 'ann' || !annText.trim()}
          onClick={() => act(() => apiSetAnnouncement(id, annText.trim()), 'ann', reload)}
          className="mt-2 w-full rounded-xl bg-primary py-2 text-sm text-primary-foreground disabled:opacity-60"
        >
          保存公告
        </button>
      </section>

      {/* 待审核入群 */}
      {pendingMembers.length > 0 && (
        <section className="liquid-glass rounded-2xl p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><UserPlus className="h-4 w-4 text-primary" />待审核（{pendingMembers.length}）</h3>
          <div className="space-y-2">
            {pendingMembers.map((m) => (
              <div key={m.username} className="flex items-center gap-3 rounded-xl g-border g-panel p-2.5">
                <LetterAvatar name={m.username} size={30} />
                <div className="flex-1">
                  <div className="text-sm">{m.username}</div>
                  {m.realName && <div className="text-xs text-muted-foreground">真实姓名：{m.realName}</div>}
                </div>
                <button disabled={busy === 'acc'} onClick={() => act(() => apiApproveMember(id, m.username), 'acc', reload)} className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-60">通过</button>
                <button disabled={busy === 'rej'} onClick={() => act(() => apiRejectMember(id, m.username), 'rej', reload)} className="rounded-lg g-border g-panel px-3 py-1.5 text-xs disabled:opacity-60">拒绝</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 考勤规则 + 全员考勤 */}
      <section className="liquid-glass rounded-2xl p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><CalendarCheck className="h-4 w-4 text-primary" />打卡规则</h3>
        <div className="mb-2 flex flex-wrap gap-1.5">{rule && weekToggles(rule.weekdays)}</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">开始</span>
            <input type="number" min={0} max={1439} value={rule?.startMin ?? 380} onChange={(e) => setRule({ ...rule!, startMin: Number(e.target.value) })} className="w-20 rounded-lg g-border bg-transparent px-2 py-1" />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">结束</span>
            <input type="number" min={0} max={1439} value={rule?.endMin ?? 395} onChange={(e) => setRule({ ...rule!, endMin: Number(e.target.value) })} className="w-20 rounded-lg g-border bg-transparent px-2 py-1" />
          </label>
          <label className="col-span-2 flex items-center gap-2">
            <span className="text-muted-foreground">缺勤拉黑阈值</span>
            <input type="number" min={1} max={30} value={rule?.absentThreshold ?? 3} onChange={(e) => setRule({ ...rule!, absentThreshold: Number(e.target.value) })} className="w-20 rounded-lg g-border bg-transparent px-2 py-1" />
            <span className="text-xs text-muted-foreground">次（超过即拉黑）</span>
          </label>
        </div>
        <button
          disabled={busy === 'rule' || !rule}
          onClick={() => act(() => apiSetCheckinRule(id, rule!), 'rule', async () => { await reload(); await reloadAttend() })}
          className="mt-2 w-full rounded-xl bg-primary py-2 text-sm text-primary-foreground disabled:opacity-60"
        >
          保存规则
        </button>

        {attend && (
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">全员缺勤统计</h4>
            <div className="space-y-1.5">
              {attend.members.filter((m) => m.status === 'approved').map((m) => {
                const cnt = attend.absenceCount[m.username] || 0
                const atRisk = cnt >= (attend.checkin.absentThreshold - 1)
                return (
                  <div key={m.username} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{m.username}{m.role !== 'member' ? `（${m.role === 'owner' ? '群主' : '管理员'}）` : ''}</span>
                    <span className={cn('text-xs', cnt > attend.checkin.absentThreshold ? 'text-rose-500' : atRisk ? 'text-amber-500' : 'text-muted-foreground')}>
                      缺勤 {cnt}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* 申诉处理 */}
            {attend.appeals.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-rose-500"><AlertTriangle className="h-3.5 w-3.5" />申诉待处理（{attend.appeals.length}）</h4>
                <div className="space-y-2">
                  {attend.appeals.map((a) => (
                    <div key={a.username} className="rounded-xl border border-rose-300/40 bg-rose-500/5 p-2.5">
                      <div className="text-sm">{a.username}：<span className="text-muted-foreground">{a.appeal}</span></div>
                      <button disabled={busy === 'unban'} onClick={() => act(() => apiUnban(id, a.username), 'unban', reloadAttend)} className="mt-1.5 rounded-lg bg-emerald-500 px-3 py-1 text-xs text-white disabled:opacity-60">
                        撤销拉黑
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 成员管理 */}
      <section className="liquid-glass rounded-2xl p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Users className="h-4 w-4 text-primary" />成员（{normalMembers.length}）</h3>
        <div className="space-y-2">
          {normalMembers.map((m) => (
            <MemberRow key={m.username} m={m} id={id} busy={busy} act={act} reload={reload} />
          ))}
        </div>
        <button onClick={onClose} className="mt-3 w-full rounded-xl g-border g-panel py-2 text-sm text-muted-foreground">收起管理面板</button>
      </section>
    </div>
  )
}

function MemberRow({
  m, id, busy, act, reload,
}: {
  m: GroupMemberView
  id: string
  busy: string
  act: (fn: () => Promise<unknown>, key: string, after?: () => Promise<void>) => void
  reload: () => Promise<void>
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl g-border g-panel p-2.5">
      <LetterAvatar name={m.username} size={30} />
      <div className="flex-1">
        <div className="text-sm">{m.username}</div>
        <div className="text-xs text-muted-foreground">
          {m.role === 'owner' ? '群主' : m.role === 'admin' ? '管理员' : '成员'}
          {m.realName ? ` · ${m.realName}` : ''}
        </div>
      </div>
      {m.role !== 'owner' && (
        <div className="flex items-center gap-1.5">
          <button
            title={m.role === 'admin' ? '取消管理员' : '设为管理员'}
            disabled={busy === 'role'}
            onClick={() => act(() => apiSetRole(id, m.username, m.role === 'admin' ? 'member' : 'admin'), 'role', reload)}
            className="rounded-lg g-border g-panel p-1.5 text-muted-foreground disabled:opacity-60"
          >
            {m.role === 'admin' ? <Crown className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
          </button>
          <button
            title="移出群聊"
            disabled={busy === 'rm'}
            onClick={() => act(() => apiRemoveMember(id, m.username), 'rm', reload)}
            className="rounded-lg g-border g-panel p-1.5 text-destructive disabled:opacity-60"
          >
            <UserMinus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
