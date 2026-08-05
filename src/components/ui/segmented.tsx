import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  title?: string
  disabled?: boolean
}

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  ariaLabel: string
  size?: 'sm' | 'md'
  className?: string
  disabled?: boolean
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = 'sm',
  className,
  disabled,
}: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as T)
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-0.5',
        className,
      )}
    >
      {options.map((opt) => (
        <ToggleGroup.Item
          key={opt.value}
          value={opt.value}
          title={opt.title}
          disabled={opt.disabled || disabled}
          className={cn(
            'rounded px-2.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] disabled:opacity-50',
            size === 'sm' ? 'py-1 text-[length:var(--text-ui)]' : 'py-1.5 text-xs',
            'data-[state=on]:bg-[var(--color-accent)] data-[state=on]:text-white',
            'data-[state=off]:text-[var(--color-ink-muted)] data-[state=off]:hover:text-[var(--color-ink)]',
          )}
        >
          {opt.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
