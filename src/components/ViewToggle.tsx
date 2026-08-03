import type { ViewMode } from '@/api/types'
import { cn } from '@/lib/utils'

const MODES: { id: ViewMode; label: string }[] = [
  { id: 'composed', label: 'Sonuç' },
  { id: 'original', label: 'Orijinal' },
  { id: 'split', label: 'Yan yana' },
]

interface ViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Görünüm"
      className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-0.5"
    >
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={value === m.id}
          onClick={() => onChange(m.id)}
          className={cn(
            'rounded px-3 py-1.5 text-xs font-medium transition-colors',
            value === m.id
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
