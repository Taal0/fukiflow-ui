import { useState } from 'react'
import type {
  Bubble,
  BubbleEdit,
  BubbleLayout,
  FontInfo,
  Layer,
  PageDoc,
} from '@/api/types'
import { cleanLayerId, textLayerId } from '@/api/types'
import { BubbleTextArea } from '@/components/bubbles/BubbleTextArea'
import { displayText, seedText } from '@/components/bubbles/bubbleUtils'
import { bubbleFlags } from '@/components/flags'
import { FontSelect } from '@/components/FontSelect'
import { LayerRow } from '@/components/LayerRow'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Stepper } from '@/components/ui/stepper'
import { Switch } from '@/components/ui/switch'
import { resolveFontPx } from '@/lib/bubbleFrame'
import {
  DEFAULT_INSET,
  INSET_MAX,
  INSET_MIN,
  resolveCleanInset,
} from '@/lib/paintStroke'
import { useSession } from '@/store/session'

const FONT_PX_MIN = 8
const FONT_PX_MAX = 96
const LEADING_MIN = 0.8
const LEADING_MAX = 2.0
const DEFAULT_LEADING = 1.15

interface BubbleInspectorProps {
  doc: PageDoc
  bubble: Bubble | null
  layout: BubbleLayout | undefined
  be: BubbleEdit | undefined
  fonts: FontInfo[]
  bubbleFont: string | null
  disabledLayerIds: Set<string>
  typesetPending?: boolean
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

function layerById(layers: Layer[], id: string): Layer | undefined {
  return layers.find((l) => l.id === id)
}

export function BubbleInspector({
  doc,
  bubble,
  layout,
  be,
  fonts,
  bubbleFont,
  disabledLayerIds,
  typesetPending,
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
}: BubbleInspectorProps) {
  const setActiveTool = useSession((s) => s.setActiveTool)
  const [focusText, setFocusText] = useState(false)

  if (!bubble) {
    return (
      <EmptyState
        title="Balon seçilmedi"
        description="Listeden bir balon seçin — metin, tipografi ve katmanlar burada düzenlenir."
      />
    )
  }

  const display =
    be?.text !== undefined
      ? be.text
      : displayText(bubble.id, doc.texts, {})
  const seed = seedText(bubble.id, doc.texts)
  const dirty = be?.text !== undefined
  const fontPx = resolveFontPx(be, layout)
  const leading = be?.leading ?? DEFAULT_LEADING
  const align = (be?.align as 'left' | 'center' | undefined) ?? 'center'
  const hasFrame = Boolean(be?.frame)
  const done = Boolean(be?.done)
  const flags = bubbleFlags(bubble, layout)
  const primary = flags[0]
  const isEditor = bubble.clean_status === 'editor'
  const clnId = cleanLayerId(bubble.id)
  const txtId = textLayerId(bubble.id)
  const clnLayer = layerById(doc.layers, clnId)
  const txtLayer = layerById(doc.layers, txtId)
  const clnOn =
    clnLayer != null &&
    clnLayer.enabled !== false &&
    !disabledLayerIds.has(clnId)
  const txtOn =
    txtLayer != null &&
    (layout ? layout.status === 'ok' : txtLayer.enabled !== false) &&
    !disabledLayerIds.has(txtId)
  const insetSeed = clnLayer?.mask?.inset ?? DEFAULT_INSET
  const insetCur = resolveCleanInset(insetSeed, be?.inset)

  const runPrimaryAction = () => {
    if (!primary) return
    switch (primary.action.kind) {
      case 'paint':
        setActiveTool('paint')
        break
      case 'frame':
        setActiveTool('frame')
        break
      case 'text':
        setFocusText(true)
        break
      case 'typeset':
        onAutoTypeset(bubble.id)
        break
    }
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[length:var(--text-title)] font-semibold text-[var(--color-ink)]">
          Sıra {bubble.reading_order ?? '—'}
          <span className="ml-1.5 font-normal text-[var(--color-ink-muted)]">
            #{bubble.id}
          </span>
        </h3>
        <label className="flex cursor-pointer items-center gap-1.5 text-[length:var(--text-ui)] text-[var(--color-ink)]">
          <Switch
            checked={done}
            onCheckedChange={(v) => onToggleDone(bubble.id, v)}
            aria-label="Bitti"
          />
          Bitti
        </label>
      </div>

      {flags.length > 0 && (
        <section className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
          <div className="flex flex-wrap items-center gap-1">
            {flags.map((f) => (
              <Badge key={f.code} variant={done ? 'default' : 'warn'}>
                {f.label}
              </Badge>
            ))}
          </div>
          {primary && (
            <p className="text-[length:var(--text-ui)] text-[var(--color-ink)]">
              {primary.hint}
            </p>
          )}
          {primary && !done && (
            <Button
              type="button"
              size="sm"
              className="self-start"
              disabled={
                primary.action.kind === 'typeset' &&
                (typesetPending || !display.trim())
              }
              onClick={runPrimaryAction}
            >
              {primary.action.label}
              {primary.action.kind === 'paint'
                ? ' (B)'
                : primary.action.kind === 'frame'
                  ? ' (M)'
                  : ''}
            </Button>
          )}
          <p className="text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
            Bitti işaretlemek incelemeyi kapatır
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h4 className="text-[length:var(--text-meta)] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Metin
        </h4>
        <BubbleTextArea
          key={`${bubble.id}-${focusText ? 'focus' : 'idle'}`}
          text={display}
          layout={layout}
          autoFocus={focusText}
          onFocus={() => {
            onSelect(bubble.id)
            setFocusText(false)
          }}
          onChange={(v) => onTextChange(bubble.id, v)}
        />
        {dirty && (
          <button
            type="button"
            onClick={() => onResetText(bubble.id)}
            className="self-start text-[length:var(--text-meta)] text-[var(--color-ink-muted)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
          >
            Özgün metne dön
            {seed
              ? ` (“${seed.slice(0, 24)}${seed.length > 24 ? '…' : ''}”)`
              : ''}
          </button>
        )}
        {layout?.overflow && (
          <p className="text-[length:var(--text-meta)] text-[var(--color-warn)]">
            Metin balondan taşıyor — bilinçli bırakabilirsiniz.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-[length:var(--text-meta)] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Tipografi
        </h4>
        <FontSelect
          fonts={fonts}
          value={bubbleFont}
          onChange={(key) => onBubbleFont(bubble.id, key)}
          allowEmpty
          emptyLabel="Sayfa fontu"
          title="Balon fontu"
          className="w-full"
        />
        <Stepper
          label="Px"
          value={fontPx}
          min={FONT_PX_MIN}
          max={FONT_PX_MAX}
          step={1}
          disabled={isEditor}
          onChange={(v) => onFontPx(bubble.id, Math.round(v))}
          showReset={be?.font_px != null}
          onReset={() => onFontPx(bubble.id, null)}
        />
        <Stepper
          label="Satır"
          value={leading}
          display={leading.toFixed(2)}
          min={LEADING_MIN}
          max={LEADING_MAX}
          step={0.05}
          disabled={isEditor}
          editable={false}
          onChange={(v) =>
            onLeading(
              bubble.id,
              Math.abs(v - DEFAULT_LEADING) < 0.001 ? null : v,
            )
          }
        />
        <div className="flex items-center gap-1.5">
          <span className="w-10 shrink-0 text-[length:var(--text-meta)] uppercase tracking-wide text-[var(--color-ink-muted)]">
            Hiza
          </span>
          <Segmented
            ariaLabel="Hiza"
            value={align}
            disabled={isEditor}
            className="flex-1"
            onChange={(v) => onAlign(bubble.id, v === 'center' ? null : v)}
            options={[
              { value: 'left', label: 'Sol' },
              { value: 'center', label: 'Orta' },
            ]}
          />
        </div>
      </section>

      {!isEditor && (
        <section className="flex flex-col gap-2">
          <h4 className="text-[length:var(--text-meta)] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Kutu
          </h4>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7"
              disabled={typesetPending || !display.trim()}
              onClick={() => onAutoTypeset(bubble.id)}
            >
              Oto dizgi
            </Button>
            {hasFrame && (
              <button
                type="button"
                className="text-[length:var(--text-meta)] text-[var(--color-ink-muted)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
                onClick={() => onResetFrame(bubble.id)}
              >
                Kutuyu balona sıfırla
              </button>
            )}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h4 className="text-[length:var(--text-meta)] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Katmanlar
        </h4>
        <LayerRow
          label="Clean"
          checked={clnOn}
          disabled={!clnLayer}
          onCheckedChange={(v) => onToggleLayer(clnId, v)}
        />
        {clnLayer && (
          <Stepper
            label="Inset"
            value={insetCur}
            display={`${insetCur}px`}
            min={INSET_MIN}
            max={INSET_MAX}
            step={1}
            disabled={!clnOn}
            editable={false}
            showReset={be?.inset != null}
            onReset={() => onInset(bubble.id, null)}
            onChange={(v) =>
              onInset(bubble.id, v === insetSeed ? null : Math.round(v))
            }
          />
        )}
        <LayerRow
          label="Metin"
          checked={txtOn}
          disabled={
            !txtLayer ||
            (layout ? layout.status !== 'ok' : txtLayer.enabled === false)
          }
          onCheckedChange={(v) => onToggleLayer(txtId, v)}
        />
      </section>
    </div>
  )
}
