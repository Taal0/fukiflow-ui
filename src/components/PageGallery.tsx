import { useEffect, useRef } from 'react'
import type { PageSummary } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { statusLabel } from '@/components/flags'
import { cn } from '@/lib/utils'

interface PageGalleryProps {
  pages: PageSummary[]
  selectedPageId: number | null
  onSelect: (pageId: number) => void
  loading?: boolean
  error?: string | null
}

export function PageGallery({
  pages,
  selectedPageId,
  onSelect,
  loading,
  error,
}: PageGalleryProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      if (!pages.length) return
      e.preventDefault()
      const idx = pages.findIndex((p) => p.id === selectedPageId)
      const next =
        e.key === 'ArrowDown'
          ? Math.min(pages.length - 1, Math.max(0, idx) + 1)
          : Math.max(0, (idx < 0 ? 0 : idx) - 1)
      onSelect(pages[next]!.id)
    }

    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [pages, selectedPageId, onSelect])

  useEffect(() => {
    const node = listRef.current?.querySelector('[data-selected="true"]')
    node?.scrollIntoView({ block: 'nearest' })
  }, [selectedPageId])

  return (
    <aside className="flex h-full w-52 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="border-b border-[var(--color-border)] px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Sayfalar
        </h2>
        <p className="text-[11px] text-[var(--color-ink-muted)]">
          {pages.length ? `${pages.length} sayfa` : '—'}
        </p>
      </div>
      <div
        ref={listRef}
        tabIndex={0}
        className="flex-1 overflow-y-auto p-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]"
      >
        {loading && (
          <p className="px-1 py-2 text-xs text-[var(--color-ink-muted)]">
            Yükleniyor…
          </p>
        )}
        {error && (
          <p className="px-1 py-2 text-xs text-[var(--color-danger)]">{error}</p>
        )}
        <ul className="flex flex-col gap-1.5">
          {pages.map((page) => {
            const clean = statusLabel(page.clean_status)
            const typeset = statusLabel(page.typeset_status)
            const selected = page.id === selectedPageId
            return (
              <li key={page.id}>
                <button
                  type="button"
                  data-selected={selected || undefined}
                  onClick={() => onSelect(page.id)}
                  className={cn(
                    'flex w-full flex-col gap-1.5 rounded-md border p-1.5 text-left transition-colors',
                    selected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                      : 'border-transparent hover:bg-[var(--color-surface-muted)]',
                  )}
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded bg-[var(--color-surface-muted)]">
                    {page.thumb_url ? (
                      <img
                        src={page.thumb_url}
                        alt={`Sayfa ${page.page_no}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[var(--color-ink-muted)]">
                        {page.page_no}
                      </div>
                    )}
                    <span className="absolute left-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {page.page_no}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={clean.variant}>clean: {clean.text}</Badge>
                    <Badge variant={typeset.variant}>
                      dizgi: {typeset.text}
                    </Badge>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
