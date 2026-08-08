import { useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import type { FontInfo } from '@/api/types'
import { ensureFontLoaded } from '@/canvas/useFontFace'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const EMPTY = '__default__'

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
  const label = selected
    ? selected.label || selected.key
    : allowEmpty
      ? emptyLabel
      : 'Font seç'

  return (
    <div className={cn('inline-flex h-8 max-w-full', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={title}
            aria-label={title ?? 'Font'}
            className={cn(
              'group inline-flex h-full w-full min-w-0 items-center justify-between gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 text-left text-[length:var(--text-ui)] text-[var(--color-ink)] outline-none transition-colors duration-150',
              'hover:bg-[var(--color-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
              'data-[state=open]:bg-[var(--color-surface-muted)] data-[state=open]:ring-2 data-[state=open]:ring-[var(--color-focus)]',
            )}
            style={family ? { fontFamily: `"${family}", sans-serif` } : undefined}
          >
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <ChevronDown
              className="h-3.5 w-3.5 shrink-0 text-[var(--color-ink-muted)] transition-transform duration-150 group-data-[state=open]:rotate-180"
              strokeWidth={2}
              aria-hidden
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-64 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
        >
          <DropdownMenuRadioGroup
            value={value ?? EMPTY}
            onValueChange={(v) => onChange(v === EMPTY ? null : v)}
          >
            {allowEmpty && (
              <DropdownMenuRadioItem value={EMPTY}>
                {emptyLabel}
              </DropdownMenuRadioItem>
            )}
            {fonts.map((f) => {
              const name = f.label || f.key
              return (
                <DropdownMenuRadioItem
                  key={f.key}
                  value={f.key}
                  style={{ fontFamily: `"${name}", sans-serif` }}
                >
                  {name}
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
