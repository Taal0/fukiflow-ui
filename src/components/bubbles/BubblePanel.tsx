import { useEffect, useMemo, useRef } from 'react'
import type {
  BubbleEdit,
  BubbleLayout,
  FontInfo,
  PageDoc,
} from '@/api/types'
import { BubbleFilters } from '@/components/bubbles/BubbleFilters'
import { BubbleInspector } from '@/components/bubbles/BubbleInspector'
import {
  BubbleRow,
} from '@/components/bubbles/BubbleRow'
import {
  bubbleBadges,
  displayText,
  layoutForBubble,
} from '@/components/bubbles/bubbleUtils'
import { EmptyState } from '@/components/ui/empty-state'
import {
  type BubbleFilter,
  useSession,
} from '@/store/session'
import { cn } from '@/lib/utils'

interface BubblePanelProps {
  doc: PageDoc
  selectedBubbleId: number | null
  disabledLayerIds: Set<string>
  layoutsByBubble: Record<number, BubbleLayout>
  textOverrides: Record<number, string>
  bubbleFontOverrides: Record<number, string>
  bubbleEdits: Record<string, BubbleEdit>
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
  if (filter === 'editor') return bubble.clean_status === 'editor'
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

  const doneCount = bubbles.filter(
    (b) => bubbleEdits[String(b.id)]?.done,
  ).length

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

  return (
    <aside
      style={{ width }}
      className="relative flex h-full shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <div>
          <h2 className="text-[length:var(--text-ui)] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Balonlar
          </h2>
          <p className="text-[length:var(--text-meta)] tabular-nums text-[var(--color-ink-muted)]">
            {doneCount}/{bubbles.length} bitti
            {typesetPending ? ' · Dizgi…' : ''}
          </p>
        </div>
      </div>

      <BubbleFilters
        filter={filter}
        search={search}
        onFilterChange={(f) => patchUi({ bubbleFilter: f })}
        onSearchChange={(q) => patchUi({ bubbleSearch: q })}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          ref={listRef}
          style={{ flexBasis: `${listPct}%` }}
          className="min-h-0 flex-shrink overflow-y-auto p-1.5"
        >
          {visible.length === 0 ? (
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
              {visible.map((bubble) => {
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
                    order={bubble.reading_order ?? '—'}
                    text={text}
                    badges={bubbleBadges(bubble, layout)}
                    done={Boolean(be?.done)}
                    selected={bubble.id === selectedBubbleId}
                    typesetPending={typesetPending}
                    onSelect={() => onSelect(bubble.id)}
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