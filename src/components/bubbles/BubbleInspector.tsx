import { useState, type ReactNode } from 'react'
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
import { cn } from '@/lib/utils'

const FONT_PX_MIN = 8
const FONT_PX_MAX = 96
const LEADING_MIN = 0.8
const LEADING_MAX = 2.0
const DEFAULT_LEADING = 1.15

interface BubbleInspectorProps {
  doc: PageDoc
  bubble: Bubble
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
  onClearTypeset?: (bubbleId: number) => void
  onToggleDone: (bubbleId: number, done: boolean) => void
  onInset: (bubbleId: number, inset: number | null) => void
}

function layerById(layers: Layer[], id: string): Layer | undefined {
  return layers.find((l) => l.id === id)
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="w-10 shrink-0 text-[length:var(--text-meta)] uppercase tracking-wide text-[var(--color-ink-muted)]">
      {children}
    </span>
  )
}

function LayerToggle({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <label
      className={cn(
        'flex h-7 cursor-pointer items-center justify-between gap-2 text-[length:var(--text-ui)] text-[var(--color-ink)]',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span>{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </label>
  )
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
  onClearTypeset,
  onToggleDone,
  onInset,
}: BubbleInspectorProps) {
  const setActiveTool = useSession((s) => s.setActiveTool)
  const [focusText, setFocusText] = useState(false)

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
  const typesetTry = Boolean(be?.typeset_try)
  const typesetControls = !isEditor || typesetTry
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
  const hasTypesetResult = Boolean(layout && layout.status === 'ok')

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
    <div className="flex flex-col">
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border)] px-2.5">
        <h3 className="min-w-0 truncate text-[length:var(--text-ui)] font-semibold text-[var(--color-ink)]">
          Sıra {bubble.reading_order ?? '—'}
          <span className="ml-1 font-normal tabular-nums text-[var(--color-ink-muted)]">
            #{bubble.id}
          </span>
        </h3>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
          <span>Bitti</span>
          <Switch
            checked={done}
            onCheckedChange={(v) => onToggleDone(bubble.id, v)}
            aria-label="Bitti"
          />
        </label>
      </header>

      <div className="flex flex-col gap-2 px-2.5 py-2">
        {flags.length > 0 && (
          <section className="flex flex-col gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
            <div className="flex flex-wrap items-center gap-1">
              {flags.map((f) => (
                <Badge key={f.code} variant={done ? 'default' : 'warn'}>
                  {f.label}
                </Badge>
              ))}
            </div>
            {primary && (
              <div className="flex flex-col gap-1.5">
                {!done && (
                  <Button
                    type="button"
                    size="sm"
                    className="h-6 w-full px-2 text-[length:var(--text-meta)]"
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
                <p className="min-w-0 text-[length:var(--text-meta)] leading-snug text-[var(--color-ink-muted)]">
                  {primary.hint}
                </p>
              </div>
            )}
          </section>
        )}

        <section className="flex flex-col gap-1 border-t border-[var(--color-border)] pt-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1">
            <label
              className={cn(
                'flex h-7 shrink-0 cursor-pointer items-center gap-1.5 text-[length:var(--text-ui)] text-[var(--color-ink)]',
                !clnLayer && 'cursor-not-allowed opacity-50',
              )}
            >
              <span>Clean</span>
              <Switch
                checked={clnOn}
                onCheckedChange={(v) => onToggleLayer(clnId, v)}
                disabled={!clnLayer}
                aria-label="Clean"
              />
            </label>
            {clnLayer && (
              <Stepper
                label="Inset"
                compact
                className="min-w-0 flex-1"
                value={insetCur}
                display={`${insetCur}`}
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
          </div>
          <LayerToggle
            label="Metin"
            checked={txtOn}
            disabled={
              !txtLayer ||
              (layout ? layout.status !== 'ok' : txtLayer.enabled === false)
            }
            onCheckedChange={(v) => onToggleLayer(txtId, v)}
          />
        </section>


        <section className="flex flex-col gap-1.5 border-t border-[var(--color-border)] pt-2">
          <div className="grid gap-2 min-[320px]:grid-cols-1 md:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-1 min-w-0">
              <BubbleTextArea
                key={`${bubble.id}-${focusText ? 'focus' : 'idle'}`}
                text={display}
                layout={layout}
                rows={3}
                autoFocus={focusText}
                className="min-h-[4.5rem] resize-y"
                onFocus={() => {
                  onSelect(bubble.id)
                  setFocusText(false)
                }}
                onChange={(v) => onTextChange(bubble.id, v)}
              />
              {layout?.overflow && (
                <span className="text-[length:var(--text-meta)] text-[var(--color-warn)]">
                  Taşma
                </span>
              )}
            </div>

            <div className="flex min-w-[8rem] flex-col gap-1">
              <FontSelect
                fonts={fonts}
                value={bubbleFont}
                onChange={(key) => onBubbleFont(bubble.id, key)}
                allowEmpty
                emptyLabel="Sayfa fontu"
                title="Balon fontu"
                className="h-7 w-full"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-full px-2 text-[length:var(--text-meta)]"
                disabled={!dirty}
                onClick={() => onResetText(bubble.id)}
                title={
                  seed
                    ? `Özgün: “${seed.slice(0, 30)}${seed.length > 30 ? '…' : ''}”`
                    : undefined
                }
              >
                Özgün metne dön
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Stepper
              label="Px"
              compact
              className="flex-1 min-w-[8rem]"
              value={fontPx}
              min={FONT_PX_MIN}
              max={FONT_PX_MAX}
              step={1}
              disabled={!typesetControls}
              onChange={(v) => onFontPx(bubble.id, Math.round(v))}
              showReset={be?.font_px != null}
              onReset={() => onFontPx(bubble.id, null)}
            />
            <Stepper
              label="Satır"
              compact
              className="flex-1 min-w-[8rem]"
              value={leading}
              display={leading.toFixed(2)}
              min={LEADING_MIN}
              max={LEADING_MAX}
              step={0.05}
              disabled={!typesetControls}
              editable={false}
              onChange={(v) =>
                onLeading(
                  bubble.id,
                  Math.abs(v - DEFAULT_LEADING) < 0.001 ? null : v,
                )
              }
            />
          </div>

          {isEditor && !typesetTry && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[length:var(--text-meta)]"
                disabled={typesetPending || !display.trim()}
                onClick={() => onAutoTypeset(bubble.id)}
                title="Temizlenmiş zeminde otomatik dizgi dene"
              >
                Dizgi dene
              </Button>
            </div>
          )}

          {typesetControls && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-[8rem]">
                <FieldLabel>Hiza</FieldLabel>
                <Segmented
                  ariaLabel="Hiza"
                  value={align}
                  fill
                  className="min-w-0 flex-1"
                  onChange={(v) => onAlign(bubble.id, v === 'center' ? null : v)}
                  options={[
                    { value: 'left', label: 'Sol' },
                    { value: 'center', label: 'Orta' },
                  ]}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[length:var(--text-meta)]"
                disabled={typesetPending || !display.trim()}
                onClick={() => onAutoTypeset(bubble.id)}
              >
                {isEditor ? 'Yeniden diz' : 'Oto dizgi'}
              </Button>
              {isEditor && (typesetTry || hasTypesetResult) && onClearTypeset && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[length:var(--text-meta)]"
                  onClick={() => onClearTypeset(bubble.id)}
                  title="Deneme dizgisini kaldır"
                >
                  Kaldır
                </Button>
              )}
              {hasFrame && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[length:var(--text-meta)]"
                  onClick={() => onResetFrame(bubble.id)}
                >
                  Sıfırla
                </Button>
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
