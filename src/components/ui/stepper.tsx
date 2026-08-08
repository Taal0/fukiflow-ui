import { RotateCcw } from 'lucide-react'
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
  /** Denser controls for tight inspector panels. */
  compact?: boolean
  /** Hide the visible label (keep aria on buttons). */
  hideLabel?: boolean
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
  compact = false,
  hideLabel = false,
}: StepperProps) {
  const bump = (dir: -1 | 1) => {
    const next = Math.min(max, Math.max(min, +(value + dir * step).toFixed(4)))
    onChange(next)
  }

  const btn = compact
    ? 'h-6 w-6 shrink-0 px-0 text-[length:var(--text-meta)]'
    : 'h-7 w-7 shrink-0 px-0'
  const field = compact
    ? 'h-6 w-12 px-1 text-[length:var(--text-meta)]'
    : 'h-7 w-14 px-1.5 text-[length:var(--text-meta)]'

  return (
    <div
      className={cn('flex w-full min-w-0 items-center gap-1.5', className)}
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
      {!hideLabel && (
        <span
          className={cn(
            'w-10 shrink-0 uppercase tracking-wide text-[var(--color-ink-muted)]',
            'text-[length:var(--text-meta)]',
          )}
        >
          {label}
        </span>
      )}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={btn}
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
            aria-label={label}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (!Number.isFinite(v)) return
              onChange(Math.min(max, Math.max(min, v)))
            }}
            className={cn(
              'rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-center tabular-nums text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] disabled:opacity-50',
              field,
            )}
          />
        ) : (
          <span
            className={cn(
              'w-12 shrink-0 text-center tabular-nums text-[var(--color-ink)]',
              'text-[length:var(--text-meta)]',
            )}
            aria-label={`${label}: ${display ?? value}`}
          >
            {display ?? value}
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={btn}
          aria-label={`${label} artır`}
          disabled={disabled || value >= max}
          onClick={() => bump(1)}
        >
          +
        </Button>
        {showReset && onReset ? (
          <button
            type="button"
            title="Sıfırla"
            aria-label={`${label} sıfırla`}
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-md text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
              compact ? 'h-6 w-6' : 'h-7 w-7',
            )}
            onClick={onReset}
          >
            <RotateCcw className="h-3 w-3" strokeWidth={2} aria-hidden />
          </button>
        ) : (
          // Reserve space so rows stay aligned when reset appears/disappears.
          <span className={cn('shrink-0', compact ? 'h-6 w-6' : 'h-7 w-7')} aria-hidden />
        )}
      </div>
    </div>
  )
}
