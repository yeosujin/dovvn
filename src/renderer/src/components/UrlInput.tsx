import { Link2, Loader2, Search, X } from 'lucide-react'

interface Props {
  value: string
  loading: boolean
  onChange: (v: string) => void
  onSubmit: () => void
}

export function UrlInput({ value, loading, onChange, onSubmit }: Props): React.JSX.Element {
  const disabled = loading || !value.trim()
  const showClear = value.length > 0 && !loading

  return (
    <div className="field flex items-center gap-2 p-1.5 pl-4">
      <Link2 size={18} className="shrink-0 text-[color:var(--color-ghost-muted)]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !loading && onSubmit()}
        placeholder="훔쳐올 영상 링크 붙여넣기"
        className="flex-1 min-w-0 bg-transparent px-1 py-2.5 text-sm text-[color:var(--color-ghost-text)] placeholder:text-[color:var(--color-ghost-muted)] focus:outline-none"
      />
      {showClear && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="입력 지우기"
          title="입력 지우기"
          className="shrink-0 grid place-items-center w-7 h-7 rounded-full text-[color:var(--color-ghost-muted)] hover:text-[color:var(--color-ghost-text)] hover:bg-[color:var(--color-ghost-accent-soft)] transition-colors"
        >
          <X size={14} />
        </button>
      )}
      <button onClick={onSubmit} disabled={disabled} className="btn-primary shrink-0 min-w-[92px]">
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            조회 중
          </>
        ) : (
          <>
            <Search size={16} />
            조회
          </>
        )}
      </button>
    </div>
  )
}
