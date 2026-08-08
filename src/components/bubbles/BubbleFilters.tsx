import type { BubbleFilter } from '@/store/session'
import { Segmented } from '@/components/ui/segmented'

const FILTERS: { id: BubbleFilter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'undone', label: 'Bitmeyen' },
  { id: 'overflow', label: 'Taşan' },
  { id: 'flag', label: 'İnceleme' },
]

interface BubbleFiltersProps {
  filter: BubbleFilter
  search: string
  flagOpenCount?: number
  onFilterChange: (f: BubbleFilter) => void
  onSearchChange: (q: string) => void
}

export function BubbleFilters({
  filter,
  search,
  flagOpenCount = 0,
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
        className="h-7 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 text-[length:var(--text-ui)] text-[var(--color-ink)] outline-none transition-[box-shadow,border-color] duration-150 placeholder:text-[var(--color-ink-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
      />
      <Segmented
        ariaLabel="Filtreler"
        value={filter}
        onChange={onFilterChange}
        fill
        options={FILTERS.map((f) => {
          const isFlag = f.id === 'flag'
          const dimmed = isFlag && flagOpenCount === 0 && filter !== 'flag'
          const label =
            isFlag && flagOpenCount > 0
              ? `${f.label} ${flagOpenCount}`
              : f.label
          return {
            value: f.id,
            label: dimmed ? (
              <span className="opacity-50">{label}</span>
            ) : (
              label
            ),
            title: dimmed ? 'İnceleme bayrağı yok' : undefined,
          }
        })}
      />
    </div>
  )
}
