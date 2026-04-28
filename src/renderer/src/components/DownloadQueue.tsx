import { useState } from 'react'
import { CheckCircle2, ChevronDown, FolderOpen, RotateCw, Trash2, X } from 'lucide-react'
import { PlatformBadge } from './PlatformBadge'
import { Ghost } from './Ghost'
import { useDownloadStore } from '../stores/downloadStore'
import { useStartDownload } from '../hooks/useStartDownload'
import type { DownloadItem } from '../types'

function FailedLine({ error }: { error: string }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const multiline = error.includes('\n') || error.length > 160
  return (
    <div className="mt-1.5 text-xs text-rose-600">
      <div className={expanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'}>
        실패: {error}
      </div>
      {multiline && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-700 transition"
        >
          <ChevronDown
            size={11}
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
          {expanded ? '접기' : '자세히 보기'}
        </button>
      )}
    </div>
  )
}

function percentValue(p: string): number {
  const m = p.match(/([\d.]+)/)
  return m ? Math.min(100, Math.max(0, parseFloat(m[1]))) : 0
}

function StatusLine({ item }: { item: DownloadItem }): React.JSX.Element | null {
  switch (item.status) {
    case 'queued':
      return <div className="mt-1.5 text-xs text-[color:var(--color-ghost-muted)]">대기 중</div>
    case 'downloading': {
      const pct = percentValue(item.percent)
      // 아직 진행률이 안 들어왔을 땐 "준비 중..."으로 표시.
      // (yt-dlp가 포맷 선택, 자막 확인 등으로 몇 초 걸릴 수 있음)
      const preparing = pct < 0.1 && (!item.speed || item.speed === '-')
      if (preparing) {
        return (
          <div className="mt-2 flex items-center gap-2 text-xs text-[color:var(--color-ghost-accent-hover)]">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-[color:var(--color-ghost-accent-soft)] border-t-[color:var(--color-ghost-accent)] animate-spin" />
            <span className="font-medium">다운로드 준비 중...</span>
          </div>
        )
      }
      return (
        <>
          <div className="mt-2 h-2 bg-[color:var(--color-ghost-accent-soft)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #a594f7 0%, #7c6ae8 100%)'
              }}
            />
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-[color:var(--color-ghost-muted)] tabular-nums">
            <span className="font-semibold text-[color:var(--color-ghost-accent-hover)]">
              {item.percent.trim() || '0%'}
            </span>
            <span className="text-[color:var(--color-ghost-border)]">·</span>
            <span>{item.speed.trim() || '-'}</span>
            <span className="text-[color:var(--color-ghost-border)]">·</span>
            <span>ETA {item.eta.trim() || '-'}</span>
          </div>
        </>
      )
    }
    case 'completed':
      return (
        <div
          className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600 truncate"
          title={item.filePath ?? ''}
        >
          <CheckCircle2 size={12} className="shrink-0" />
          <span className="truncate">
            완료 {item.filePath ? `· ${item.filePath.split('/').pop()}` : ''}
          </span>
        </div>
      )
    case 'failed':
      return <FailedLine error={item.error ?? ''} />
    case 'cancelled':
      return <div className="mt-1.5 text-xs text-[color:var(--color-ghost-muted)]">취소됨</div>
    default:
      return null
  }
}

function QueueRow({ item }: { item: DownloadItem }): React.JSX.Element {
  const removeItem = useDownloadStore((s) => s.removeItem)
  const { retry } = useStartDownload()

  const cancel = (): void => {
    window.api.cancelDownload(item.id)
  }

  const showFolder = (): void => {
    if (item.filePath) window.api.showInFolder(item.filePath)
  }

  const active = item.status === 'downloading'

  return (
    <div
      className={`card p-3.5 lift ${
        active ? 'ring-1 ring-[color:var(--color-ghost-accent)]/25' : ''
      }`}
    >
      <div className="flex gap-3 items-start flex-wrap sm:flex-nowrap">
        <div className="pt-0.5">
          <PlatformBadge platform={item.platform} size="sm" />
        </div>
        <div className="flex-1 min-w-0 order-3 sm:order-none basis-full sm:basis-0">
          <div
            className="text-sm font-medium text-[color:var(--color-ghost-text)] truncate"
            title={item.title}
          >
            {item.title}
          </div>
          <StatusLine item={item} />
        </div>
        <div className="flex gap-1 shrink-0 ml-auto sm:ml-0">
          {(item.status === 'queued' || item.status === 'downloading') && (
            <button onClick={cancel} className="btn-soft text-xs px-2.5 py-1.5" title="취소">
              <X size={13} />
              취소
            </button>
          )}
          {item.status === 'completed' && item.filePath && (
            <button
              onClick={showFolder}
              className="btn-soft text-xs px-2.5 py-1.5"
              title="폴더 열기"
            >
              <FolderOpen size={13} />
              열기
            </button>
          )}
          {(item.status === 'failed' || item.status === 'cancelled') && (
            <button
              onClick={() => retry(item)}
              className="btn-primary text-xs px-3 py-1.5"
              style={{ borderRadius: '10px' }}
              title="재시도"
            >
              <RotateCw size={13} />
              재시도
            </button>
          )}
          {(item.status === 'completed' ||
            item.status === 'failed' ||
            item.status === 'cancelled') && (
            <button
              onClick={() => removeItem(item.id)}
              className="btn-icon"
              style={{ width: 32, height: 32 }}
              title="목록에서 제거"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function DownloadQueue(): React.JSX.Element {
  const items = useDownloadStore((s) => s.items)
  const clearFinished = useDownloadStore((s) => s.clearFinished)

  const hasFinished = items.some(
    (i) => i.status === 'completed' || i.status === 'failed' || i.status === 'cancelled'
  )

  if (items.length === 0) {
    return (
      <div className="card py-10 flex flex-col items-center text-center gap-3">
        <div className="opacity-80">
          <Ghost size={72} sleeping />
        </div>
        <div>
          <div className="text-sm font-medium text-[color:var(--color-ghost-text)]">
            자는 중... Zzz
          </div>
          <div className="text-xs text-[color:var(--color-ghost-muted)] mt-1">
            위에 URL을 붙여넣으면 여기에 다운로드가 쌓여요
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {hasFinished && (
        <div className="flex justify-end">
          <button
            onClick={clearFinished}
            className="text-xs text-[color:var(--color-ghost-muted)] hover:text-[color:var(--color-ghost-accent-hover)] inline-flex items-center gap-1 transition"
          >
            <Trash2 size={12} />
            완료된 항목 지우기
          </button>
        </div>
      )}
      {items.map((item) => (
        <QueueRow key={item.id} item={item} />
      ))}
    </div>
  )
}
