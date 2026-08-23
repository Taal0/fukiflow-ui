import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, List, MoreHorizontal, Trash2 } from 'lucide-react'
import type { PageSummary } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { statusLabel } from '@/components/flags'
import { useSession } from '@/store/session'
import { cn } from '@/lib/utils'

interface PageGalleryProps {
  pages: PageSummary[]
  selectedPageId: number | null
  onSelect: (pageId: number) => void
  loading?: boolean
  error?: string | null
  width: number
  /** Tablet: render as overlay drawer. */
  asDrawer?: boolean
  drawerOpen?: boolean
  onCloseDrawer?: () => void
  /** Letterer shows done/bubble; translator shows translated/total. */
  progressMode?: 'done' | 'translated'
  /** Allow deleting uploaded pages (seed chapters stay protected). */
  canDeletePages?: boolean
  onDeletePage?: (pageId: number) => void
  /** Chapter page_count while the list is still loading. */
  pageCountHint?: number
}

export function PageGallery({
  pages,
  selectedPageId,
  onSelect,
  loading,
  error,
  width,
  asDrawer,
  drawerOpen,
  onCloseDrawer,
  progressMode = 'done',
  canDeletePages,
  onDeletePage,
  pageCountHint,
}: PageGalleryProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const thumbSize = useSession((s) => s.ui.thumbSize)
  const patchUi = useSession((s) => s.patchUi)
  const [pendingDelete, setPendingDelete] = useState<PageSummary | null>(null)

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

  const body = (
    <aside
      style={{ width: asDrawer ? undefined : width }}
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]',
        asDrawer && 'w-56 shadow-lg',
      )}
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <div>
          <h2 className="text-[length:var(--text-ui)] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Sayfalar
          </h2>
          <p className="text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
            {pages.length
              ? progressMode === 'translated'
                ? `${pages.length} sayfa · J/K`
                : `${pages.length} sayfa`
              : pageCountHint
                ? `${pageCountHint} sayfa`
                : '—'}
          </p>
        </div>
        <div className="flex gap-0.5" role="group" aria-label="Görünüm">
          {(
            [
              { id: 'sm', label: 'Liste', Icon: List },
              { id: 'lg', label: 'Büyük önizleme', Icon: LayoutGrid },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={thumbSize === id}
              onClick={() => patchUi({ thumbSize: id })}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
                thumbSize === id
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]',
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </button>
          ))}
        </div>
      </div>
      <div
        ref={listRef}
        tabIndex={0}
        className="flex-1 overflow-y-auto p-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus)]"
      >
        {loading && (
          <ul className="flex flex-col gap-1" aria-busy aria-label="Sayfalar yükleniyor">
            {Array.from({ length: 8 }).map((_, i) =>
              thumbSize === 'lg' ? (
                <li key={i} className="flex flex-col gap-1 rounded-md p-1.5">
                  <Skeleton className="aspect-[3/4] w-full rounded" />
                  <Skeleton className="h-2.5 w-3/4" />
                </li>
              ) : (
                <li key={i} className="flex h-9 items-center gap-2 px-1.5">
                  <Skeleton className="h-7 w-5 shrink-0 rounded-sm" />
                  <Skeleton className="h-2.5 flex-1" />
                  <Skeleton className="h-1 w-8 rounded-full" />
                </li>
              ),
            )}
          </ul>
        )}
        {error && (
          <p className="px-1 py-2 text-[length:var(--text-ui)] text-[var(--color-danger)]">
            {error}
          </p>
        )}
        {!loading && !error && pages.length === 0 && (
          <EmptyState
            title="Sayfa yok"
            description="Bu bölümde henüz sayfa bulunmuyor."
            className="py-6"
          />
        )}
        <ul
          className={cn(
            'flex flex-col',
            thumbSize === 'lg' ? 'gap-1.5' : 'gap-0.5',
          )}
        >
          {pages.map((page) => {
            const clean = statusLabel(page.clean_status)
            const typeset = statusLabel(page.typeset_status)
            const selected = page.id === selectedPageId
            const progress =
              progressMode === 'translated'
                ? page.bubble_count > 0
                  ? (page.translated_count ?? 0) /
                    Math.max(
                      page.bubble_count,
                      page.translated_count ?? 0,
                    )
                  : 0
                : page.bubble_count > 0
                  ? (page.done_count ?? 0) / page.bubble_count
                  : 0
            const progressTitle =
              progressMode === 'translated'
                ? `${page.translated_count ?? 0}/${page.bubble_count} çevrildi`
                : `${page.done_count ?? 0}/${page.bubble_count}`
            const label = page.stem || `Sayfa ${page.page_no}`

            if (thumbSize === 'sm') {
              return (
                <li key={page.id} className="group relative">
                  <button
                    type="button"
                    data-selected={selected || undefined}
                    onClick={() => {
                      onSelect(page.id)
                      onCloseDrawer?.()
                    }}
                    className={cn(
                      'flex h-9 w-full items-center gap-2 rounded-md px-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
                      selected
                        ? 'bg-[var(--color-selection)] ring-1 ring-[var(--color-accent)]'
                        : 'hover:bg-[var(--color-surface-muted)]',
                    )}
                  >
                    <span className="relative h-7 w-5 shrink-0 overflow-hidden rounded bg-[var(--color-surface-muted)]">
                      {page.thumb_url ? (
                        <img
                          src={page.thumb_url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[9px] tabular-nums text-[var(--color-ink-muted)]">
                          {page.page_no}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[length:var(--text-ui)] text-[var(--color-ink)]">
                      {label}
                    </span>
                    {(page.flag_count ?? 0) > 0 && (
                      <span
                        className="shrink-0 rounded px-1 py-0.5 text-[length:var(--text-meta)] font-semibold tabular-nums text-[#c2410c]"
                        title={`${page.flag_count} balon inceleme istiyor`}
                      >
                        {page.flag_count}
                      </span>
                    )}
                    {page.bubble_count > 0 && (
                      <span
                        className="h-1 w-8 shrink-0 overflow-hidden rounded-full bg-[var(--color-surface-muted)]"
                        title={progressTitle}
                      >
                        <span
                          className="block h-full bg-[var(--color-success)]"
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </span>
                    )}
                  </button>
                  {canDeletePages && onDeletePage && (
                    <div className="absolute right-0.5 top-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            aria-label="Sayfa menüsü"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-3 w-3" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            danger
                            onSelect={() => setPendingDelete(page)}
                          >
                            <Trash2
                              className="h-3.5 w-3.5 shrink-0 opacity-70"
                              aria-hidden
                            />
                            Sayfayı Sil
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </li>
              )
            }

            return (
              <li key={page.id} className="group relative">
                <button
                  type="button"
                  data-selected={selected || undefined}
                  onClick={() => {
                    onSelect(page.id)
                    onCloseDrawer?.()
                  }}
                  className={cn(
                    'flex w-full flex-col gap-1 rounded-md border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
                    selected
                      ? 'border-[var(--color-accent)] bg-[var(--color-selection)]'
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
                    <span className="absolute left-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[length:var(--text-meta)] font-medium text-white">
                      {page.page_no}
                    </span>
                    {(page.flag_count ?? 0) > 0 && (
                      <span
                        className="absolute bottom-1 left-1 rounded bg-[#c2410c] px-1.5 py-0.5 text-[length:var(--text-meta)] font-semibold tabular-nums text-white"
                        title={`${page.flag_count} balon inceleme istiyor`}
                      >
                        {page.flag_count}
                      </span>
                    )}
                    {canDeletePages && onDeletePage && (
                      <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 bg-[var(--color-surface-raised)]/90"
                              aria-label="Sayfa menüsü"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3 w-3" aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              danger
                              onSelect={() => setPendingDelete(page)}
                            >
                              <Trash2
                                className="h-3.5 w-3.5 shrink-0 opacity-70"
                                aria-hidden
                              />
                              Sayfayı Sil
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                  {page.bubble_count > 0 && (
                    <div
                      className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]"
                      title={progressTitle}
                    >
                      <div
                        className="h-full bg-[var(--color-success)] transition-[width]"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {progressMode !== 'translated' && page.clean_status !== 'ok' && (
                      <Badge variant={clean.variant}>clean: {clean.text}</Badge>
                    )}
                    {progressMode !== 'translated' && page.typeset_status !== 'ok' && (
                      <Badge variant={typeset.variant}>
                        dizgi: {typeset.text}
                      </Badge>
                    )}
                    {progressMode === 'translated' && page.bubble_count > 0 && (
                      <span className="text-[length:var(--text-meta)] tabular-nums text-[var(--color-ink-muted)]">
                        {progressTitle}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )

  const dialog = (
    <ConfirmDialog
      open={pendingDelete != null}
      onOpenChange={(open) => {
        if (!open) setPendingDelete(null)
      }}
      title="Sayfayı sil"
      description={
        pendingDelete
          ? `'${pendingDelete.stem || `Sayfa ${pendingDelete.page_no}`}' kalıcı olarak silinecek.`
          : ''
      }
      confirmLabel="Sil"
      tone="danger"
      onConfirm={() => {
        if (pendingDelete) onDeletePage?.(pendingDelete.id)
        setPendingDelete(null)
      }}
    />
  )

  if (!asDrawer) {
    return (
      <>
        {body}
        {dialog}
      </>
    )
  }

  if (!drawerOpen) return dialog

  return (
    <>
      <div className="absolute inset-0 z-30 flex lg:static">
        <button
          type="button"
          className="absolute inset-0 bg-black/40 lg:hidden"
          aria-label="Galeriyi kapat"
          onClick={onCloseDrawer}
        />
        <div className="relative z-10 h-full">{body}</div>
      </div>
      {dialog}
    </>
  )
}
