import { ArrowUpCircle, RefreshCw } from 'lucide-react'
import { useAppUpdateStore } from '../stores/appUpdateStore'
import { useDownloadStore } from '../stores/downloadStore'
import { useRestartStore } from '../stores/restartStore'

export function UpdatePill(): React.JSX.Element | null {
  const phase = useAppUpdateStore((s) => s.phase)
  const restartPending = useRestartStore((s) => s.pending)
  const forcing = useRestartStore((s) => s.forcing)
  const forceRestart = useRestartStore((s) => s.forceRestart)
  const activeDownloads = useDownloadStore(
    (s) => s.items.filter((it) => it.status === 'queued' || it.status === 'downloading').length
  )

  if (restartPending) {
    const label = forcing
      ? '재시작 중…'
      : activeDownloads > 0
        ? `지금 재시작 (다운로드 ${activeDownloads}개 중단)`
        : '지금 재시작'
    return (
      <button
        onClick={forceRestart}
        disabled={forcing}
        title={
          activeDownloads > 0 ? `진행 중인 다운로드 ${activeDownloads}개가 중단돼요` : undefined
        }
        className="no-drag inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold text-white bg-gradient-to-r from-[#8b7cf4] to-[#6b5bd9] shadow-[0_4px_12px_-4px_rgba(124,106,232,0.6)] hover:translate-y-px hover:brightness-95 hover:shadow-[0_1px_4px_-2px_rgba(124,106,232,0.6)] active:translate-y-px active:brightness-90 disabled:opacity-70 disabled:pointer-events-none transition-[transform,filter,box-shadow] duration-100"
      >
        <ArrowUpCircle size={12} className={forcing ? 'animate-spin' : ''} />
        {label}
      </button>
    )
  }

  if (
    phase === 'checking' ||
    phase === 'available' ||
    phase === 'downloading' ||
    phase === 'downloaded'
  ) {
    return (
      <div className="no-drag inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-medium text-[color:var(--color-ghost-muted)] bg-[color:var(--color-ghost-accent-soft)]/40 border border-[color:var(--color-ghost-border)]">
        <RefreshCw size={11} className="animate-spin" />
        버전 확인 중…
      </div>
    )
  }

  return null
}
