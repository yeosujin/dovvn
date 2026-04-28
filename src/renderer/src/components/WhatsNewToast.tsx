import { Sparkles, X } from 'lucide-react'
import type { ReleaseNotesEntry } from '../../../preload/index'
import { extractBullets } from '../lib/releaseNotes'

interface Props {
  entry: ReleaseNotesEntry
  onDismiss: () => void
}

export function WhatsNewToast({ entry, onDismiss }: Props): React.JSX.Element {
  const bullets = extractBullets(entry.notes)

  return (
    <div className="fixed bottom-4 left-4 z-40 w-80 max-w-[calc(100vw-32px)] animate-[slideUp_0.3s_ease-out]">
      <div className="relative bg-white rounded-2xl border border-[color:var(--color-ghost-border)] shadow-[0_16px_40px_-16px_rgba(124,106,232,0.45)] overflow-hidden">
        <div
          className={`px-4 py-3 bg-[color:var(--color-ghost-accent-soft)]/60 flex items-center justify-between ${bullets.length > 0 ? 'border-b border-[color:var(--color-ghost-border)]' : ''}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={14} className="text-[color:var(--color-ghost-accent-hover)] shrink-0" />
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-[color:var(--color-ghost-text)] truncate">
                업데이트 완료
              </div>
              <div className="text-[10.5px] text-[color:var(--color-ghost-muted)] tabular-nums">
                v{entry.version}
              </div>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 p-1 -m-1 rounded-md text-[color:var(--color-ghost-muted)] hover:text-[color:var(--color-ghost-text)] hover:bg-white/70 transition"
            aria-label="닫기"
          >
            <X size={14} />
          </button>
        </div>

        {bullets.length > 0 && (
          <div className="px-4 py-3">
            <ul className="space-y-1.5">
              {bullets.map((b, i) => (
                <li
                  key={i}
                  className="text-[12px] text-[color:var(--color-ghost-text)] leading-snug flex gap-1.5"
                >
                  <span className="text-[color:var(--color-ghost-accent)] shrink-0">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
