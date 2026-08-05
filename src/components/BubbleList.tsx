import { useEffect, useRef, useState } from 'react'
import type {
  BrushState,
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
import { resolveFontPx } from '@/lib/bubbleFrame'
import {
  BRUSH_PRESETS,
  BRUSH_RADIUS_MAX,
  BRUSH_RADIUS_MIN,
  DEFAULT_INSET,
  INSET_MAX,
  INSET_MIN,
  resolveCleanInset,
} from '@/lib/paintStroke'
import { cn } from '@/lib/utils'

const FONT_PX_STEP = 1
const FONT_PX_MIN = 8
const FONT_PX_MAX = 96
const LEADING_STEP = 0.05
const LEADING_MIN = 0.8
const LEADING_MAX = 2.0
const DEFAULT_LEADING = 1.15
const INSET_STEP = 1

interface BubbleListProps {
  doc: PageDoc
  selectedBubbleId: number | null
  disabledLayerIds: Set<string>
  layoutsByBubble: Record<number, BubbleLayout>
  textOverrides: Record<number, string>
  bubbleFontOverrides: Record<number, string>
  bubbleEdits: Record<string, BubbleEdit>
  fonts: FontInfo[]
  brush: BrushState
  typesetPending?: boolean
  hideDone?: boolean
  onHideDoneChange?: (hide: boolean) => void
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
  onBrushMode: (mode: BrushState['mode']) => void
  onBrushRadius: (radiusPx: number) => void
  onClearPaint: (bubbleId: number) => void
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

/** The text as it is *currently* broken into lines on the page, one line per
 * row, so the sidebar box always mirrors what's rendered. `null` when there's
 * no successful layout yet (falls back to the flat override/seed text). */
function layoutFormattedText(layout: BubbleLayout | undefined): string | null {
  if (!layout || layout.status !== 'ok' || !layout.lines?.length) return null
  return layout.lines.map((l) => l.text).join('\n')
}

/** Text box that mirrors the current on-page line breaks while idle, so the
 * letterer can see + hand-edit wrapping (typed newlines = forced breaks),
 * but never fights the user's cursor while they're actively typing. */
function BubbleTextArea({
  text,
  layout,
  onFocus,
  onChange,
}: {
  text: string
  layout: BubbleLayout | undefined
  onFocus: () => void
  onChange: (text: string) => void
}) {
  const external = layoutFormattedText(layout) ?? text
  const [local, setLocal] = useState(external)
  const [focused, setFocused] = useState(false)
  const syncedRef = useRef(external)

  useEffect(() => {
    if (focused || external === syncedRef.current) return
    syncedRef.current = external
    setLocal(external)
  }, [external, focused])

  return (
    <textarea
      value={local}
      rows={3}
      spellCheck={false}
      onFocus={() => {
        setFocused(true)
        onFocus()
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setLocal(e.target.value)
        onChange(e.target.value)
      }}
      className="w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-1.5 text-xs leading-snug text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      placeholder="Balon metni…"
    />
  )
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
  bubbleEdits,
  fonts,
  brush,
  typesetPending,
  hideDone,
  onHideDoneChange,
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
  onBrushMode,
  onBrushRadius,
  onClearPaint,
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
            const be = bubbleEdits[String(bubble.id)]
            const text = displayText(bubble.id, doc.texts, textOverrides)
            const seed = seedText(bubble.id, doc.texts)
            const dirty = textOverrides[bubble.id] !== undefined
            const badges = bubbleBadges(bubble, layout)
            const clnId = cleanLayerId(bubble.id)
            const txtId = textLayerId(bubble.id)
            const clnLayer = layerById(doc.layers, clnId)
            const txtLayer = layerById(doc.layers, txtId)
            const selected = bubble.id === selectedBubbleId
            const fontPx = resolveFontPx(be, layout)
            const leading = be?.leading ?? DEFAULT_LEADING
            const align = (be?.align as 'left' | 'center' | undefined) ?? 'center'
            const hasFrame = Boolean(be?.frame)
            const done = Boolean(be?.done)
            const isEditor = bubble.clean_status === 'editor'

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
                    <BubbleTextArea
                      key={bubble.id}
                      text={text}
                      layout={layout}
                      onFocus={() => onSelect(bubble.id)}
                      onChange={(v) => onTextChange(bubble.id, v)}
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

                    {/* Font size px */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-10 shrink-0 text-[10px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                        Px
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 px-0"
                        aria-label="Küçült"
                        disabled={isEditor}
                        onClick={() => {
                          const next = Math.max(FONT_PX_MIN, fontPx - FONT_PX_STEP)
                          onFontPx(bubble.id, next)
                        }}
                      >
                        −
                      </Button>
                      <input
                        type="number"
                        min={FONT_PX_MIN}
                        max={FONT_PX_MAX}
                        value={fontPx}
                        disabled={isEditor}
                        onFocus={() => onSelect(bubble.id)}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          if (!Number.isFinite(v)) return
                          onFontPx(
                            bubble.id,
                            Math.min(FONT_PX_MAX, Math.max(FONT_PX_MIN, Math.round(v))),
                          )
                        }}
                        className="h-7 w-14 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-1.5 text-center text-[11px] tabular-nums text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 px-0"
                        aria-label="Büyüt"
                        disabled={isEditor}
                        onClick={() => {
                          const next = Math.min(FONT_PX_MAX, fontPx + FONT_PX_STEP)
                          onFontPx(bubble.id, next)
                        }}
                      >
                        +
                      </Button>
                      {be?.font_px != null && (
                        <button
                          type="button"
                          className="ml-1 text-[11px] text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]"
                          onClick={() => onFontPx(bubble.id, null)}
                        >
                          Sıfırla
                        </button>
                      )}
                    </div>

                    {/* Leading */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-10 shrink-0 text-[10px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                        Satır
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 px-0"
                        aria-label="Leading azalt"
                        disabled={isEditor}
                        onClick={() => {
                          const next = Math.max(
                            LEADING_MIN,
                            +(leading - LEADING_STEP).toFixed(2),
                          )
                          onLeading(
                            bubble.id,
                            Math.abs(next - DEFAULT_LEADING) < 0.001 ? null : next,
                          )
                        }}
                      >
                        −
                      </Button>
                      <span className="min-w-[3rem] text-center text-[11px] tabular-nums text-[var(--color-ink-muted)]">
                        {leading.toFixed(2)}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 px-0"
                        aria-label="Leading artır"
                        disabled={isEditor}
                        onClick={() => {
                          const next = Math.min(
                            LEADING_MAX,
                            +(leading + LEADING_STEP).toFixed(2),
                          )
                          onLeading(
                            bubble.id,
                            Math.abs(next - DEFAULT_LEADING) < 0.001 ? null : next,
                          )
                        }}
                      >
                        +
                      </Button>
                    </div>

                    {/* Align */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-10 shrink-0 text-[10px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                        Hiza
                      </span>
                      <Button
                        type="button"
                        variant={align === 'left' ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 flex-1 text-[11px]"
                        disabled={isEditor}
                        onClick={() => onAlign(bubble.id, 'left')}
                      >
                        Sol
                      </Button>
                      <Button
                        type="button"
                        variant={align === 'center' ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 flex-1 text-[11px]"
                        disabled={isEditor}
                        onClick={() => onAlign(bubble.id, null)}
                      >
                        Orta
                      </Button>
                    </div>

                    {/* Auto typeset + reset frame */}
                    {!isEditor && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          disabled={typesetPending || !text.trim()}
                          onClick={() => onAutoTypeset(bubble.id)}
                        >
                          Oto dizgi
                        </Button>
                        {hasFrame && (
                          <button
                            type="button"
                            className="text-[11px] text-[var(--color-ink-muted)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
                            onClick={() => onResetFrame(bubble.id)}
                          >
                            Kutuyu balona sıfırla
                          </button>
                        )}
                      </div>
                    )}

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
                    {clnLayer && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-10 shrink-0 text-[10px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                          Inset
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 px-0"
                          aria-label="Inset azalt"
                          disabled={!clnOn}
                          onClick={() => {
                            const seed = clnLayer.mask?.inset ?? DEFAULT_INSET
                            const cur = resolveCleanInset(seed, be?.inset)
                            const next = Math.max(INSET_MIN, cur - INSET_STEP)
                            onInset(
                              bubble.id,
                              next === seed ? null : next,
                            )
                          }}
                        >
                          −
                        </Button>
                        <span className="min-w-[2.5rem] text-center text-[11px] tabular-nums text-[var(--color-ink-muted)]">
                          {resolveCleanInset(
                            clnLayer.mask?.inset ?? DEFAULT_INSET,
                            be?.inset,
                          )}
                          px
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 px-0"
                          aria-label="Inset artır"
                          disabled={!clnOn}
                          onClick={() => {
                            const seed = clnLayer.mask?.inset ?? DEFAULT_INSET
                            const cur = resolveCleanInset(seed, be?.inset)
                            const next = Math.min(INSET_MAX, cur + INSET_STEP)
                            onInset(
                              bubble.id,
                              next === seed ? null : next,
                            )
                          }}
                        >
                          +
                        </Button>
                        {be?.inset != null && (
                          <button
                            type="button"
                            className="ml-1 text-[11px] text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]"
                            onClick={() => onInset(bubble.id, null)}
                          >
                            Sıfırla
                          </button>
                        )}
                      </div>
                    )}
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

                    {/* Brush tool — only when this bubble is selected */}
                    {selected && (
                      <div className="flex flex-col gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-2">
                        <span className="text-[10px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                          Fırça
                        </span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant={brush.mode === 'off' ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 flex-1 text-[11px]"
                            onClick={() => onBrushMode('off')}
                          >
                            Kapalı
                          </Button>
                          <Button
                            type="button"
                            variant={brush.mode === 'fill' ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 flex-1 text-[11px]"
                            onClick={() => onBrushMode('fill')}
                            title="Tıklanan pikselden renk alıp boya"
                          >
                            Boya
                          </Button>
                          <Button
                            type="button"
                            variant={
                              brush.mode === 'restore' ? 'default' : 'outline'
                            }
                            size="sm"
                            className="h-7 flex-1 text-[11px]"
                            onClick={() => onBrushMode('restore')}
                            title="Orijinal pikseli geri getir"
                          >
                            Geri al
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {BRUSH_PRESETS.map((px) => (
                            <Button
                              key={px}
                              type="button"
                              variant={
                                brush.radiusPx === px ? 'default' : 'outline'
                              }
                              size="sm"
                              className="h-7 min-w-[2rem] px-1.5 text-[11px] tabular-nums"
                              onClick={() => onBrushRadius(px)}
                            >
                              {px}
                            </Button>
                          ))}
                          <input
                            type="number"
                            min={BRUSH_RADIUS_MIN}
                            max={BRUSH_RADIUS_MAX}
                            value={brush.radiusPx}
                            onChange={(e) => {
                              const v = Number(e.target.value)
                              if (!Number.isFinite(v)) return
                              onBrushRadius(
                                Math.min(
                                  BRUSH_RADIUS_MAX,
                                  Math.max(BRUSH_RADIUS_MIN, Math.round(v)),
                                ),
                              )
                            }}
                            className="h-7 w-12 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-1 text-center text-[11px] tabular-nums text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                            aria-label="Fırça boyutu px"
                          />
                          {brush.mode === 'fill' && brush.color && (
                            <span
                              className="ml-auto h-5 w-5 rounded border border-[var(--color-border)]"
                              style={{
                                background: `rgb(${brush.color[0]}, ${brush.color[1]}, ${brush.color[2]})`,
                              }}
                              title="Son örneklenen renk"
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          className="self-start text-[11px] text-[var(--color-ink-muted)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
                          onClick={() => onClearPaint(bubble.id)}
                        >
                          Bu balonun boyasını sil
                        </button>
                      </div>
                    )}

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
