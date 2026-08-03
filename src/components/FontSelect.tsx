import { useEffect } from 'react'
import type { FontInfo } from '@/api/types'
import { ensureFontLoaded } from '@/canvas/useFontFace'
import { cn } from '@/lib/utils'

interface FontSelectProps {
  fonts: FontInfo[]
  value: string | null
  onChange: (key: string | null) => void
  allowEmpty?: boolean
  emptyLabel?: string
  className?: string
  title?: string
}

export function FontSelect({
  fonts,
  value,
  onChange,
  allowEmpty = false,
  emptyLabel = 'Varsayılan',
  className,
  title,
}: FontSelectProps) {
  useEffect(() => {
    for (const f of fonts) {
      void ensureFontLoaded(f).catch(() => null)
    }
  }, [fonts])

  const selected = fonts.find((f) => f.key === value)
  const family = selected?.label || selected?.key

  return (
    <select
      title={title}
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value
        onChange(v ? v : null)
      }}
      className={cn(
        'h-8 max-w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 text-xs text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
        className,
      )}
      style={family ? { fontFamily: `"${family}", sans-serif` } : undefined}
    >
      {allowEmpty && (
        <option value="" style={{ fontFamily: 'inherit' }}>
          {emptyLabel}
        </option>
      )}
      {fonts.map((f) => (
        <option
          key={f.key}
          value={f.key}
          style={{ fontFamily: `"${f.label || f.key}", sans-serif` }}
        >
          {f.label || f.key}
        </option>
      ))}
    </select>
  )
}
