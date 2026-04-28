import { PlatformBadge } from './PlatformBadge'
import { Checkbox } from './ui/Checkbox'
import type { PlaylistEntry, VideoInfo } from '../types'

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

interface Props {
  info: VideoInfo
  selected: Set<string>
  onToggle: (id: string) => void
  onSelectAll: () => void
  onSelectNone: () => void
}

export function PlaylistSelector({
  info,
  selected,
  onToggle,
  onSelectAll,
  onSelectNone
}: Props): React.JSX.Element {
  const entries: PlaylistEntry[] = info.entries ?? []

  return (
    <div className="overflow-hidden">
      <div className="px-5 py-4 border-b border-[color:var(--color-ghost-border)] flex items-center gap-3 flex-wrap">
        <PlatformBadge platform={info.platform} showName />
        <div className="flex-1 min-w-0 basis-full sm:basis-0">
          <div
            className="font-semibold text-sm text-[color:var(--color-ghost-text)] truncate"
            title={info.title}
          >
            {info.title}
          </div>
          <div className="text-xs text-[color:var(--color-ghost-muted)] mt-0.5">
            {entries.length}개 항목 ·{' '}
            <span className="text-[color:var(--color-ghost-accent-hover)] font-medium">
              선택됨 {selected.size}
            </span>{' '}
            / {entries.length}
          </div>
        </div>
        <button onClick={onSelectAll} className="btn-soft text-xs px-3 py-1.5">
          전체 선택
        </button>
        <button onClick={onSelectNone} className="btn-soft text-xs px-3 py-1.5">
          해제
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {entries.map((entry, idx) => {
          const checked = selected.has(entry.id)
          return (
            <div
              key={entry.id}
              role="button"
              tabIndex={0}
              onClick={() => onToggle(entry.id)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  onToggle(entry.id)
                }
              }}
              className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer border-b border-[color:var(--color-ghost-border)] last:border-b-0 transition outline-none ${
                checked ? 'bg-[color:var(--color-ghost-accent-soft)]/50' : 'hover:bg-[#faf7ff]'
              }`}
            >
              <span onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={checked} onChange={() => onToggle(entry.id)} size="sm" />
              </span>
              <span className="text-xs text-[color:var(--color-ghost-muted)] w-6 shrink-0 tabular-nums">
                {idx + 1}
              </span>
              <span
                className="flex-1 min-w-0 text-sm text-[color:var(--color-ghost-text)] truncate"
                title={entry.title}
              >
                {entry.title}
              </span>
              <span className="text-xs text-[color:var(--color-ghost-muted)] shrink-0 tabular-nums">
                {formatDuration(entry.duration)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
