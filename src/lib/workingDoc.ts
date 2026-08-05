import type { BBox, Layer, PageDoc, PageDetail, PageEdit } from '@/api/types'
import type { PageSession } from '@/store/session'
import {
  bubbleFontsFromEdit,
  disabledLayerIdsFromEdit,
  pageFontFromEdit,
  sizeOverridesFromEdit,
  textOverridesFromEdit,
} from '@/store/session'
import type { TypesetBody } from '@/api/client'
import { resolveBubbleFrame } from '@/lib/bubbleFrame'

/** Merge session typeset layers into the seed PageDoc for compose/download. */
export function buildWorkingDoc(
  seed: PageDoc,
  session: PageSession | undefined,
): PageDoc {
  if (!session?.textLayers?.length) {
    // Still apply layout overlays onto existing text layers when present.
    if (!session || !Object.keys(session.layoutsByBubble).length) return seed
    return {
      ...seed,
      layers: seed.layers.map((layer) => {
        if (layer.kind !== 'text' || layer.bubble_id == null) return layer
        const lay = session.layoutsByBubble[layer.bubble_id]
        return lay ? { ...layer, layout: lay, enabled: lay.status === 'ok' } : layer
      }),
    }
  }

  const byId = new Map(session.textLayers.map((l) => [l.id, l]))
  const layers: Layer[] = seed.layers.map((layer) => {
    if (layer.kind !== 'text') return layer
    const updated = byId.get(layer.id)
    if (!updated) return layer
    byId.delete(layer.id)
    return updated
  })
  // Append any new text layers not in seed (shouldn't happen, but safe).
  for (const leftover of byId.values()) layers.push(leftover)

  return { ...seed, layers }
}

export function buildTypesetBody(
  detail: PageDetail,
  session: PageSession | undefined,
  pageFont?: string | null,
  opts?: {
    /** Force-include frame/font_px for specific bubbles (auto typeset). */
    forceBubbleIds?: number[]
    /** Materialized font_px / frame for force path. */
    forceOverrides?: Record<
      number,
      { font_px?: number; frame?: BBox }
    >
  },
): TypesetBody {
  const edit = session?.edit
  const textOverrides = textOverridesFromEdit(edit)
  const sizeOverrides = sizeOverridesFromEdit(edit)
  const bubbleFonts = bubbleFontsFromEdit(edit)
  const resolvedPageFont =
    pageFont !== undefined ? pageFont : pageFontFromEdit(edit)

  const texts = detail.doc.texts.map((t) => ({
    bubble_id: t.bubble_id,
    text:
      textOverrides[t.bubble_id] !== undefined
        ? textOverrides[t.bubble_id]!
        : (t.text ?? ''),
  }))

  // Include bubbles that have overrides but no seed text row.
  const seen = new Set(texts.map((t) => t.bubble_id))
  for (const bubble of detail.doc.bubbles) {
    if (seen.has(bubble.id)) continue
    if (textOverrides[bubble.id] !== undefined) {
      texts.push({ bubble_id: bubble.id, text: textOverrides[bubble.id]! })
    }
  }

  const overrides: NonNullable<TypesetBody['overrides']> = {}

  // The editable text box always drives layout — its current position and
  // size (letterer-set, or the largest rect inscribed in the bubble polygon
  // by default) is sent on every typeset call, not only after the letterer
  // explicitly touches it. `resolveBubbleFrame` never falls back to the bare
  // `bbox` for round/tailed bubbles — see `computeDefaultFrame` — so this
  // stays safe without needing to gate it behind a manual edit.
  for (const bubble of detail.doc.bubbles) {
    const id = bubble.id
    const be = edit?.bubbles[String(id)]
    const forced = opts?.forceOverrides?.[id]
    const entry: NonNullable<TypesetBody['overrides']>[string] = {}

    const scale = sizeOverrides[id]
    if (scale != null && scale !== 1 && forced?.font_px == null && be?.font_px == null) {
      entry.font_scale = scale
    }
    const font = bubbleFonts[id]
    if (font) entry.font = font

    const fontPx = forced?.font_px ?? be?.font_px
    if (fontPx != null) entry.font_px = fontPx

    entry.frame = forced?.frame ?? resolveBubbleFrame(bubble, be)

    if (be?.leading != null) entry.leading = be.leading
    if (be?.align) entry.align = be.align

    overrides[String(id)] = entry
  }

  return {
    texts,
    font: resolvedPageFont || undefined,
    overrides: Object.keys(overrides).length ? overrides : undefined,
  }
}

export function disabledOffList(session: PageSession | undefined): string[] {
  if (!session) return []
  return [...disabledLayerIdsFromEdit(session.edit)]
}

/** Payload shape for PUT /api/pages/:id/edit */
export function editPayload(edit: PageEdit): PageEdit {
  return {
    rev: edit.rev,
    page: edit.page ?? {},
    bubbles: edit.bubbles ?? {},
    paint: edit.paint ?? [],
  }
}
