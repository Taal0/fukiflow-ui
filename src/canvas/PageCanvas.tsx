import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { BubbleLayout, FontInfo, PageDetail, ViewMode } from '@/api/types'
import { useSession } from '@/store/session'
import {
  composePage,
  fitTransform,
  hitTestBubble,
  loadBitmaps,
  screenToPage,
  type ViewTransform,
} from './compositor'
import { usePageFonts } from './useFontFace'

interface PageCanvasProps {
  detail: PageDetail
  fonts: FontInfo[]
}

type DragMode = 'pan' | 'split' | null

const EMPTY_SET = new Set<string>()
const EMPTY_NUM_RECORD: Record<number, number> = {}
const EMPTY_STR_RECORD: Record<number, string> = {}
const EMPTY_LAYOUTS: Record<number, BubbleLayout> = {}

export function PageCanvas({ detail, fonts }: PageCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const transformRef = useRef<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 })
  const rafRef = useRef<number | null>(null)
  const sourceRef = useRef<ImageBitmap | null>(null)
  const bitmapsRef = useRef<Map<string, ImageBitmap>>(new Map())
  /** True after the user zooms/pans; skip auto-fit until page change or double-click. */
  const userTransformedRef = useRef(false)
  const dragRef = useRef<{
    mode: DragMode
    startX: number
    startY: number
    originX: number
    originY: number
    originSplit: number
  } | null>(null)

  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 })

  const pageId = detail.page.id
  const originalUrl = detail.assets.original_url
  const sourceW = detail.doc.source.width
  const sourceH = detail.doc.source.height
  const cleanUrlsKey = detail.layer_assets
    .filter((a) => a.layer_id.startsWith('cln_'))
    .map((a) => a.url)
    .join('|')

  const viewMode = useSession((s) => s.viewMode)
  const splitRatio = useSession((s) => s.splitRatio)
  const setSplitRatio = useSession((s) => s.setSplitRatio)
  const selectBubble = useSession((s) => s.selectBubble)
  const pageSession = useSession((s) => s.pages[pageId])
  const fontOverride = useSession((s) => s.fontOverride)

  const selectedBubbleId = pageSession?.selectedBubbleId ?? null
  const disabledLayerIds = pageSession?.disabledLayerIds ?? EMPTY_SET
  const layoutsByBubble = pageSession?.layoutsByBubble ?? EMPTY_LAYOUTS
  const sizeOverrides = pageSession?.sizeOverrides ?? EMPTY_NUM_RECORD
  const bubbleFontOverrides = pageSession?.bubbleFontOverrides ?? EMPTY_STR_RECORD

  const neededFontKeys = fonts.map((f) => f.key)
  const { ready: fontsReady } = usePageFonts(fonts, neededFontKeys)

  // Observe container size
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      setViewSize({ w: cr.width, h: cr.height })
    })
    ro.observe(el)
    setViewSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // Load source + clean layer bitmaps (asset identity only — not session edits)
  useEffect(() => {
    let cancelled = false
    setReady(false)
    setLoadError(null)
    // Keep previous source on screen until the new page bitmaps arrive.
    userTransformedRef.current = false

    const urls = [originalUrl, ...cleanUrlsKey.split('|').filter(Boolean)]

    loadBitmaps(urls)
      .then((map) => {
        if (cancelled) return
        const source = map.get(originalUrl)
        if (!source) {
          setLoadError('Kaynak sayfa görseli yüklenemedi')
          return
        }
        sourceRef.current = source
        bitmapsRef.current = map
        const w =
          wrapRef.current?.clientWidth ||
          viewSize.w ||
          canvasRef.current?.clientWidth ||
          0
        const h =
          wrapRef.current?.clientHeight ||
          viewSize.h ||
          canvasRef.current?.clientHeight ||
          0
        if (w > 1 && h > 1) {
          transformRef.current = fitTransform(sourceW, sourceH, w, h)
        }
        setReady(true)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Sayfa yüklenemedi')
        }
      })

    return () => {
      cancelled = true
    }
    // viewSize intentionally omitted — paint() re-fits from live measurements
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, originalUrl, cleanUrlsKey, sourceW, sourceH])

  const paint = useEffectEvent(() => {
    const canvas = canvasRef.current
    const source = sourceRef.current
    // Don't block the page image on font loading — text layers may briefly
    // use a fallback face until FontFace is ready, then we repaint.
    if (!canvas || !source || !ready) return

    const dpr = window.devicePixelRatio || 1
    const cssW =
      viewSize.w ||
      canvas.clientWidth ||
      wrapRef.current?.clientWidth ||
      0
    const cssH =
      viewSize.h ||
      canvas.clientHeight ||
      wrapRef.current?.clientHeight ||
      0
    if (cssW < 1 || cssH < 1) return

    // Always re-fit unless the user zoomed/panned — covers remount and 0×0 races.
    if (!userTransformedRef.current) {
      transformRef.current = fitTransform(sourceW, sourceH, cssW, cssH)
    }

    canvas.width = Math.floor(cssW * dpr)
    canvas.height = Math.floor(cssH * dpr)
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-canvas-bg')
      .trim() || '#e8e0d0'
    ctx.fillRect(0, 0, cssW, cssH)

    const { width: pw, height: ph } = detail.doc.source
    let off = offscreenRef.current
    if (!off) {
      off = document.createElement('canvas')
      offscreenRef.current = off
    }
    if (off.width !== pw || off.height !== ph) {
      off.width = pw
      off.height = ph
    }
    const octx = off.getContext('2d')
    if (!octx) return

    const composeInput = {
      source,
      doc: detail.doc,
      layerAssets: detail.layer_assets,
      bitmaps: bitmapsRef.current,
      disabledLayerIds,
      layoutsByBubble,
      sizeOverrides,
      fontOverride,
      bubbleFontOverrides,
      fonts,
      selectedBubbleId,
    }

    const t = transformRef.current

    const drawComposedAt = (clipRight?: number) => {
      composePage(octx, composeInput)
      ctx.save()
      if (clipRight != null) {
        ctx.beginPath()
        ctx.rect(0, 0, clipRight, cssH)
        ctx.clip()
      }
      ctx.translate(t.offsetX, t.offsetY)
      ctx.scale(t.scale, t.scale)
      ctx.drawImage(off, 0, 0)
      ctx.restore()
    }

    const drawOriginalAt = (clipLeft?: number) => {
      ctx.save()
      if (clipLeft != null) {
        ctx.beginPath()
        ctx.rect(clipLeft, 0, cssW - clipLeft, cssH)
        ctx.clip()
      }
      ctx.translate(t.offsetX, t.offsetY)
      ctx.scale(t.scale, t.scale)
      ctx.drawImage(source, 0, 0, pw, ph)
      ctx.restore()
    }

    if (viewMode === 'original') {
      drawOriginalAt()
    } else if (viewMode === 'composed') {
      drawComposedAt()
    } else {
      // Split: left = composed, right = original
      const splitX = cssW * splitRatio
      drawComposedAt(splitX)
      drawOriginalAt(splitX)
      // Divider
      ctx.save()
      ctx.fillStyle = '#b83a26'
      ctx.fillRect(splitX - 1, 0, 2, cssH)
      ctx.beginPath()
      ctx.arc(splitX, cssH / 2, 10, 0, Math.PI * 2)
      ctx.fillStyle = '#b83a26'
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('◂▸', splitX, cssH / 2)
      ctx.restore()
    }
  })

  const schedulePaint = useEffectEvent(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      paint()
    })
  })

  useEffect(() => {
    schedulePaint()
  }, [
    ready,
    fontsReady,
    viewSize,
    viewMode,
    splitRatio,
    selectedBubbleId,
    disabledLayerIds,
    layoutsByBubble,
    sizeOverrides,
    fontOverride,
    bubbleFontOverrides,
    fonts,
    detail,
    schedulePaint,
  ])

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const t = transformRef.current
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const nextScale = Math.min(8, Math.max(0.05, t.scale * factor))
    const page = screenToPage(mx, my, t)
    userTransformedRef.current = true
    transformRef.current = {
      scale: nextScale,
      offsetX: mx - page.x * nextScale,
      offsetY: my - page.y * nextScale,
    }
    schedulePaint()
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (viewMode === 'split') {
      const splitX = (viewSize.w || rect.width) * splitRatio
      if (Math.abs(x - splitX) < 12) {
        dragRef.current = {
          mode: 'split',
          startX: x,
          startY: y,
          originX: transformRef.current.offsetX,
          originY: transformRef.current.offsetY,
          originSplit: splitRatio,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
    }

    if (e.button === 1 || e.shiftKey || e.button === 2) {
      dragRef.current = {
        mode: 'pan',
        startX: x,
        startY: y,
        originX: transformRef.current.offsetX,
        originY: transformRef.current.offsetY,
        originSplit: splitRatio,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }

    if (e.button === 0) {
      dragRef.current = {
        mode: 'pan',
        startX: x,
        startY: y,
        originX: transformRef.current.offsetX,
        originY: transformRef.current.offsetY,
        originSplit: splitRatio,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (drag.mode === 'split') {
      setSplitRatio(x / Math.max(1, rect.width))
      return
    }

    if (drag.mode === 'pan') {
      const moved =
        Math.abs(x - drag.startX) > 3 || Math.abs(y - drag.startY) > 3
      if (!moved) return
      userTransformedRef.current = true
      transformRef.current = {
        ...transformRef.current,
        offsetX: drag.originX + (x - drag.startX),
        offsetY: drag.originY + (y - drag.startY),
      }
      schedulePaint()
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (!drag || drag.mode !== 'pan') return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const moved =
      Math.abs(x - drag.startX) > 4 || Math.abs(y - drag.startY) > 4
    if (moved) return

    const page = screenToPage(x, y, transformRef.current)
    const hit = hitTestBubble(detail.doc.bubbles, page.x, page.y)
    selectBubble(hit?.id ?? null)
  }

  const onDoubleClick = () => {
    userTransformedRef.current = false
    transformRef.current = fitTransform(
      detail.doc.source.width,
      detail.doc.source.height,
      viewSize.w,
      viewSize.h,
    )
    schedulePaint()
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden bg-[var(--color-canvas-bg)]"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />
      {!ready && !loadError && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[var(--color-ink-muted)]">
          Sayfa yükleniyor…
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-[var(--color-danger)]">
          {loadError}
        </div>
      )}
      <ViewModeHint mode={viewMode} />
    </div>
  )
}

function ViewModeHint({ mode }: { mode: ViewMode }) {
  const label =
    mode === 'composed'
      ? 'Sonuç'
      : mode === 'original'
        ? 'Orijinal'
        : 'Yan yana — ayıracı sürükleyin'
  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-[var(--color-surface-raised)]/90 px-3 py-1 text-xs text-[var(--color-ink-muted)] shadow-sm ring-1 ring-[var(--color-border)]">
      {label} · tekerlek: yakınlaştır · çift tık: sığdır
    </div>
  )
}
