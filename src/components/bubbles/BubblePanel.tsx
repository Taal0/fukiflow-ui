import { useEffect, useMemo, useRef } from 'react'
import type {
  BubbleEdit,
  BubbleLayout,
  FontInfo,
  PageDoc,
  Region,
} from '@/api/types'
import { BubbleFilters } from '@/components/bubbles/BubbleFilters'
import { BubbleInspector } from '@/components/bubbles/BubbleInspector'
import {
  BubbleRow,
} from '@/components/bubbles/BubbleRow'
import {
  displayText,
  layoutForBubble,
} from '@/components/bubbles/bubbleUtils'
import { bubbleFlags } from '@/components/flags'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { orderedItems } from '@/lib/workingDoc'
import {
  type BubbleFilter,
  useSession,
} from '@/store/session'
import { cn } from '@/lib/utils'
import { toast } from '@/store/toast'

interface BubblePanelProps {
  doc: PageDoc
  selectedBubbleId: number | null
  disabledLayerIds: Set<string>
  layoutsByBubble: Record<number, BubbleLayout>
  textOverrides: Record<number, string>
  bubbleFontOverrides: Record<number, string>
  bubbleEdits: Record<string, BubbleEdit>
  /** Translator regions — shown read-only in letterer panel. */
  regions?: Region[]
  order?: string[]
  fonts: FontInfo[]
  typesetPending?: boolean
  width: number
  onSelect: (bubbleId: number) => void
  onToggleLayer: (layerId: string, enabled: boolean) => void
  onTextChange: (bubbleId: number, text: string) => void
  onResetText: (bubbleId: number) => void
  onBubbleFont: (bubbleId: number, fontKey: string | null) => void
  onFontPx: (bubbleId: number, px: number | null) => void
  onLeading: (bubbleId: number, leading: number | null) => void
  onAlign: (bubbleId: number, align: 'left' | 'center' | null) => void
  onResetFrame: (bubbleId: number) => void
  onAutoTypeset: (bubbleId: number) => void
  onToggleDone: (bubbleId: number, done: boolean) => void
  onInset: (bubbleId: number, inset: number | null) => void
  onDeleteBubble?: (bubbleId: number) => void
}

function matchesFilter(
  filter: BubbleFilter,
  bubble: PageDoc['bubbles'][number],
  be: BubbleEdit | undefined,
  layout: BubbleLayout | undefined,
  search: string,
  text: string,
): boolean {
  const q = search.trim().toLowerCase()
  if (q) {
    const hay = `${text} ${bubble.id} ${bubble.reading_order ?? ''}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (filter === 'undone') return !be?.done
  if (filter === 'overflow') return Boolean(layout?.overflow)
  if (filter === 'flag') return bubbleFlags(bubble, layout).length > 0
  return true
}

export function BubblePanel({
  doc,
  selectedBubbleId,
  disabledLayerIds,
  layoutsByBubble,
  textOverrides,
  bubbleFontOverrides,
  bubbleEdits,
  regions = [],
  order = [],
  fonts,
  typesetPending,
  width,
  onSelect,
  onToggleLayer,
  onTextChange,
  onResetText,
  onBubbleFont,
  onFontPx,
  onLeading,
  onAlign,
  onResetFrame,
  onAutoTypeset,
  onToggleDone,
  onInset,
  onDeleteBubble,
}: BubblePanelProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const filter = useSession((s) => s.ui.bubbleFilter)
  const search = useSession((s) => s.ui.bubbleSearch)
  const listRatio = useSession((s) => s.ui.panelListRatio)
  const patchUi = useSession((s) => s.patchUi)

  const bubbles = useMemo(
    () =>
      [...doc.bubbles].sort((a, b) => {
        const ra = a.reading_order ?? a.id
        const rb = b.reading_order ?? b.id
        return ra - rb
      }),
    [doc.bubbles],
  )

  const unified = useMemo(
    () =>
      orderedItems(doc, {
        rev: 0,
        bubbles: bubbleEdits,
        regions,
        order,
      }),
    [doc, bubbleEdits, regions, order],
  )

  const doneCount = bubbles.filter(
    (b) => bubbleEdits[String(b.id)]?.done,
  ).length

  const flagStats = useMemo(() => {
    let total = 0
    let open = 0
    let firstOpenId: number | null = null
    for (const b of bubbles) {
      const layout = layoutForBubble(b.id, layoutsByBubble, doc.layers)
      if (bubbleFlags(b, layout).length === 0) continue
      total += 1
      if (!bubbleEdits[String(b.id)]?.done) {
        open += 1
        if (firstOpenId == null) firstOpenId = b.id
      }
    }
    return { total, open, firstOpenId }
  }, [bubbles, layoutsByBubble, doc.layers, bubbleEdits])

  const visible = useMemo(
    () =>
      bubbles.filter((b) => {
        const layout = layoutForBubble(b.id, layoutsByBubble, doc.layers)
        const be = bubbleEdits[String(b.id)]
        const text = displayText(b.id, doc.texts, textOverrides)
        return matchesFilter(filter, b, be, layout, search, text)
      }),
    [
      bubbles,
      layoutsByBubble,
      doc.layers,
      doc.texts,
      bubbleEdits,
      textOverrides,
      filter,
      search,
    ],
  )

  const visibleIds = useMemo(() => new Set(visible.map((b) => b.id)), [visible])

  const listRows = useMemo(() => {
    // When filtering, fall back to bubble-only list; otherwise show unified order.
    if (filter !== 'all' || search.trim()) {
      return visible.map((b) => ({
        kind: 'bubble' as const,
        bubble: b,
        index: b.reading_order ?? b.id,
      }))
    }
    return unified
      .map((item, i) => {
        if (item.kind === 'bubble') {
          const bubble = doc.bubbles.find((b) => b.id === Number(item.id))
          if (!bubble || !visibleIds.has(bubble.id)) return null
          return { kind: 'bubble' as const, bubble, index: i + 1 }
        }
        const region = regions.find((r) => r.id === item.id)
        if (!region) return null
        return { kind: 'region' as const, region, index: i + 1 }
      })
      .filter(Boolean) as Array<
      | { kind: 'bubble'; bubble: PageDoc['bubbles'][number]; index: number }
      | { kind: 'region'; region: Region; index: number }
    >
  }, [filter, search, visible, unified, doc.bubbles, regions, visibleIds])

  const selected = bubbles.find((b) => b.id === selectedBubbleId) ?? null
  const selectedLayout = selected
    ? layoutForBubble(selected.id, layoutsByBubble, doc.layers)
    : undefined

  useEffect(() => {
    const node = listRef.current?.querySelector('[data-selected="true"]')
    node?.scrollIntoView({ block: 'nearest' })
  }, [selectedBubbleId])

  // Vertical sash between list and inspector — reuse horizontal math via height %.
  const listPct = Math.round(listRatio * 100)

  const onListRatioDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const parent = e.currentTarget.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    const onMove = (ev: PointerEvent) => {
      const y = ev.clientY - rect.top
      const ratio = Math.min(0.75, Math.max(0.25, y / rect.height))
      patchUi({ panelListRatio: ratio })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startReview = () => {
    patchUi({ bubbleFilter: 'flag' })
    if (flagStats.firstOpenId != null) onSelect(flagStats.firstOpenId)
  }

  const flagEmpty = filter === 'flag' && flagStats.open === 0 && !search.trim()

  return (
    <aside
      style={{ width }}
      className="relative flex h-full shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[length:var(--text-ui)] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Balonlar
          </h2>
          <p className="text-[length:var(--text-meta)] tabular-nums text-[var(--color-ink-muted)]">
            {doneCount}/{bubbles.length} bitti
            {typesetPending ? ' · Dizgi…' : ''}
          </p>
          {flagStats.total > 0 && (
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <p className="text-[length:var(--text-meta)] tabular-nums text-[var(--color-ink-muted)]">
                {flagStats.total} inceleme · {flagStats.open} kaldı
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 shrink-0 px-2 text-[length:var(--text-meta)]"
                onClick={startReview}
              >
                İncele
              </Button>
            </div>
          )}
        </div>
      </div>

      <BubbleFilters
        filter={filter}
        search={search}
        flagOpenCount={flagStats.open}
        onFilterChange={(f) => patchUi({ bubbleFilter: f })}
        onSearchChange={(q) => patchUi({ bubbleSearch: q })}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          ref={listRef}
          style={{ flexBasis: `${listPct}%` }}
          className="min-h-0 flex-shrink overflow-y-auto p-1.5"
        >
          {flagEmpty ? (
            <EmptyState
              title="İnceleme kalmadı"
              description="Bu sayfadaki tüm bayraklar kapandı."
              actionLabel="Tüm balonlar"
              onAction={() => patchUi({ bubbleFilter: 'all', bubbleSearch: '' })}
              className="py-6"
            />
          ) : listRows.length === 0 ? (
            <EmptyState
              title={bubbles.length === 0 ? 'Balon yok' : 'Sonuç yok'}
              description={
                bubbles.length === 0
                  ? 'Bu sayfada düzenlenecek balon bulunamadı.'
                  : 'Filtreleri temizleyerek tüm balonları gösterin.'
              }
              actionLabel={filter !== 'all' || search ? 'Filtreleri temizle' : undefined}
              onAction={
                filter !== 'all' || search
                  ? () => patchUi({ bubbleFilter: 'all', bubbleSearch: '' })
                  : undefined
              }
              className="py-6"
            />
          ) : (
            <ul className="flex flex-col gap-0.5">
              {listRows.map((row) => {
                if (row.kind === 'region') {
                  const preview =
                    row.region.text.replace(/\s+/g, ' ').trim() || '—'
                  const unconfirmed = row.region.status === 'unconfirmed'
                  return (
                    <li key={row.region.id}>
                      <div
                        className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-[var(--color-ink-muted)]"
                        title={
                          unconfirmed
                            ? 'Doğrulanamadı — otomatik clean/dizgi yok'
                            : 'Çevirmen kutusu (salt okunur)'
                        }
                      >
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded border border-dashed border-[var(--color-focus)] px-1 text-[length:var(--text-meta)] font-semibold tabular-nums text-[var(--color-focus)]">
                          R{row.index}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[length:var(--text-ui)]">
                          {preview}
                        </span>
                        {unconfirmed && (
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[length:var(--text-meta)] font-medium text-[#c2410c]">
                            Doğrulanamadı
                          </span>
                        )}
                      </div>
                    </li>
                  )
                }
                const bubble = row.bubble
                const layout = layoutForBubble(
                  bubble.id,
                  layoutsByBubble,
                  doc.layers,
                )
                const be = bubbleEdits[String(bubble.id)]
                const text = displayText(bubble.id, doc.texts, textOverrides)
                return (
                  <BubbleRow
                    key={bubble.id}
                    bubble={bubble}
                    order={row.index}
                    text={text}
                    badges={bubbleFlags(bubble, layout).map((f) => f.label)}
                    done={Boolean(be?.done)}
                    selected={bubble.id === selectedBubbleId}
                    typesetPending={typesetPending}
                    onSelect={() => onSelect(bubble.id)}
                    onDelete={
                      onDeleteBubble
                        ? () => {
                            onDeleteBubble(bubble.id)
                            toast(
                              'Balon silindi — ⌘Z ile geri alın',
                              'info',
                            )
                          }
                        : undefined
                    }
                  />
                )
              })}
            </ul>
          )}
        </div>

        <div
          role="separator"
          aria-orientation="horizontal"
          aria-valuenow={listPct}
          tabIndex={0}
          onPointerDown={onListRatioDrag}
          onDoubleClick={() => patchUi({ panelListRatio: 0.55 })}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              patchUi({
                panelListRatio: Math.max(0.25, listRatio - 0.05),
              })
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              patchUi({
                panelListRatio: Math.min(0.75, listRatio + 0.05),
              })
            }
          }}
          className={cn(
            'h-1.5 shrink-0 cursor-row-resize bg-[var(--color-border)]/60 hover:bg-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
          )}
        />

        <div className="min-h-0 flex-1 overflow-hidden bg-[var(--color-surface-raised)]">
          <BubbleInspector
            doc={doc}
            bubble={selected}
            layout={selectedLayout}
            be={selected ? bubbleEdits[String(selected.id)] : undefined}
            fonts={fonts}
            bubbleFont={
              selected ? (bubbleFontOverrides[selected.id] ?? null) : null
            }
            disabledLayerIds={disabledLayerIds}
            typesetPending={typesetPending}
            onSelect={onSelect}
            onToggleLayer={onToggleLayer}
            onTextChange={onTextChange}
            onResetText={onResetText}
            onBubbleFont={onBubbleFont}
            onFontPx={onFontPx}
            onLeading={onLeading}
            onAlign={onAlign}
            onResetFrame={onResetFrame}
            onAutoTypeset={onAutoTypeset}
            onToggleDone={onToggleDone}
            onInset={onInset}
          />
        </div>
      </div>
    </aside>
  )
}
