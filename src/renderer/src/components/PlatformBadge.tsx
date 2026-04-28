import { PLATFORM_META, type Platform } from '../constants/platforms'

interface Props {
  platform: Platform
  size?: 'sm' | 'md'
  showName?: boolean
}

export function PlatformBadge({
  platform,
  size = 'md',
  showName = false
}: Props): React.JSX.Element {
  const meta = PLATFORM_META[platform] ?? PLATFORM_META.other
  const px = size === 'sm' ? 14 : 18

  return (
    <span className="inline-flex items-center gap-1.5">
      {meta.icon ? (
        <svg
          role="img"
          viewBox="0 0 24 24"
          width={px}
          height={px}
          fill={`#${meta.icon.hex}`}
          aria-label={meta.name}
        >
          <path d={meta.icon.path} />
        </svg>
      ) : (
        <span
          className="inline-flex items-center justify-center rounded-full bg-[color:var(--color-ghost-accent-soft)] text-[color:var(--color-ghost-accent-hover)] font-bold"
          style={{ width: px, height: px, fontSize: px * 0.55 }}
        >
          ?
        </span>
      )}
      {showName && (
        <span
          className={
            size === 'sm'
              ? 'text-xs text-[color:var(--color-ghost-muted)]'
              : 'text-sm text-[color:var(--color-ghost-muted)]'
          }
        >
          {meta.name}
        </span>
      )}
    </span>
  )
}
