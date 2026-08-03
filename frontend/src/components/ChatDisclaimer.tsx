import { useState } from 'react'

export function ChatDisclaimer() {
  const [expanded, setExpanded] = useState(false)
  const text =
    '此网页的账号均为虚拟账号，请注意对方的实名，保管好自己的信息与财产安全，不要相信任何陌生人，若发生事故后果由本人全部承担。'
  return (
    <div className="sticky top-0 z-20 mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300/90">
      <div className="flex items-start gap-1">
        <span className="shrink-0 font-semibold">⚠️ 安全提示：</span>
        <span className={expanded ? '' : 'line-clamp-1'}>{text}</span>
      </div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-300/80 underline underline-offset-2"
      >
        {expanded ? '收起' : '更多'}
      </button>
    </div>
  )
}
