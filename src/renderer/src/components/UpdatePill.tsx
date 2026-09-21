import { RefreshCw } from 'lucide-react'
import { useAppUpdateStore } from '../stores/appUpdateStore'

export function UpdatePill(): React.JSX.Element | null {
  const phase = useAppUpdateStore((s) => s.phase)

  if (
    phase === 'checking' ||
    phase === 'available' ||
    phase === 'downloading' ||
    phase === 'downloaded'
  ) {
    return (
      <div className="no-drag inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-medium text-[color:var(--color-ghost-muted)] bg-[color:var(--color-ghost-accent-soft)]/40 border border-[color:var(--color-ghost-border)]">
        <RefreshCw size={11} className="animate-spin" />
        {phase === 'downloaded' ? '재시작 대기 중…' : '버전 확인 중…'}
      </div>
    )
  }

  return null
}
