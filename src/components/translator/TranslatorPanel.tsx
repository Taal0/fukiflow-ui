import { useMemo, useRef, useState } from 'react'
import type { PageDoc, PageEdit } from '@/api/types'
import { BubbleTextArea } from '@/components/bubbles/BubbleTextArea'
import { EmptyState } from '@/components/ui/empty-state'
import {
  bubbleOrderToken,
  orderedItems,
  type OrderedItem,
} from '@/lib/workingDoc'
import { displayText } from '@/components/bubbles/bubbleUtils'
import { useSession } from '@/store/session'
import { cn } from '@/lib/utils'
import { GripVertical, Trash2 } from 'lucide-react'
import { toast } from '@/store/toast'

interface TranslatorPanelProps {
  doc: PageDoc
  edit: PageEdit
  width: number
  selectedBubbleId: number | null
  selectedRegionId: string | null
  onSelectBubble: (id: number) => void
  onSelectRegion: (id: string) => void
  onBubbleText: (id: number, text: string) => void
  onRegionText: (id: string, text: string) => void
  onDeleteRegion: (id: string) => void
  onReorder: (tokens: string[]) => void
}

function itemToken(item: OrderedItem): string {
  return item.kind === 'bubble' ? bubbleOrderToken(Number(item.id)) : item.id
}

export function TranslatorPanel({
  doc,
  edit,
  width,
  selectedBubbleId,
  selectedRegionId,
  onSelectBubble,
  onSelectRegion,
  onBubbleText,
  onRegionText,
  onDeleteRegion,
  onReorder,
}: TranslatorPanelProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const setActiveTool = useSession((s) => s.setActiveTool)

  const items = useMemo(() => orderedItems(doc, edit), [doc, edit])
  const tokens = useMemo(() => items.map(itemToken), [items])

  const translated = useMemo(() => {
    let n = 0
    for (const item of items) {
      if (item.kind === 'bubble') {
        const overlay = edit.bubbles[item.id]?.text
        if (typeof overlay === 'string' && overlay.trim()) n += 1
      } else {
        const r = edit.regions?.find((x) => x.id === item.id)
        if (r?.text?.trim()) n += 1
      }
    }
    return n
  }, [items, edit])

  const move = (from: number, to: number) => {
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= tokens.length ||
      to >= tokens.length
    )
      return
    const next = [...tokens]
    const [row] = next.splice(from, 1)
    if (row == null) return
    next.splice(to, 0, row)
    onReorder(next)
  }

  const empty = items.length === 0

  return (
    <aside
      className="flex h-full flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ width }}
    >
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-3">
        <h2 className="text-[length:var(--text-ui)] font-medium text-[var(--color-ink)]">
          Çeviri sırası
        </h2>
        <span className="tabular-nums text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
          {translated}/{items.length} çevrildi
        </span>
      </header>

      {empty ? (
        <EmptyState
          title="Bu sayfada balon yok"
          description="R ile kutu çizip metin ekleyin"
          actionLabel="Kutu çiz"
          onAction={() => setActiveTool('region')}
        />
      ) : (
        <div
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto"
          role="list"
        >
          {items.map((item, index) => {
            const selected =
              item.kind === 'bubble'
                ? selectedBubbleId === Number(item.id)
                : selectedRegionId === item.id
            const isRegion = item.kind === 'region'
            const region = isRegion
              ? edit.regions?.find((r) => r.id === item.id)
              : undefined
            const bubbleText =
              item.kind === 'bubble'
                ? (edit.bubbles[item.id]?.text ??
                  displayText(Number(item.id), doc.texts, {}))
                : ''
            const text = isRegion ? (region?.text ?? '') : bubbleText
            const hasOverlay =
              item.kind === 'bubble'
                ? Boolean(edit.bubbles[item.id]?.text?.trim())
                : Boolean(region?.text?.trim())

            return (
              <div
                key={`${item.kind}:${item.id}`}
                role="listitem"
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => {
                  e.preventDefault()
                }}
                onDrop={() => {
                  if (dragIndex != null) move(dragIndex, index)
                  setDragIndex(null)
                }}
                onDragEnd={() => setDragIndex(null)}
                className={cn(
                  'group flex flex-col gap-1 border-b border-[var(--color-border)] px-2 py-2 transition-[background-color,opacity] duration-150',
                  selected
                    ? 'bg-[var(--color-accent-soft)]'
                    : 'hover:bg-[var(--color-surface-muted)]',
                  dragIndex === index && 'opacity-60',
                )}
              >
                <div className="flex h-10 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Sırayı sürükle"
                    className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center text-[var(--color-ink-muted)] active:cursor-grabbing"
                    tabIndex={-1}
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
                    onClick={() => {
                      if (item.kind === 'bubble') onSelectBubble(Number(item.id))
                      else onSelectRegion(item.id)
                    }}
                  >
                    <span
                      className={cn(
                        'flex h-6 min-w-6 shrink-0 items-center justify-center rounded px-1 text-[length:var(--text-meta)] font-semibold tabular-nums',
                        isRegion
                          ? 'border border-dashed border-[var(--color-focus)] text-[var(--color-focus)]'
                          : 'bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]',
                      )}
                    >
                      {isRegion ? `R${index + 1}` : index + 1}
                    </span>
                    <span
                      className={cn(
                        'truncate text-[length:var(--text-ui)]',
                        hasOverlay
                          ? 'text-[var(--color-ink)]'
                          : 'text-[var(--color-ink-muted)]',
                      )}
                    >
                      {text.trim() || (isRegion ? 'Kutu metni…' : 'Çeviri…')}
                    </span>
                  </button>
                  {isRegion && (
                    <button
                      type="button"
                      aria-label="Kutuyu sil"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--color-ink-muted)] opacity-0 hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-danger)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] group-hover:opacity-100"
                      onClick={() => {
                        onDeleteRegion(item.id)
                        toast('Kutu silindi — ⌘Z ile geri alın', 'info')
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {selected && (
                  <div className="pl-7 pr-1 pb-1">
                    <BubbleTextArea
                      text={text}
                      layout={undefined}
                      onFocus={() => {
                        if (item.kind === 'bubble')
                          onSelectBubble(Number(item.id))
                        else onSelectRegion(item.id)
                      }}
                      onChange={(v) => {
                        if (item.kind === 'bubble')
                          onBubbleText(Number(item.id), v)
                        else onRegionText(item.id, v)
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </aside>
  )
}
