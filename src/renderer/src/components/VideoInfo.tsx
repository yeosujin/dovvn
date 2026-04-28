import { Clock, ListVideo, Captions } from 'lucide-react'
import { PlatformBadge } from './PlatformBadge'
import type { VideoInfo } from '../types'

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

export function VideoInfoCard({ info }: { info: VideoInfo }): React.JSX.Element {
  return (
    <div className="p-4">
      <div className="flex gap-3 sm:gap-4">
        {info.thumbnail && (
          <img
            src={info.thumbnail}
            alt=""
            className="w-24 sm:w-32 shrink-0 rounded-xl object-cover border border-[color:var(--color-ghost-border)]"
            style={{ aspectRatio: '16 / 9' }}
          />
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-1.5 text-xs text-[color:var(--color-ghost-muted)]">
              <PlatformBadge platform={info.platform} size="sm" />
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                {formatDuration(info.duration)}
              </span>
              {info.isPlaylist && (
                <span className="inline-flex items-center gap-1 text-[color:var(--color-ghost-accent-hover)] font-medium">
                  <ListVideo size={12} />
                  재생목록 · {info.entries?.length ?? 0}개
                </span>
              )}
            </div>
            <div className="text-sm font-semibold text-[color:var(--color-ghost-text)] line-clamp-2 leading-snug">
              {info.title}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-[color:var(--color-ghost-muted)] truncate">
            <span className="truncate">{info.uploader ?? '-'}</span>
            {info.subtitles.length > 0 && (
              <span className="inline-flex items-center gap-1 shrink-0">
                <Captions size={12} />
                자막 {info.subtitles.length}개
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
