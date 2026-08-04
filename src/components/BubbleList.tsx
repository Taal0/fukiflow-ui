import { useEffect, useRef } from 'react'
import type {
  Bubble,
  BubbleEdit,
  BubbleLayout,
  BubbleText,
  FontInfo,
  Layer,
  PageDoc,
} from '@/api/types'
import { cleanLayerId, textLayerId } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FontSelect } from '@/components/FontSelect'
import { LayerRow } from '@/components/LayerRow'
import { reasonLabel } from '@/components/flags'
import { cn } from '@/lib/utils'

const SIZE_STEP = 0.05
const SIZE_MIN = 0.5
const SIZE_MAX = 2

interface BubbleListProps {
  doc: PageDoc
  selectedBubbleId: number | null
  disabledLayerIds: Set<string>
  layoutsByBubble: Record<number, BubbleLayout>
  textOverrides: Record<number, string>
  bubbleFontOverrides: Record<number, string>
  sizeOverrides: Record<number, number>
  bubbleEdits: Record<string, BubbleEdit>
  fonts: FontInfo[]
  typesetPending?: boolean
  hideDone?: boolean
  onHideDoneChange?: (hide: boolean) => void
  onSelect: (bubbleId: number) => void
  onToggleLayer: (layerId: string, enabled: boolean) => void
  onTextChange: (bubbleId: number, text: string) => void
  onResetText: (bubbleId: number) => void
  onBubbleFont: (bubbleId: number, fontKey: string | null) => void
  onSizeChange: (bubbleId: number, scale: number | null) => void
  onToggleDone: (bubbleId: number, done: boolean) => void
}

function seedText(bubbleId: number, texts: BubbleText[]): string {
  return texts.find((t) => t.bubble_id === bubbleId)?.text ?? ''
}

function displayText(
  bubbleId: number,
  texts: BubbleText[],
  overrides: Record<number, string>,
): string {
  if (overrides[bubbleId] !== undefined) return overrides[bubbleId]!
  return seedText(bubbleId, texts)
}

function bubbleBadges(bubble: Bubble, layout: BubbleLayout | undefined): string[] {
  const out: string[] = []
  if (bubble.clean_status === 'editor') {
    const t = reasonLabel('clean_editor')
    if (t) out.push(t)
  }
  if (layout?.status === 'editor' || layout?.reason) {
    const t = reasonLabel(layout.reason ?? 'editor')
    if (t && !out.includes(t)) out.push(t)
  }
  if (layout?.overflow) out.push('Taşma')
  return out
}

function layerById(layers: Layer[], id: string): Layer | undefined {
  return layers.find((l) => l.id === id)
}

export function BubbleList({
  doc,
  selectedBubbleId,
  disabledLayerIds,
  layoutsByBubble,
  textOverrides,
  bubbleFontOverrides,
  sizeOverrides,
  bubbleEdits,
  fonts,
  typesetPending,
  hideDone,
  onHideDoneChange,
  onSelect,
  onToggleLayer,
  onTextChange,
  onResetText,
  onBubbleFont,
  onSizeChange,
  onToggleDone,
}: BubbleListProps) {
  const listRef = useRef<HTMLDivElement>(null)

  const bubbles = [...doc.bubbles].sort((a, b) => {
    const ra = a.reading_order ?? a.id
    const rb = b.reading_order ?? b.id
    return ra - rb
  })

  const doneCount = bubbles.filter(
    (b) => bubbleEdits[String(b.id)]?.done,
  ).length

  const visible = hideDone
    ? bubbles.filter((b) => !bubbleEdits[String(b.id)]?.done)
    : bubbles

  useEffect(() => {
    const node = listRef.current?.querySelector('[data-selected="true"]')
    node?.scrollIntoView({ block: 'nearest' })
  }, [selectedBubbleId])

  return (
    <aside className="flex h-full w-[22rem] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Balonlar
          </h2>
          <p className="text-[11px] text-[var(--color-ink-muted)]">
            {doneCount}/{bubbles.length} bitti
          </p>
        </div>
        <div className="flex items-center gap-2">
          {typesetPending && (
            <span className="text-[11px] text-[var(--color-ink-muted)]">
              Dizgi…
            </span>
          )}
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--color-ink-muted)]">
            <input
              type="checkbox"
              checked={Boolean(hideDone)}
              onChange={(e) => onHideDoneChange?.(e.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            Bitmeyenler
          </label>
        </div>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-1.5">
          {visible.map((bubble) => {
            const order = bubble.reading_order ?? '—'
            const layout =
              layoutsByBubble[bubble.id] ??
              layerById(doc.layers, textLayerId(bubble.id))?.layout ??
              undefined
            const text = displayText(bubble.id, doc.texts, textOverrides)
            const seed = seedText(bubble.id, doc.texts)
            const dirty = textOverrides[bubble.id] !== undefined
            const badges = bubbleBadges(bubble, layout)
            const clnId = cleanLayerId(bubble.id)
            const txtId = textLayerId(bubble.id)
            const clnLayer = layerById(doc.layers, clnId)
            const txtLayer = layerById(doc.layers, txtId)
            const selected = bubble.id === selectedBubbleId
            const scale = sizeOverrides[bubble.id] ?? 1
            const pct = Math.round(scale * 100)
            const done = Boolean(bubbleEdits[String(bubble.id)]?.done)

            const clnOn =
              clnLayer != null &&
              clnLayer.enabled !== false &&
              !disabledLayerIds.has(clnId)
            const txtOn =
              txtLayer != null &&
              (layout ? layout.status === 'ok' : txtLayer.enabled !== false) &&
              !disabledLayerIds.has(txtId)

            return (
              <li key={bubble.id}>
                <div
                  data-selected={selected || undefined}
                  className={cn(
                    'w-full rounded-md border px-2.5 py-2 transition-colors',
                    selected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                      : 'border-transparent hover:bg-[var(--color-surface-muted)]',
                    done && !selected && 'opacity-70',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(bubble.id)}
                    className="mb-1.5 flex w-full items-start gap-2 text-left"
                  >
                    <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--color-surface-muted)] text-[11px] font-semibold tabular-nums text-[var(--color-ink)]">
                      {order}
                      {typesetPending && selected && (
                        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-[var(--color-ink-muted)]">
                      <span>Balon {bubble.id}</span>
                      {done && (
                        <Badge variant="ok">Bitti</Badge>
                      )}
                    </span>
                  </button>

                  {badges.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1 pl-7">
                      {badges.map((b) => (
                        <Badge key={b} variant="warn">
                          {b}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pl-7">
                    <textarea
                      value={text}
                      rows={3}
                      spellCheck={false}
                      onFocus={() => onSelect(bubble.id)}
                      onChange={(e) => onTextChange(bubble.id, e.target.value)}
                      className="w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-1.5 text-xs leading-snug text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                      placeholder="Balon metni…"
                    />
                    {dirty && (
                      <button
                        type="button"
                        onClick={() => onResetText(bubble.id)}
                        className="self-start text-[11px] text-[var(--color-ink-muted)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
                      >
                        Seed metne dön
                        {seed ? ` (“${seed.slice(0, 24)}${seed.length > 24 ? '…' : ''}”)` : ''}
                      </button>
                    )}

                    <div className="flex items-center gap-2">
                      <FontSelect
                        fonts={fonts}
                        value={bubbleFontOverrides[bubble.id] ?? null}
                        onChange={(key) => onBubbleFont(bubble.id, key)}
                        allowEmpty
                        emptyLabel="Sayfa fontu"
                        title="Balon fontu"
                        className="min-w-0 flex-1"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 px-0"
                        aria-label="Küçült"
                        onClick={() => {
                          const next = Math.max(SIZE_MIN, +(scale - SIZE_STEP).toFixed(2))
                          onSizeChange(bubble.id, next === 1 ? null : next)
                        }}
                      >
                        −
                      </Button>
                      <span className="min-w-[3rem] text-center text-[11px] tabular-nums text-[var(--color-ink-muted)]">
                        %{pct}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 px-0"
                        aria-label="Büyüt"
                        onClick={() => {
                          const next = Math.min(SIZE_MAX, +(scale + SIZE_STEP).toFixed(2))
                          onSizeChange(bubble.id, next === 1 ? null : next)
                        }}
                      >
                        +
                      </Button>
                      {scale !== 1 && (
                        <button
                          type="button"
                          className="ml-1 text-[11px] text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]"
                          onClick={() => onSizeChange(bubble.id, null)}
                        >
                          Sıfırla
                        </button>
                      )}
                    </div>

                    {layout?.overflow && (
                      <p className="text-[11px] text-[var(--color-warn)]">
                        Metin balondan taşıyor — bilinçli bırakabilirsiniz.
                      </p>
                    )}

                    <LayerRow
                      label="Clean"
                      checked={clnOn}
                      disabled={!clnLayer}
                      onCheckedChange={(v) => onToggleLayer(clnId, v)}
                    />
                    <LayerRow
                      label="Metin"
                      checked={txtOn}
                      disabled={
                        !txtLayer ||
                        (layout
                          ? layout.status !== 'ok'
                          : txtLayer.enabled === false)
                      }
                      onCheckedChange={(v) => onToggleLayer(txtId, v)}
                    />

                    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[var(--color-ink)]">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={(e) => onToggleDone(bubble.id, e.target.checked)}
                        className="accent-[var(--color-accent)]"
                      />
                      Bitti
                    </label>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
