import type { BBox, Bubble, BubbleEdit, BubbleLayout, Point } from '@/api/types'

/** Corner + edge mid handles, or body move. */
export type FrameHandle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'move'

const MIN_FRAME = 12

/** Rasterize the bubble polygon into a local 0/1 mask (bbox-local coords). */
function rasterizePolygon(
  polygon: Point[],
  ox: number,
  oy: number,
  w: number,
  h: number,
): Uint8Array | null {
  if (w <= 0 || h <= 0 || polygon.length < 3) return null
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  const [x0, y0] = polygon[0] as [number, number]
  ctx.moveTo(x0 - ox, y0 - oy)
  for (let i = 1; i < polygon.length; i++) {
    const [x, y] = polygon[i] as [number, number]
    ctx.lineTo(x - ox, y - oy)
  }
  ctx.closePath()
  ctx.fill()
  const { data } = ctx.getImageData(0, 0, w, h)
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) mask[i] = data[i * 4 + 3] > 127 ? 1 : 0
  return mask
}

/** Separable erosion with a square structuring element (radius `r`, in px). */
function erodeSquare(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask
  const horiz = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    let zeros = 0
    for (let x = -r; x <= r; x++) {
      if (x < 0 || x >= w || mask[row + x] === 0) zeros++
    }
    for (let x = 0; x < w; x++) {
      horiz[row + x] = zeros === 0 ? 1 : 0
      const outX = x - r
      const inX = x + r + 1
      const outZero = outX < 0 || outX >= w || mask[row + outX] === 0
      const inZero = inX < 0 || inX >= w || mask[row + inX] === 0
      if (outZero) zeros--
      if (inZero) zeros++
    }
  }
  const out = new Uint8Array(w * h)
  for (let x = 0; x < w; x++) {
    let zeros = 0
    for (let y = -r; y <= r; y++) {
      if (y < 0 || y >= h || horiz[y * w + x] === 0) zeros++
    }
    for (let y = 0; y < h; y++) {
      out[y * w + x] = zeros === 0 ? 1 : 0
      const outY = y - r
      const inY = y + r + 1
      const outZero = outY < 0 || outY >= h || horiz[outY * w + x] === 0
      const inZero = inY < 0 || inY >= h || horiz[inY * w + x] === 0
      if (outZero) zeros--
      if (inZero) zeros++
    }
  }
  return out
}

/** Largest all-true axis-aligned rectangle in a binary mask (histogram method). */
function maxRectInMask(
  mask: Uint8Array,
  w: number,
  h: number,
): { x0: number; y0: number; x1: number; y1: number; area: number } {
  const heights = new Int32Array(w)
  let best = { x0: 0, y0: 0, x1: 0, y1: 0, area: 0 }
  const stack: number[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      heights[x] = mask[y * w + x] ? heights[x] + 1 : 0
    }
    stack.length = 0
    for (let x = 0; x <= w; x++) {
      const curH = x === w ? 0 : heights[x]
      while (stack.length && heights[stack[stack.length - 1]!] >= curH) {
        const top = stack.pop()!
        const height = heights[top]!
        const left = stack.length ? stack[stack.length - 1]! + 1 : 0
        const width = x - left
        const area = height * width
        if (area > best.area) {
          best = { x0: left, y0: y - height + 1, x1: left + width, y1: y + 1, area }
        }
      }
      stack.push(x)
    }
  }
  return best
}

/** Memoized by polygon array identity — polygons come from the immutable seed doc. */
const defaultFrameCache = new WeakMap<Point[], BBox>()

/**
 * Best axis-aligned rectangle that sits fully inside the bubble polygon —
 * the default editable box before the letterer moves/resizes it.
 * A plain `bbox` is too generous for round/tailed bubbles (its corners sit
 * outside the curve), so a bare rectangle fit to it spills text past the
 * balloon edge. This finds the largest inscribed rect instead, eroded by a
 * small safety margin so text never touches the visible bubble edge.
 */
export function computeDefaultFrame(bubble: Bubble): BBox {
  const cached = defaultFrameCache.get(bubble.polygon)
  if (cached) return cached

  const fallback: BBox = [
    Number(bubble.bbox[0]),
    Number(bubble.bbox[1]),
    Number(bubble.bbox[2]),
    Number(bubble.bbox[3]),
  ]

  const pad = 2
  const ox = Math.floor(fallback[0]) - pad
  const oy = Math.floor(fallback[1]) - pad
  const w = Math.ceil(fallback[2] - fallback[0]) + pad * 2
  const h = Math.ceil(fallback[3] - fallback[1]) + pad * 2

  let frame = fallback
  try {
    const mask = rasterizePolygon(bubble.polygon, ox, oy, w, h)
    if (mask) {
      const insetPx = Math.max(2, Math.min(14, Math.round(Math.min(w, h) * 0.12)))
      const eroded = erodeSquare(mask, w, h, insetPx)
      const rect = maxRectInMask(eroded, w, h)
      const minArea = 0.15 * (fallback[2] - fallback[0]) * (fallback[3] - fallback[1])
      if (rect.area >= minArea) {
        frame = [rect.x0 + ox, rect.y0 + oy, rect.x1 + ox, rect.y1 + oy]
      }
    }
  } catch {
    /* canvas unavailable — keep bbox fallback */
  }

  defaultFrameCache.set(bubble.polygon, frame)
  return frame
}

/**
 * Editable text-box frame for the letterer.
 * Prefer the saved override; otherwise the largest rectangle that fits
 * inside the bubble polygon (see `computeDefaultFrame`).
 * Do NOT use layout.frame — that is the tight glyph AABB and feels broken to resize.
 */
export function resolveBubbleFrame(
  bubble: Bubble,
  edit: BubbleEdit | undefined,
  _layout?: BubbleLayout | undefined,
): BBox {
  if (edit?.frame && edit.frame.length >= 4) {
    return [
      Number(edit.frame[0]),
      Number(edit.frame[1]),
      Number(edit.frame[2]),
      Number(edit.frame[3]),
    ]
  }
  return computeDefaultFrame(bubble)
}

/** Keep frame on-page with a minimum size (no axis flip surprises). */
export function clampFrame(
  frame: BBox,
  pageW: number,
  pageH: number,
): BBox {
  let [x0, y0, x1, y1] = frame
  if (x1 < x0) [x0, x1] = [x1, x0]
  if (y1 < y0) [y0, y1] = [y1, y0]

  if (x1 - x0 < MIN_FRAME) x1 = x0 + MIN_FRAME
  if (y1 - y0 < MIN_FRAME) y1 = y0 + MIN_FRAME

  if (x0 < 0) {
    x1 -= x0
    x0 = 0
  }
  if (y0 < 0) {
    y1 -= y0
    y0 = 0
  }
  if (x1 > pageW) {
    x0 -= x1 - pageW
    x1 = pageW
  }
  if (y1 > pageH) {
    y0 -= y1 - pageH
    y1 = pageH
  }

  x0 = Math.max(0, x0)
  y0 = Math.max(0, y0)
  x1 = Math.min(pageW, Math.max(x0 + MIN_FRAME, x1))
  y1 = Math.min(pageH, Math.max(y0 + MIN_FRAME, y1))
  return [x0, y0, x1, y1]
}

export function nudgeFrame(frame: BBox, dx: number, dy: number): BBox {
  return [frame[0] + dx, frame[1] + dy, frame[2] + dx, frame[3] + dy]
}

const MOVES_LEFT = new Set<FrameHandle>(['nw', 'w', 'sw'])
const MOVES_RIGHT = new Set<FrameHandle>(['ne', 'e', 'se'])
const MOVES_TOP = new Set<FrameHandle>(['nw', 'n', 'ne'])
const MOVES_BOTTOM = new Set<FrameHandle>(['sw', 's', 'se'])

export function resizeFrame(
  frame: BBox,
  handle: Exclude<FrameHandle, 'move'>,
  dx: number,
  dy: number,
): BBox {
  let [x0, y0, x1, y1] = frame

  if (MOVES_LEFT.has(handle)) x0 += dx
  if (MOVES_RIGHT.has(handle)) x1 += dx
  if (MOVES_TOP.has(handle)) y0 += dy
  if (MOVES_BOTTOM.has(handle)) y1 += dy

  // Pin the opposite edge when the dragged edge crosses min size.
  if (x1 - x0 < MIN_FRAME) {
    if (MOVES_LEFT.has(handle)) x0 = x1 - MIN_FRAME
    else x1 = x0 + MIN_FRAME
  }
  if (y1 - y0 < MIN_FRAME) {
    if (MOVES_TOP.has(handle)) y0 = y1 - MIN_FRAME
    else y1 = y0 + MIN_FRAME
  }

  return [x0, y0, x1, y1]
}

export type FrameHandlePoint = { handle: Exclude<FrameHandle, 'move'>; x: number; y: number }

/** Eight control points: 4 corners + 4 edge midpoints. */
export function frameHandlePoints(frame: BBox): FrameHandlePoint[] {
  const [x0, y0, x1, y1] = frame
  const mx = (x0 + x1) / 2
  const my = (y0 + y1) / 2
  return [
    { handle: 'nw', x: x0, y: y0 },
    { handle: 'n', x: mx, y: y0 },
    { handle: 'ne', x: x1, y: y0 },
    { handle: 'e', x: x1, y: my },
    { handle: 'se', x: x1, y: y1 },
    { handle: 's', x: mx, y: y1 },
    { handle: 'sw', x: x0, y: y1 },
    { handle: 'w', x: x0, y: my },
  ]
}

/**
 * Hit-test handles (square) then body.
 * `half` is half-size of the handle hit box in page px.
 */
export function hitTestFrame(
  frame: BBox,
  x: number,
  y: number,
  half: number,
): FrameHandle | null {
  const [x0, y0, x1, y1] = frame
  const h = Math.max(4, half)

  for (const p of frameHandlePoints(frame)) {
    if (Math.abs(x - p.x) <= h && Math.abs(y - p.y) <= h) return p.handle
  }

  // Edge strips (between corners) — easier grab when zoomed out
  const edge = Math.max(3, h * 0.75)
  if (x >= x0 + h && x <= x1 - h) {
    if (Math.abs(y - y0) <= edge) return 'n'
    if (Math.abs(y - y1) <= edge) return 's'
  }
  if (y >= y0 + h && y <= y1 - h) {
    if (Math.abs(x - x0) <= edge) return 'w'
    if (Math.abs(x - x1) <= edge) return 'e'
  }

  if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return 'move'
  return null
}

export function cursorForFrameHandle(h: FrameHandle | null): string {
  if (!h) return 'grab'
  if (h === 'move') return 'move'
  if (h === 'n' || h === 's') return 'ns-resize'
  if (h === 'e' || h === 'w') return 'ew-resize'
  if (h === 'nw' || h === 'se') return 'nwse-resize'
  return 'nesw-resize'
}

/** Effective font size in px for controls / force-size typeset. */
export function resolveFontPx(
  edit: BubbleEdit | undefined,
  layout: BubbleLayout | undefined,
  fallback = 24,
): number {
  if (edit?.font_px != null && edit.font_px > 0) {
    return Math.round(edit.font_px)
  }
  if (layout?.font_px != null && layout.font_px > 0) {
    return Math.round(layout.font_px)
  }
  return fallback
}

/** Stable key for frame equality (avoid clearing live drag on new array refs). */
export function frameKey(frame: BBox | null | undefined): string {
  if (!frame || frame.length < 4) return ''
  return `${frame[0]},${frame[1]},${frame[2]},${frame[3]}`
}
