import type { BubbleFilter } from '@/store/session'
import { cn } from '@/lib/utils'

const FILTERS: { id: BubbleFilter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'undone', label: 'Bitmeyen' },
  { id: 'overflow', label: 'Taşan' },
  { id: 'editor', label: 'Editör' },
]

interface BubbleFiltersProps {
  filter: BubbleFilter
  search: string
  onFilterChange: (f: BubbleFilter) => void
  onSearchChange: (q: string) => void
}

export function BubbleFilters({
  filter,
  search,
  onFilterChange,
  onSearchChange,
}: BubbleFiltersProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--color-border)] px-3 py-2">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Balon ara…"
        className="h-7 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 text-[length:var(--text-ui)] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
      />
      <div className="flex flex-wrap gap-1" role="group" aria-label="Filtreler">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange(f.id)}
            className={cn(
              'rounded px-2 py-0.5 text-[length:var(--text-meta)] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
              filter === f.id
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}
