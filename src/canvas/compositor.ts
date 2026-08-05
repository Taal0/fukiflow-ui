import type {
  BBox,
  Bubble,
  BubbleLayout,
  FontInfo,
  Layer,
  LayerAsset,
  PageDoc,
  Point,
} from '@/api/types'
import { frameHandlePoints } from '@/lib/bubbleFrame'
import { resolveFontFamily } from './useFontFace'

export interface ComposeInput {
  source: ImageBitmap
  doc: PageDoc
  layerAssets: LayerAsset[]
  bitmaps: Map<string, ImageBitmap>
  disabledLayerIds: Set<string>
  layoutsByBubble: Record<number, BubbleLayout>
  sizeOverrides: Record<number, number>
  fontOverride: string | null
  bubbleFontOverrides: Record<number, string>
  fonts: FontInfo[]
  selectedBubbleId: number | null
  /** Editable text frame for the selected bubble (page px). */
  selectedFrame?: BBox | null
  /** Screen-space handle size converted to page px. */
  handleRadius?: number
}

const bitmapCache = new Map<string, Promise<ImageBitmap>>()

export function loadBitmap(url: string): Promise<ImageBitmap> {
  const hit = bitmapCache.get(url)
  if (hit) return hit
  const promise = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`Görsel yüklenemedi: ${url}`)
      return r.blob()
    })
    .then((blob) => createImageBitmap(blob))
    .catch((err) => {
      bitmapCache.delete(url)
      throw err
    })
  bitmapCache.set(url, promise)
  return promise
}

/** Load many bitmaps; failures are omitted instead of failing the whole page. */
export async function loadBitmaps(
  urls: string[],
): Promise<Map<string, ImageBitmap>> {
  const unique = [...new Set(urls.filter(Boolean))]
  const settled = await Promise.allSettled(
    unique.map(async (url) => [url, await loadBitmap(url)] as const),
  )
  const map = new Map<string, ImageBitmap>()
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      map.set(result.value[0], result.value[1])
    }
  }
  return map
}

export function clearBitmapCache(): void {
  bitmapCache.clear()
}

function pointInPolygon(x: number, y: number, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]![0]!
    const yi = polygon[i]![1]!
    const xj = polygon[j]![0]!
    const yj = polygon[j]![1]!
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function hitTestBubble(
  bubbles: Bubble[],
  x: number,
  y: number,
): Bubble | null {
  // Prefer smaller / higher reading-order bubbles when overlapping.
  const ordered = [...bubbles].sort((a, b) => {
    const aa = (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1])
    const bb = (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1])
    return aa - bb
  })
  for (const b of ordered) {
    if (pointInPolygon(x, y, b.polygon)) return b
  }
  return null
}

function layoutForLayer(
  layer: Layer,
  layoutsByBubble: Record<number, BubbleLayout>,
): BubbleLayout | null {
  if (layer.bubble_id != null && layoutsByBubble[layer.bubble_id]) {
    return layoutsByBubble[layer.bubble_id]!
  }
  return layer.layout ?? null
}

function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  input: ComposeInput,
): void {
  const lay = layoutForLayer(layer, input.layoutsByBubble)
  if (!lay || lay.status !== 'ok' || !lay.lines?.length || lay.font_px == null) {
    return
  }

  const bubbleId = layer.bubble_id ?? lay.bubble_id
  // Size/font reflow comes from typeset (font_scale / font overrides).
  // Draw layout metrics as returned — no client-side rescaling.
  const fontPx = Math.max(1, Math.round(lay.font_px))
  const fontKey =
    input.bubbleFontOverrides[bubbleId] ?? input.fontOverride ?? null
  const family = resolveFontFamily(input.fonts, {
    key: fontKey,
    family: lay.font_family,
    postscript: lay.font_postscript_name,
    file: lay.font_file,
  })

  ctx.save()
  ctx.font = `${fontPx}px "${family}"`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#000'
  for (const line of lay.lines) {
    ctx.fillText(line.text, line.x, line.baseline_y)
  }
  ctx.restore()
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  bubble: Bubble | undefined,
  frame: BBox | null | undefined,
  handleRadius: number,
): void {
  if (!bubble) return
  ctx.save()

  // Bubble polygon tint (context)
  if (bubble.polygon?.length) {
    ctx.beginPath()
    const [px0, py0] = bubble.polygon[0]!
    ctx.moveTo(px0, py0)
    for (let i = 1; i < bubble.polygon.length; i++) {
      const [x, y] = bubble.polygon[i]!
      ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(184, 58, 38, 0.08)'
    ctx.fill()
  }

  // Editable text frame
  if (frame && frame.length >= 4) {
    const [x0, y0, x1, y1] = frame
    // Stroke width ~constant in screen space
    const stroke = Math.max(1, Math.min(2.5, handleRadius * 0.35))
    ctx.strokeStyle = '#b83a26'
    ctx.lineWidth = stroke
    ctx.setLineDash([6 / Math.max(stroke, 1), 4 / Math.max(stroke, 1)])
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
    ctx.setLineDash([])

    const r = Math.max(4, handleRadius)
    for (const p of frameHandlePoints(frame)) {
      ctx.fillStyle = '#fff'
      ctx.strokeStyle = '#b83a26'
      ctx.lineWidth = stroke
      ctx.beginPath()
      ctx.rect(p.x - r, p.y - r, r * 2, r * 2)
      ctx.fill()
      ctx.stroke()
    }
  } else if (bubble.polygon?.length) {
    ctx.beginPath()
    const [px0, py0] = bubble.polygon[0]!
    ctx.moveTo(px0, py0)
    for (let i = 1; i < bubble.polygon.length; i++) {
      const [x, y] = bubble.polygon[i]!
      ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.strokeStyle = '#b83a26'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.restore()
}

/** Draw composed page into an offscreen or visible canvas (page pixel space). */
export function composePage(
  ctx: CanvasRenderingContext2D,
  input: ComposeInput,
): void {
  const { width, height } = input.doc.source
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(input.source, 0, 0, width, height)

  const layers = [...input.doc.layers].sort(
    (a, b) => (a.z ?? 0) - (b.z ?? 0) || a.id.localeCompare(b.id),
  )
  const assetById = new Map(input.layerAssets.map((a) => [a.layer_id, a]))

  for (const layer of layers) {
    if (layer.enabled === false) continue
    if (input.disabledLayerIds.has(layer.id)) continue

    if (layer.kind === 'clean') {
      const asset = assetById.get(layer.id)
      const bmp = asset ? input.bitmaps.get(asset.url) : undefined
      if (asset && bmp) {
        ctx.drawImage(bmp, asset.offset_x, asset.offset_y)
      }
    } else if (layer.kind === 'text') {
      drawTextLayer(ctx, layer, input)
    }
  }

  if (input.selectedBubbleId != null) {
    const bubble = input.doc.bubbles.find((b) => b.id === input.selectedBubbleId)
    drawSelection(
      ctx,
      bubble,
      input.selectedFrame,
      input.handleRadius ?? 5,
    )
  }
}

export interface ViewTransform {
  scale: number
  offsetX: number
  offsetY: number
}

export function fitTransform(
  pageW: number,
  pageH: number,
  viewW: number,
  viewH: number,
  padding = 24,
): ViewTransform {
  if (viewW < 1 || viewH < 1 || pageW < 1 || pageH < 1) {
    return { scale: 1, offsetX: 0, offsetY: 0 }
  }
  const availW = Math.max(1, viewW - padding * 2)
  const availH = Math.max(1, viewH - padding * 2)
  const scale = Math.min(availW / pageW, availH / pageH)
  const offsetX = (viewW - pageW * scale) / 2
  const offsetY = (viewH - pageH * scale) / 2
  return { scale, offsetX, offsetY }
}

export function screenToPage(
  sx: number,
  sy: number,
  t: ViewTransform,
): { x: number; y: number } {
  return {
    x: (sx - t.offsetX) / t.scale,
    y: (sy - t.offsetY) / t.scale,
  }
}
