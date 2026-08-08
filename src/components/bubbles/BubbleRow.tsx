import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Bubble } from '@/api/types'
import { Trash2 } from 'lucide-react'

interface BubbleRowProps {
  bubble: Bubble
  order: number | string
  text: string
  badges: string[]
  done: boolean
  selected: boolean
  typesetPending?: boolean
  onSelect: () => void
  onDelete?: () => void
}

export function BubbleRow({
  bubble,
  order,
  text,
  badges,
  done,
  selected,
  typesetPending,
  onSelect,
  onDelete,
}: BubbleRowProps) {
  const preview = text.replace(/\s+/g, ' ').trim() || '—'

  return (
    <li className="group flex items-center gap-0.5">
      <button
        type="button"
        data-selected={selected || undefined}
        onClick={onSelect}
        title={`Balon #${bubble.id}`}
        className={cn(
          'flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus)]',
          selected
            ? 'bg-[var(--color-selection)] ring-1 ring-[var(--color-accent)]'
            : 'hover:bg-[var(--color-surface-muted)]',
          done && !selected && 'opacity-60',
        )}
      >
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--color-surface-muted)] text-[length:var(--text-meta)] font-semibold tabular-nums text-[var(--color-ink)]">
          {order}
          {typesetPending && selected && (
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-[length:var(--text-ui)] text-[var(--color-ink)]">
          {preview}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {badges.slice(0, 1).map((b) => (
            <Badge key={b} variant={done ? 'default' : 'warn'}>
              {b}
            </Badge>
          ))}
          {done && <Badge variant="ok">Bitti</Badge>}
        </span>
      </button>
      {onDelete && (
        <button
          type="button"
          aria-label="Balonu sil"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--color-ink-muted)] opacity-0 hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-danger)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  )
}
