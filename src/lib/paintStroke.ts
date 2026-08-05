import type { BBox, PaintStroke, Point } from '@/api/types'

export const BRUSH_PRESETS = [2, 4, 8, 16, 32] as const
export const BRUSH_RADIUS_MIN = 1
export const BRUSH_RADIUS_MAX = 64
export const INSET_MIN = 0
export const INSET_MAX = 64
export const DEFAULT_INSET = 10
/** Expand bubble bbox by this many brush radii when clipping strokes. */
export const BBOX_PAD_RADII = 1

let strokeSeq = 0

export function nextStrokeId(): string {
  strokeSeq += 1
  return `pnt_${Date.now().toString(36)}_${strokeSeq}`
}

export function expandBBox(bbox: BBox, pad: number): BBox {
  return [bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad]
}

export function clampPointToBBox(x: number, y: number, bbox: BBox): Point {
  return [
    Math.min(bbox[2], Math.max(bbox[0], x)),
    Math.min(bbox[3], Math.max(bbox[1], y)),
  ]
}

export function paintClipBBox(bubbleBBox: BBox, radiusPx: number): BBox {
  return expandBBox(bubbleBBox, Math.ceil(radiusPx * BBOX_PAD_RADII))
}

/** Drop points closer than threshold to keep stroke payloads small. */
export function shouldAppendPoint(
  points: Point[],
  next: Point,
  radiusPx: number,
): boolean {
  if (!points.length) return true
  const prev = points[points.length - 1]!
  const dx = next[0]! - prev[0]!
  const dy = next[1]! - prev[1]!
  const minDist = Math.max(1, radiusPx * 0.35)
  return dx * dx + dy * dy >= minDist * minDist
}

/** Sample a single RGB pixel from a bitmap (page space). */
export function sampleBitmapColor(
  bmp: ImageBitmap,
  x: number,
  y: number,
): [number, number, number] {
  const sx = Math.min(bmp.width - 1, Math.max(0, Math.floor(x)))
  const sy = Math.min(bmp.height - 1, Math.max(0, Math.floor(y)))
  const c = document.createElement('canvas')
  c.width = 1
  c.height = 1
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return [255, 255, 255]
  ctx.drawImage(bmp, sx, sy, 1, 1, 0, 0, 1, 1)
  const d = ctx.getImageData(0, 0, 1, 1).data
  return [d[0]!, d[1]!, d[2]!]
}

function stampCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

/** Restore one circular stamp from source using a tight dirty rect. */
function restoreStamp(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  x: number,
  y: number,
  r: number,
): void {
  const pad = Math.ceil(r) + 1
  const sx = Math.floor(x - pad)
  const sy = Math.floor(y - pad)
  const sw = pad * 2
  const sh = pad * 2
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(source, sx, sy, sw, sh, sx, sy, sw, sh)
  ctx.restore()
}

/** Draw committed + live paint strokes in page pixel space. */
export function drawPaintStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: PaintStroke[],
  source: CanvasImageSource | null,
): void {
  for (const stroke of strokes) {
    drawOneStroke(ctx, stroke, source)
  }
}

export function drawOneStroke(
  ctx: CanvasRenderingContext2D,
  stroke: PaintStroke,
  source: CanvasImageSource | null,
): void {
  const pts = stroke.points
  if (!pts?.length) return
  const r = Math.max(0.5, stroke.radius_px)

  if (stroke.mode === 'restore') {
    if (!source) return
    for (const p of pts) {
      restoreStamp(ctx, source, p[0]!, p[1]!, r)
    }
    if (pts.length > 1) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!
        const b = pts[i]!
        const steps = Math.max(
          1,
          Math.ceil(Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!) / Math.max(1, r * 0.5)),
        )
        for (let s = 1; s < steps; s++) {
          const t = s / steps
          const x = a[0]! + (b[0]! - a[0]!) * t
          const y = a[1]! + (b[1]! - a[1]!) * t
          restoreStamp(ctx, source, x, y, r)
        }
      }
    }
    return
  }

  // fill
  const color = stroke.color ?? [255, 255, 255]
  ctx.save()
  ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
  ctx.strokeStyle = ctx.fillStyle
  ctx.lineWidth = r * 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (pts.length === 1) {
    stampCircle(ctx, pts[0]![0]!, pts[0]![1]!, r)
  } else {
    ctx.beginPath()
    ctx.moveTo(pts[0]![0]!, pts[0]![1]!)
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i]![0]!, pts[i]![1]!)
    }
    ctx.stroke()
    for (const p of pts) stampCircle(ctx, p[0]!, p[1]!, r)
  }
  ctx.restore()
}

/** Seed clean inset, or bubble edit override. */
export function resolveCleanInset(
  seedInset: number | null | undefined,
  editInset: number | null | undefined,
): number {
  if (editInset != null) return editInset
  if (seedInset != null) return seedInset
  return DEFAULT_INSET
}
