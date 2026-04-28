import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectOption<T extends string | number> {
  value: T
  label: string
  hint?: string
}

interface Props<T extends string | number> {
  value: T | null
  options: ReadonlyArray<SelectOption<T>>
  onChange: (value: T) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  size?: 'sm' | 'md'
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
  placeholder = '선택',
  className = '',
  size = 'md'
}: Props<T>): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{
    placement: 'below' | 'above'
    top?: number
    bottom?: number
    left: number
    width: number
    maxHeight: number
  } | null>(null)
  const [highlight, setHighlight] = useState(0)
  const btnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value) ?? null

  const sizeCls =
    size === 'sm'
      ? 'px-2.5 py-1.5 text-[12px] rounded-[9px]'
      : 'px-3 py-2 text-[13px] rounded-[10px]'

  const computeCoords = (): void => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const gap = 6
    const margin = 8
    const spaceBelow = window.innerHeight - rect.bottom - gap - margin
    const spaceAbove = rect.top - gap - margin
    const desired = 288
    const placeBelow = spaceBelow >= Math.min(desired, 160) || spaceBelow >= spaceAbove
    if (placeBelow) {
      setCoords({
        placement: 'below',
        top: rect.bottom + gap,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(120, Math.min(desired, spaceBelow))
      })
    } else {
      setCoords({
        placement: 'above',
        bottom: window.innerHeight - rect.top + gap,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(120, Math.min(desired, spaceAbove))
      })
    }
  }

  useLayoutEffect(() => {
    if (!open) return
    computeCoords()
    const idx = options.findIndex((o) => o.value === value)
    setHighlight(idx >= 0 ? idx : 0)
    // 리스트에 포커스 이동
    requestAnimationFrame(() => listRef.current?.focus())
  }, [open, options, value])

  useEffect(() => {
    if (!open) return
    const reposition = (): void => computeCoords()
    const onDown = (e: MouseEvent): void => {
      if (btnRef.current?.contains(e.target as Node)) return
      if (listRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onScroll = (e: Event): void => {
      // 드롭다운 내부 스크롤은 무시
      if (listRef.current?.contains(e.target as Node)) return
      reposition()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const onKey = (e: React.KeyboardEvent): void => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      btnRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(options.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setHighlight(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setHighlight(options.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = options[highlight]
      if (opt) {
        onChange(opt.value)
        setOpen(false)
        btnRef.current?.focus()
      }
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 bg-white border text-[color:var(--color-ghost-text)] transition outline-none disabled:opacity-50 disabled:cursor-not-allowed ${sizeCls} ${
          open
            ? 'border-[#b9adf0] ring-[4px] ring-[rgba(124,106,232,0.14)]'
            : 'border-[color:var(--color-ghost-border)] hover:border-[#d9d2f5] focus-visible:border-[#b9adf0] focus-visible:ring-[4px] focus-visible:ring-[rgba(124,106,232,0.14)]'
        }`}
      >
        <span
          className={`truncate text-left flex-1 ${
            !selected ? 'text-[color:var(--color-ghost-muted)]' : ''
          }`}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={size === 'sm' ? 12 : 14}
          className={`shrink-0 text-[color:var(--color-ghost-muted)] transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            onKeyDown={onKey}
            style={{
              position: 'fixed',
              top: coords.placement === 'below' ? coords.top : undefined,
              bottom: coords.placement === 'above' ? coords.bottom : undefined,
              left: coords.left,
              minWidth: coords.width,
              maxHeight: coords.maxHeight
            }}
            className="z-[100] overflow-auto py-1.5 bg-white border border-[color:var(--color-ghost-border)] rounded-[14px] shadow-[0_20px_44px_-14px_rgba(124,106,232,0.35)] outline-none"
          >
            {options.map((o, i) => {
              const isSelected = o.value === value
              const isActive = i === highlight
              return (
                <button
                  key={String(o.value)}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                    btnRef.current?.focus()
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left transition ${
                    isActive
                      ? 'bg-[color:var(--color-ghost-accent-soft)] text-[color:var(--color-ghost-accent-hover)]'
                      : 'text-[color:var(--color-ghost-text)]'
                  }`}
                >
                  <Check
                    size={14}
                    className={`shrink-0 ${
                      isSelected ? 'text-[color:var(--color-ghost-accent)]' : 'opacity-0'
                    }`}
                  />
                  <span className="truncate flex-1">{o.label}</span>
                  {o.hint && (
                    <span className="ml-auto text-[11px] text-[color:var(--color-ghost-muted)] shrink-0">
                      {o.hint}
                    </span>
                  )}
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </div>
  )
}
