import { Sparkles } from 'lucide-react'
import { usePresetsStore } from '../stores/presetsStore'

export function PresetBar(): React.JSX.Element | null {
  const presets = usePresetsStore((s) => s.presets)
  const activeId = usePresetsStore((s) => s.activeId)
  const setActive = usePresetsStore((s) => s.setActive)

  if (presets.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-ghost-muted)] pr-1">
        <Sparkles size={13} />
        Smart Mode
      </span>
      <button onClick={() => setActive(null)} className={`chip ${!activeId ? 'chip-active' : ''}`}>
        수동
      </button>
      {presets.map((p) => (
        <button
          key={p.id}
          onClick={() => setActive(p.id)}
          className={`chip ${activeId === p.id ? 'chip-active' : ''}`}
        >
          {p.name}
        </button>
      ))}
    </div>
  )
}
