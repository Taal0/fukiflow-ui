import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface StepperProps {
  label: string
  value: number
  display?: string
  min: number
  max: number
  step: number
  disabled?: boolean
  onChange: (value: number) => void
  onReset?: () => void
  showReset?: boolean
  className?: string
  /** Allow typing a number into an input (default true when display omitted). */
  editable?: boolean
}

export function Stepper({
  label,
  value,
  display,
  min,
  max,
  step,
  disabled,
  onChange,
  onReset,
  showReset,
  className,
  editable = true,
}: StepperProps) {
  const bump = (dir: -1 | 1) => {
    const next = Math.min(max, Math.max(min, +(value + dir * step).toFixed(4)))
    onChange(next)
  }

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault()
          bump(-1)
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault()
          bump(1)
        }
      }}
    >
      <span className="w-10 shrink-0 text-[length:var(--text-meta)] uppercase tracking-wide text-[var(--color-ink-muted)]">
        {label}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 w-7 px-0"
        aria-label={`${label} azalt`}
        disabled={disabled || value <= min}
        onClick={() => bump(-1)}
      >
        −
      </Button>
      {editable && display == null ? (
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (!Number.isFinite(v)) return
            onChange(Math.min(max, Math.max(min, v)))
          }}
          className="h-7 w-14 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-1.5 text-center text-[length:var(--text-meta)] tabular-nums text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
        />
      ) : (
        <span className="min-w-[3rem] text-center text-[length:var(--text-meta)] tabular-nums text-[var(--color-ink-muted)]">
          {display ?? value}
        </span>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 w-7 px-0"
        aria-label={`${label} artır`}
        disabled={disabled || value >= max}
        onClick={() => bump(1)}
      >
        +
      </Button>
      {showReset && onReset && (
        <button
          type="button"
          className="ml-1 text-[length:var(--text-meta)] text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]"
          onClick={onReset}
        >
          Sıfırla
        </button>
      )}
    </div>
  )
}
