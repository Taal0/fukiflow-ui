import * as ToggleGroup from '@radix-ui/react-toggle-group'
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  title?: string
  ariaLabel?: string
  disabled?: boolean
}

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  ariaLabel: string
  size?: 'sm' | 'md'
  /** Stretch segments evenly across the control width. */
  fill?: boolean
  className?: string
  disabled?: boolean
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = 'sm',
  fill = false,
  className,
  disabled,
}: SegmentedProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState({ left: 0, width: 0 })
  const [animate, setAnimate] = useState(false)

  const updateThumb = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const active = root.querySelector<HTMLElement>(
      '[data-state="on"]:not([disabled])',
    )
    if (!active) {
      setThumb((prev) => (prev.width === 0 ? prev : { left: 0, width: 0 }))
      return
    }
    const next = { left: active.offsetLeft, width: active.offsetWidth }
    setThumb((prev) =>
      prev.left === next.left && prev.width === next.width ? prev : next,
    )
  }, [])

  useLayoutEffect(() => {
    updateThumb()
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [value, size, updateThumb])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => updateThumb())
    ro.observe(root)
    root.querySelectorAll('[role="radio"],button').forEach((el) => ro.observe(el))
    return () => ro.disconnect()
  }, [updateThumb, value, options.length])

  return (
    <ToggleGroup.Root
      ref={rootRef}
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as T)
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5',
        fill && 'min-w-0 w-full',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-0.5 bottom-0.5 z-0 rounded bg-[var(--color-accent)]',
          animate &&
            'motion-safe:transition-[left,width] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]',
        )}
        style={{
          left: thumb.left,
          width: thumb.width,
          opacity: thumb.width > 0 ? 1 : 0,
        }}
      />
      {options.map((opt) => (
        <ToggleGroup.Item
          key={opt.value}
          value={opt.value}
          title={opt.title}
          aria-label={opt.ariaLabel ?? opt.title}
          disabled={opt.disabled || disabled}
          className={cn(
            'relative z-10 inline-flex items-center justify-center',
            'whitespace-nowrap rounded px-2.5 text-center font-medium leading-none',
            'transition-colors duration-150 ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
            'disabled:opacity-50',
            fill ? 'min-w-0 flex-1' : 'shrink-0',
            size === 'sm'
              ? 'h-6 text-[length:var(--text-ui)]'
              : 'h-7 px-3 text-xs',
            'data-[state=on]:text-white',
            'data-[state=off]:text-[var(--color-ink-muted)] data-[state=off]:hover:text-[var(--color-ink)]',
          )}
        >
          {opt.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
