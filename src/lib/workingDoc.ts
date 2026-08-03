import type { Layer, PageDoc, PageDetail } from '@/api/types'
import type { PageSession } from '@/store/session'
import type { TypesetBody } from '@/api/client'

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
  pageFont: string | null,
): TypesetBody {
  const textOverrides = session?.textOverrides ?? {}
  const sizeOverrides = session?.sizeOverrides ?? {}
  const bubbleFonts = session?.bubbleFontOverrides ?? {}

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
  const bubbleIds = new Set([
    ...Object.keys(sizeOverrides).map(Number),
    ...Object.keys(bubbleFonts).map(Number),
  ])
  for (const id of bubbleIds) {
    const entry: { font_scale?: number; font?: string } = {}
    const scale = sizeOverrides[id]
    if (scale != null && scale !== 1) entry.font_scale = scale
    const font = bubbleFonts[id]
    if (font) entry.font = font
    if (Object.keys(entry).length) overrides[String(id)] = entry
  }

  return {
    texts,
    font: pageFont || undefined,
    overrides: Object.keys(overrides).length ? overrides : undefined,
  }
}

export function disabledOffList(session: PageSession | undefined): string[] {
  if (!session) return []
  return [...session.disabledLayerIds]
}
