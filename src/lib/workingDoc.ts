import type {
  BBox,
  BubbleLayout,
  Layer,
  PageDoc,
  PageDetail,
  PageEdit,
  PaintStroke,
  Region,
} from '@/api/types'
import type { PageSession } from '@/store/session'
import {
  bubbleFontsFromEdit,
  disabledLayerIdsFromEdit,
  pageFontFromEdit,
  sizeOverridesFromEdit,
  textOverridesFromEdit,
} from '@/store/session'
import { api, type TypesetBody } from '@/api/client'
import { resolveBubbleFrame } from '@/lib/bubbleFrame'
import { paintLayerId } from '@/api/types'

const PAINT_Z_BASE = 150
const ORDER_BUBBLE_RE = /^b:(\d+)$/
const REGION_ID_RE = /^r-[A-Za-z0-9_-]{2,32}$/

export type OrderedItem =
  | { kind: 'bubble'; id: string }
  | { kind: 'region'; id: string }

/** Minimal session fields needed to build a compose/working doc. */
export type WorkingSessionBits = {
  edit?: PageEdit
  textLayers?: Layer[] | null
  layoutsByBubble?: Record<number, BubbleLayout>
}

export function removedBubbleSet(
  edit: PageEdit | null | undefined,
): Set<number> {
  return new Set(edit?.removed_bubbles ?? [])
}

/**
 * Unified reading-order items (parity with server ``ordered_items``).
 * Tokens in ``edit.order`` first; remaining seed bubbles by reading_order;
 * remaining regions in array order.
 */
export function orderedItems(
  doc: PageDoc,
  edit: PageEdit | null | undefined,
): OrderedItem[] {
  const removed = removedBubbleSet(edit)
  const regions = (edit?.regions ?? []).filter(
    (r) => !(r.status === 'confirmed' && r.bubble_id != null),
  )
  const regionIds = new Set(regions.map((r) => r.id))
  const bubbleIds = new Set(
    doc.bubbles.filter((b) => !removed.has(b.id)).map((b) => b.id),
  )

  const items: OrderedItem[] = []
  const seenBubbles = new Set<number>()
  const seenRegions = new Set<string>()

  for (const token of edit?.order ?? []) {
    const m = ORDER_BUBBLE_RE.exec(token)
    if (m) {
      const bid = Number(m[1])
      if (bubbleIds.has(bid) && !seenBubbles.has(bid)) {
        seenBubbles.add(bid)
        items.push({ kind: 'bubble', id: String(bid) })
      }
      continue
    }
    if (REGION_ID_RE.test(token) && regionIds.has(token) && !seenRegions.has(token)) {
      seenRegions.add(token)
      items.push({ kind: 'region', id: token })
    }
  }

  const remaining = doc.bubbles
    .filter((b) => !removed.has(b.id) && !seenBubbles.has(b.id))
    .slice()
    .sort((a, b) => {
      const ra = a.reading_order
      const rb = b.reading_order
      if (ra == null && rb == null) return a.id - b.id
      if (ra == null) return 1
      if (rb == null) return -1
      return ra - rb || a.id - b.id
    })
  for (const b of remaining) {
    items.push({ kind: 'bubble', id: String(b.id) })
  }

  for (const r of regions) {
    if (!seenRegions.has(r.id)) {
      seenRegions.add(r.id)
      items.push({ kind: 'region', id: r.id })
    }
  }

  return items
}

/**
 * Renumber bubble ``reading_order`` from the unified list (1..N).
 * Regions occupy slots but are not injected into the PageDoc.
 * No-op when both ``order`` and ``regions`` are empty (legacy overlays).
 */
export function applyReadingOrder(
  doc: PageDoc,
  edit: PageEdit | null | undefined,
): PageDoc {
  if (!edit) return doc
  const hasOrder = (edit.order?.length ?? 0) > 0
  const hasRegions = (edit.regions?.length ?? 0) > 0
  if (!hasOrder && !hasRegions) return doc

  const items = orderedItems(doc, edit)
  const bubblePos = new Map<number, number>()
  items.forEach((item, i) => {
    if (item.kind === 'bubble') bubblePos.set(Number(item.id), i + 1)
  })

  return {
    ...doc,
    bubbles: doc.bubbles.map((b) => {
      const ro = bubblePos.get(b.id)
      if (ro == null) return b
      return { ...b, reading_order: ro, order_source: 'manual' }
    }),
  }
}

/** Merge session typeset + paint/inset overlays into the seed PageDoc. */
export function buildWorkingDoc(
  seed: PageDoc,
  session: WorkingSessionBits | PageSession | undefined,
): PageDoc {
  let doc = seed
  if (session?.textLayers?.length) {
    const byId = new Map(session.textLayers.map((l) => [l.id, l]))
    const layers: Layer[] = seed.layers.map((layer) => {
      if (layer.kind !== 'text') return layer
      const updated = byId.get(layer.id)
      if (!updated) return layer
      byId.delete(layer.id)
      return updated
    })
    for (const leftover of byId.values()) layers.push(leftover)
    doc = { ...seed, layers }
  } else if (session && session.layoutsByBubble && Object.keys(session.layoutsByBubble).length) {
    doc = {
      ...seed,
      layers: seed.layers.map((layer) => {
        if (layer.kind !== 'text' || layer.bubble_id == null) return layer
        const lay = session.layoutsByBubble![layer.bubble_id]
        return lay ? { ...layer, layout: lay, enabled: lay.status === 'ok' } : layer
      }),
    }
  }

  doc = applyEditLayers(doc, session?.edit)
  doc = applyReadingOrder(doc, session?.edit)

  const removed = removedBubbleSet(session?.edit)
  if (removed.size === 0) return doc

  return {
    ...doc,
    bubbles: doc.bubbles.filter((b) => !removed.has(b.id)),
    texts: doc.texts.filter((t) => !removed.has(t.bubble_id)),
    layers: doc.layers.filter(
      (l) => l.bubble_id == null || !removed.has(l.bubble_id),
    ),
  }
}

/** True when overlay fields require a typeset pass (not paint/inset alone). */
export function editAffectsTypeset(edit: PageEdit | null | undefined): boolean {
  if (!edit) return false
  if (edit.page?.font) return true
  for (const be of Object.values(edit.bubbles ?? {})) {
    if (be.text !== undefined) return true
    if (be.font) return true
    if (be.font_px != null) return true
    if (be.font_scale != null && be.font_scale !== 1) return true
    if (be.frame) return true
    if (be.leading != null) return true
    if (be.align) return true
  }
  return false
}

function hasTypesetCache(session: WorkingSessionBits | undefined): boolean {
  if (!session) return false
  if (session.textLayers && session.textLayers.length > 0) return true
  if (session.layoutsByBubble && Object.keys(session.layoutsByBubble).length > 0) {
    return true
  }
  return false
}

/**
 * Build compose payload for one page, preferring live session state when
 * hydrated, otherwise the PageEdit from GET /pages/:id (DB).
 *
 * Unvisited pages previously fell back to the seed doc alone — that is what
 * made chapter zip export the original instead of the saved overlay.
 */
export async function buildComposePayloadForPage(
  pageDetail: PageDetail,
  session: PageSession | undefined,
): Promise<{
  page_id: number
  doc: PageDoc
  off: string[]
  font: string | null
}> {
  const seed = pageDetail.doc
  // Prefer live session overlay when hydrated (covers unsaved edits).
  // Otherwise use the PageEdit returned with the page (DB).
  const edit: PageEdit =
    session?.hydrated
      ? session.edit
      : (pageDetail.edit ?? {
          rev: pageDetail.edit_rev ?? 0,
          page: {},
          bubbles: {},
          paint: [],
          regions: [],
          order: [],
          removed_bubbles: [],
        })

  let textLayers = session?.hydrated ? session.textLayers : null
  let layoutsByBubble = session?.hydrated ? session.layoutsByBubble : {}

  const bits: WorkingSessionBits = { edit, textLayers, layoutsByBubble }

  if (editAffectsTypeset(edit) && !hasTypesetCache(bits)) {
    const body = buildTypesetBody(pageDetail, { edit } as PageSession)
    const result = await api.typeset(pageDetail.page.id, body)
    textLayers = result.text_layers ?? null
    layoutsByBubble = {}
    for (const lay of result.layouts ?? []) {
      layoutsByBubble[lay.bubble_id] = lay
    }
  }

  const working: WorkingSessionBits = {
    edit,
    textLayers,
    layoutsByBubble,
  }

  return {
    page_id: pageDetail.page.id,
    doc: buildWorkingDoc(seed, working),
    off: [...disabledLayerIdsFromEdit(edit)],
    font: pageFontFromEdit(edit),
  }
}

/** Apply inset overrides + materialize paint layers (parity with server merge). */
export function applyEditLayers(
  seed: PageDoc,
  edit: PageEdit | undefined,
): PageDoc {
  if (!edit) return seed

  const insetByBubble = new Map<number, number>()
  for (const [k, be] of Object.entries(edit.bubbles ?? {})) {
    if (be.inset != null) insetByBubble.set(Number(k), be.inset)
  }
  const paint = edit.paint ?? []
  if (!insetByBubble.size && !paint.length) return seed

  let layers = seed.layers.map((layer) => {
    if (layer.kind !== 'clean' || layer.bubble_id == null) return layer
    const inset = insetByBubble.get(layer.bubble_id)
    if (inset == null || !layer.mask) return layer
    return { ...layer, mask: { ...layer.mask, inset } }
  })

  if (paint.length) {
    layers = layers.filter((l) => l.kind !== 'paint')
    layers = [...layers, ...paintLayersFromStrokes(paint, seed)]
  }

  return { ...seed, layers }
}

function bubbleBBox(doc: PageDoc, bubbleId: number | undefined): BBox {
  if (bubbleId == null) {
    return [0, 0, doc.source.width, doc.source.height]
  }
  const b = doc.bubbles.find((x) => x.id === bubbleId)
  return b?.bbox ?? [0, 0, doc.source.width, doc.source.height]
}

function paintLayersFromStrokes(
  paint: PaintStroke[],
  doc: PageDoc,
): Layer[] {
  const byBubble = new Map<number | 'page', PaintStroke[]>()
  for (const stroke of paint) {
    const key =
      stroke.bubble_id != null && Number.isFinite(stroke.bubble_id)
        ? stroke.bubble_id
        : 'page'
    const list = byBubble.get(key) ?? []
    list.push(stroke)
    byBubble.set(key, list)
  }

  const out: Layer[] = []
  for (const [key, strokes] of byBubble) {
    const bid = key === 'page' ? undefined : key
    const id = bid != null ? paintLayerId(bid) : 'pnt_page'
    out.push({
      id,
      kind: 'paint',
      name: bid != null ? `Paint / bubble ${bid}` : 'Paint / page',
      group: bid != null ? `bubble_${bid}` : null,
      bubble_id: bid ?? null,
      enabled: true,
      opacity: 1,
      blend: 'normal',
      z: PAINT_Z_BASE + (bid ?? 0),
      source_step: 'paint.v1',
      bbox: bubbleBBox(doc, bid),
      strokes,
    })
  }
  return out
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
  const removed = removedBubbleSet(edit)
  const textOverrides = textOverridesFromEdit(edit)
  const sizeOverrides = sizeOverridesFromEdit(edit)
  const bubbleFonts = bubbleFontsFromEdit(edit)
  const resolvedPageFont =
    pageFont !== undefined ? pageFont : pageFontFromEdit(edit)

  const texts = detail.doc.texts
    .filter((t) => !removed.has(t.bubble_id))
    .map((t) => ({
      bubble_id: t.bubble_id,
      text:
        textOverrides[t.bubble_id] !== undefined
          ? textOverrides[t.bubble_id]!
          : (t.text ?? ''),
    }))

  // Include bubbles that have overrides but no seed text row.
  const seen = new Set(texts.map((t) => t.bubble_id))
  for (const bubble of detail.doc.bubbles) {
    if (removed.has(bubble.id)) continue
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
    if (removed.has(bubble.id)) continue
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

/** Payload shape for PUT /api/pages/:id/edit.

 * ``bubbles[].text`` is the shared letterer / translator write surface —
 * a future translator screen will POST the same overlay fields.
 */
export function editPayload(edit: PageEdit): PageEdit {
  return {
    rev: edit.rev,
    page: edit.page ?? {},
    bubbles: edit.bubbles ?? {},
    paint: edit.paint ?? [],
    regions: edit.regions ?? [],
    order: edit.order ?? [],
    removed_bubbles: edit.removed_bubbles ?? [],
  }
}

export function newRegionId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)]!
  }
  return `r-${suffix}`
}

export function bubbleOrderToken(id: number): string {
  return `b:${id}`
}

export function regionById(
  edit: PageEdit | undefined,
  id: string,
): Region | undefined {
  return edit?.regions?.find((r) => r.id === id)
}
