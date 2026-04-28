import { Check } from 'lucide-react'

interface Props {
  checked: boolean
  onChange: (v: boolean) => void
  label?: React.ReactNode
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
}

export function Checkbox({
  checked,
  onChange,
  label,
  size = 'md',
  disabled,
  className = ''
}: Props): React.JSX.Element {
  const box = size === 'sm' ? 14 : 16
  const iconSize = size === 'sm' ? 10 : 12

  const visual = (
    <span
      style={{ width: box, height: box }}
      className={`relative inline-flex items-center justify-center rounded-[5px] border transition shrink-0 ${
        checked
          ? 'bg-[color:var(--color-ghost-accent)] border-[color:var(--color-ghost-accent)] shadow-[0_2px_6px_-2px_rgba(124,106,232,0.6)]'
          : 'bg-white border-[color:var(--color-ghost-border)]'
      } peer-hover:border-[#b9adf0] peer-focus-visible:ring-[3px] peer-focus-visible:ring-[rgba(124,106,232,0.22)]`}
    >
      {checked && <Check size={iconSize} strokeWidth={3.5} className="text-white" />}
    </span>
  )

  return (
    <label
      className={`inline-flex items-center gap-2 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      {visual}
      {label && (
        <span className="text-xs text-[color:var(--color-ghost-muted)] select-none">{label}</span>
      )}
    </label>
  )
}
