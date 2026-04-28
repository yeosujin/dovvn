import { ArrowUpCircle, RefreshCw } from 'lucide-react'
import { useAppUpdateStore } from '../stores/appUpdateStore'

export function UpdatePill(): React.JSX.Element | null {
  const phase = useAppUpdateStore((s) => s.phase)
  const install = useAppUpdateStore((s) => s.install)

  if (phase === 'downloaded') {
    return (
      <button
        onClick={install}
        className="no-drag inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold text-white bg-gradient-to-r from-[#8b7cf4] to-[#6b5bd9] shadow-[0_4px_12px_-4px_rgba(124,106,232,0.6)] hover:translate-y-px hover:brightness-95 hover:shadow-[0_1px_4px_-2px_rgba(124,106,232,0.6)] active:translate-y-px active:brightness-90 transition-[transform,filter,box-shadow] duration-100"
      >
        <ArrowUpCircle size={12} />
        업데이트 설치
      </button>
    )
  }

  if (phase === 'checking' || phase === 'available' || phase === 'downloading') {
    return (
      <div className="no-drag inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-medium text-[color:var(--color-ghost-muted)] bg-[color:var(--color-ghost-accent-soft)]/40 border border-[color:var(--color-ghost-border)]">
        <RefreshCw size={11} className="animate-spin" />
        버전 확인 중…
      </div>
    )
  }

  return null
}
