import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type {
  BBox,
  BubbleLayout,
  FontInfo,
  PageDetail,
  PaintStroke,
  Point,
} from '@/api/types'
import {
  clampFrame,
  cursorForFrameHandle,
  frameKey,
  hitTestFrame,
  nudgeFrame,
  resizeFrame,
  resolveBubbleFrame,
  type FrameHandle,
} from '@/lib/bubbleFrame'
import {
  clampPointToBBox,
  nextStrokeId,
  paintClipBBox,
  sampleBitmapColor,
  shouldAppendPoint,
} from '@/lib/paintStroke'
import {
  bubbleFontsFromEdit,
  disabledLayerIdsFromEdit,
  pageFontFromEdit,
  sizeOverridesFromEdit,
  useSession,
} from '@/store/session'
import { drawPaintStrokes } from '@/lib/paintStroke'
import { orderedItems } from '@/lib/workingDoc'
import {
  composePage,
  drawOrderBadges,
  drawRegions,
  fitTransform,
  hitTestBubble,
  hitTestRegion,
  loadBitmaps,
  screenToPage,
  type OrderBadgeItem,
  type ViewTransform,
} from './compositor'
import { usePageFonts } from './useFontFace'

export type CanvasMode = 'letterer' | 'translator'

interface PageCanvasProps {
  detail: PageDetail
  fonts: FontInfo[]
  /** Translator: region tool + order badges; letterer: read-only region outlines. */
  mode?: CanvasMode
}

type DragMode =
  | 'pan'
  | 'split'
  | 'frame'
  | 'brush'
  | 'region'
  | 'region-edit'
  | null

const EMPTY_SET = new Set<string>()
const EMPTY_NUM_RECORD: Record<number, number> = {}
const EMPTY_STR_RECORD: Record<number, string> = {}
const EMPTY_LAYOUTS: Record<number, BubbleLayout> = {}
const HANDLE_SCREEN_PX = 10
const MIN_REGION_PX = 8

export function PageCanvas({
  detail,
  fonts,
  mode = 'letterer',
}: PageCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  /** Full compose without the in-progress brush stroke — reused while painting. */
  const baseCompositeRef = useRef<HTMLCanvasElement | null>(null)
  const baseCompositeValidRef = useRef(false)
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
    handle?: FrameHandle
    originFrame?: BBox
    bubbleId?: number
    regionId?: string
    moved?: boolean
  } | null>(null)
  /** Live frame while dragging (page px) — avoids undo spam mid-drag. */
  const liveFrameRef = useRef<BBox | null>(null)
  const [liveFrameTick, setLiveFrameTick] = useState(0)
  /** In-progress brush stroke (committed on pointerup as one undo step). */
  const liveStrokeRef = useRef<PaintStroke | null>(null)
  const [liveStrokeTick, setLiveStrokeTick] = useState(0)
  /** Live region rect while drawing (page px). */
  const liveRegionRef = useRef<BBox | null>(null)
  const [liveRegionTick, setLiveRegionTick] = useState(0)
  /** Live bbox while moving/resizing an existing region. */
  const liveRegionEditRef = useRef<BBox | null>(null)
  const [liveRegionEditTick, setLiveRegionEditTick] = useState(0)
  const [cursorPage, setCursorPage] = useState<Point | null>(null)

  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 })
  const [cursor, setCursor] = useState('grab')

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
  const selectRegion = useSession((s) => s.selectRegion)
  const setFrame = useSession((s) => s.setFrame)
  const appendPaintStroke = useSession((s) => s.appendPaintStroke)
  const addRegion = useSession((s) => s.addRegion)
  const updateRegionBbox = useSession((s) => s.updateRegionBbox)
  const setActiveTool = useSession((s) => s.setActiveTool)
  const setBrushColor = useSession((s) => s.setBrushColor)
  const brush = useSession((s) => s.brush)
  const theme = useSession((s) => s.ui.theme)
  const zoomCmd = useSession((s) => s.ui.zoomCmd)
  const setZoomPercent = useSession((s) => s.setZoomPercent)
  const activeTool = useSession((s) => s.ui.activeTool)
  const pageSession = useSession((s) => s.pages[pageId])
  const [toolHint, setToolHint] = useState<string | null>(null)

  const selectedBubbleId = pageSession?.selectedBubbleId ?? null
  const selectedRegionId = pageSession?.selectedRegionId ?? null
  const edit = pageSession?.edit
  const regions = edit?.regions ?? []
  const regionKind = useSession((s) => s.ui.regionKind)
  const regionTool =
    mode === 'translator' && activeTool === 'region' && regionKind != null
  const brushActive = mode === 'letterer' && brush.mode !== 'off'
  const disabledLayerIds = useMemo(
    () => (edit ? disabledLayerIdsFromEdit(edit) : EMPTY_SET),
    [edit],
  )
  const insetOverrideBubbleIds = useMemo(() => {
    const set = new Set<number>()
    if (!edit) return set
    for (const [k, be] of Object.entries(edit.bubbles)) {
      if (be.inset != null) set.add(Number(k))
    }
    return set
  }, [edit])
  const layoutsByBubble = pageSession?.layoutsByBubble ?? EMPTY_LAYOUTS
  const sizeOverrides = useMemo(
    () => (edit ? sizeOverridesFromEdit(edit) : EMPTY_NUM_RECORD),
    [edit],
  )
  const bubbleFontOverrides = useMemo(
    () => (edit ? bubbleFontsFromEdit(edit) : EMPTY_STR_RECORD),
    [edit],
  )
  const fontOverride = pageFontFromEdit(edit)

  const selectedBubble =
    selectedBubbleId != null
      ? detail.doc.bubbles.find((b) => b.id === selectedBubbleId)
      : undefined

  const selectedRegion =
    selectedRegionId != null
      ? regions.find((r) => r.id === selectedRegionId)
      : undefined

  const storedFrame = useMemo(() => {
    if (!selectedBubble) return null
    return resolveBubbleFrame(
      selectedBubble,
      edit?.bubbles[String(selectedBubble.id)],
    )
  }, [selectedBubble, edit])

  const selectedFrame = liveFrameRef.current ?? storedFrame
  const storedFrameKey = frameKey(storedFrame)
  const storedRegionBbox = selectedRegion?.bbox ?? null
  const storedRegionKey = frameKey(storedRegionBbox)
  const selectedRegionBbox = liveRegionEditRef.current ?? storedRegionBbox

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

  // Clear live overlay when selection changes or a committed frame lands
  // (value key — not array identity — so mid-drag refs don't wipe the drag).
  useEffect(() => {
    if (dragRef.current?.mode === 'frame') return
    liveFrameRef.current = null
  }, [selectedBubbleId, storedFrameKey])

  useEffect(() => {
    if (dragRef.current?.mode === 'region-edit') return
    liveRegionEditRef.current = null
  }, [selectedRegionId, storedRegionKey])

  // Invalidate cached page composite when layer/text/frame content changes.
  // Pan, zoom, cursor, and live stroke reuse the base canvas.
  useEffect(() => {
    baseCompositeValidRef.current = false
  }, [
    ready,
    fontsReady,
    selectedBubbleId,
    disabledLayerIds,
    layoutsByBubble,
    sizeOverrides,
    fontOverride,
    bubbleFontOverrides,
    fonts,
    detail,
    selectedFrame,
    liveFrameTick,
    brushActive,
    insetOverrideBubbleIds,
  ])

  // Load source + clean layer bitmaps (asset identity only — not session edits)
  useEffect(() => {
    let cancelled = false
    setReady(false)
    setLoadError(null)
    userTransformedRef.current = false
    baseCompositeValidRef.current = false

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, originalUrl, cleanUrlsKey, sourceW, sourceH])

  const paint = useEffectEvent(() => {
    const canvas = canvasRef.current
    const source = sourceRef.current
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
      .trim() || '#0e0f11'
    ctx.fillRect(0, 0, cssW, cssH)

    const { width: pw, height: ph } = detail.doc.source

    const ensurePageCanvas = (
      ref: { current: HTMLCanvasElement | null },
    ): HTMLCanvasElement => {
      let c = ref.current
      if (!c) {
        c = document.createElement('canvas')
        ref.current = c
      }
      if (c.width !== pw || c.height !== ph) {
        c.width = pw
        c.height = ph
        baseCompositeValidRef.current = false
      }
      return c
    }

    const off = ensurePageCanvas(offscreenRef)
    const base = ensurePageCanvas(baseCompositeRef)
    const octx = off.getContext('2d')
    const bctx = base.getContext('2d')
    if (!octx || !bctx) return

    const scale = transformRef.current.scale || 1
    const handleRadius = HANDLE_SCREEN_PX / scale
    const liveStroke = liveStrokeRef.current

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
      // No movable box for `editor`-status bubbles — vision never typesets
      // them automatically, so a draggable frame would be interactive-looking
      // but functionally dead. Fall back to the plain polygon outline.
      // Also hide frame handles while brushing.
      selectedFrame:
        !brushActive &&
        selectedBubbleId != null &&
        selectedBubble?.clean_status !== 'editor'
          ? (liveFrameRef.current ?? storedFrame)
          : null,
      handleRadius,
      liveStroke: null as typeof liveStroke,
      insetOverrideBubbleIds,
    }

    // Rebuild base composite only when content changed; while brushing, blit
    // base + live stroke instead of full recompose on every pointermove.
    if (!baseCompositeValidRef.current) {
      composePage(bctx, composeInput)
      baseCompositeValidRef.current = true
    }

    octx.clearRect(0, 0, pw, ph)
    octx.drawImage(base, 0, 0)
    if (liveStroke) {
      drawPaintStrokes(octx, [liveStroke], source)
    }

    const t = transformRef.current

    const drawComposedAt = (clipRight?: number) => {
      ctx.save()
      if (clipRight != null) {
        ctx.beginPath()
        ctx.rect(0, 0, clipRight, cssH)
        ctx.clip()
      }
      ctx.translate(t.offsetX, t.offsetY)
      ctx.scale(t.scale, t.scale)
      ctx.drawImage(off, 0, 0)
      // Brush size cursor (page-space circle)
      if (brushActive && cursorPage) {
        ctx.beginPath()
        ctx.arc(cursorPage[0]!, cursorPage[1]!, brush.radiusPx, 0, Math.PI * 2)
        ctx.strokeStyle = brush.mode === 'restore' ? '#2a6fdb' : '#b83a26'
        ctx.lineWidth = Math.max(1, 1.25 / t.scale)
        ctx.setLineDash([4 / t.scale, 3 / t.scale])
        ctx.stroke()
        ctx.setLineDash([])
      }
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
      const splitX = cssW * splitRatio
      drawComposedAt(splitX)
      drawOriginalAt(splitX)
      // Split sash is a DOM handle — only draw a thin divider line.
      ctx.save()
      const accent =
        getComputedStyle(document.documentElement)
          .getPropertyValue('--color-accent')
          .trim() || '#ff6a4d'
      ctx.fillStyle = accent
      ctx.fillRect(splitX - 1, 0, 2, cssH)
      ctx.restore()
    }

    // Visible overlay pass: regions + order badges (never baked into compose).
    const hasVerifying = regions.some((r) => r.status === 'verifying')
    const overlayRegions: {
      id: string
      bbox: BBox
      status?: string
      kind?: string
    }[] = regions.map((r) => ({
      id: r.id,
      status: r.status,
      kind: r.kind ?? 'bubble',
      bbox:
        r.id === selectedRegionId && liveRegionEditRef.current
          ? liveRegionEditRef.current
          : r.bbox,
    }))
    if (liveRegionRef.current) {
      overlayRegions.push({
        id: '__live__',
        bbox: liveRegionRef.current,
        kind: regionKind ?? 'bubble',
      })
    }
    if (overlayRegions.length || mode === 'translator') {
      ctx.save()
      ctx.translate(t.offsetX, t.offsetY)
      ctx.scale(t.scale, t.scale)
      if (overlayRegions.length) {
        drawRegions(
          ctx,
          overlayRegions,
          selectedRegionId,
          t.scale || 1,
          {
            interactive: mode === 'translator',
            pulsePhase: hasVerifying ? performance.now() / 200 : 0,
          },
        )
      }
      if (mode === 'translator') {
        const items = orderedItems(detail.doc, edit)
        const badges: OrderBadgeItem[] = []
        items.forEach((item, i) => {
          if (item.kind === 'bubble') {
            const b = detail.doc.bubbles.find((x) => x.id === Number(item.id))
            if (b) badges.push({ kind: 'bubble', id: item.id, bbox: b.bbox, index: i + 1 })
          } else {
            const r =
              item.id === '__live__'
                ? null
                : item.id === selectedRegionId && liveRegionEditRef.current
                  ? { id: item.id, bbox: liveRegionEditRef.current }
                  : regions.find((x) => x.id === item.id)
            if (r) badges.push({ kind: 'region', id: r.id, bbox: r.bbox, index: i + 1 })
          }
        })
        drawOrderBadges(ctx, badges, t.scale || 1)
      }
      ctx.restore()
    }

    // Keep status zoom in sync with transform (avoid store churn).
    const pct = Math.round((transformRef.current.scale || 1) * 100)
    if (useSession.getState().ui.zoomPercent !== pct) {
      setZoomPercent(pct)
    }
  })

  const schedulePaint = useEffectEvent(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
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
    selectedFrame,
    liveFrameTick,
    liveStrokeTick,
    liveRegionTick,
    liveRegionEditTick,
    brushActive,
    brush.mode,
    brush.radiusPx,
    cursorPage,
    insetOverrideBubbleIds,
    theme,
    regions,
    selectedRegionId,
    regionKind,
    mode,
    edit,
  ])

  // Pulse animation while any region is verifying.
  useEffect(() => {
    const verifying = regions.some((r) => r.status === 'verifying')
    if (!verifying) return
    const id = window.setInterval(() => schedulePaint(), 80)
    return () => window.clearInterval(id)
  }, [regions, schedulePaint])

  // Apply zoom commands from ZoomControls.
  useEffect(() => {
    if (!zoomCmd || !ready) return
    const cssW = viewSize.w || wrapRef.current?.clientWidth || 0
    const cssH = viewSize.h || wrapRef.current?.clientHeight || 0
    if (cssW < 1 || cssH < 1) return

    if (zoomCmd.kind === 'fit') {
      userTransformedRef.current = false
      transformRef.current = fitTransform(sourceW, sourceH, cssW, cssH)
    } else if (zoomCmd.kind === '100') {
      userTransformedRef.current = true
      const scale = 1
      transformRef.current = {
        scale,
        offsetX: (cssW - sourceW * scale) / 2,
        offsetY: (cssH - sourceH * scale) / 2,
      }
    } else if (zoomCmd.kind === 'set') {
      userTransformedRef.current = true
      const scale = Math.min(8, Math.max(0.05, zoomCmd.scale))
      const cx = cssW / 2
      const cy = cssH / 2
      const page = screenToPage(cx, cy, transformRef.current)
      transformRef.current = {
        scale,
        offsetX: cx - page.x * scale,
        offsetY: cy - page.y * scale,
      }
    }
    schedulePaint()
  }, [zoomCmd, ready, viewSize.w, viewSize.h, sourceW, sourceH])

  // Transient tool hint on tool change.
  useEffect(() => {
    const kindHints: Record<string, string> = {
      bubble: 'Bubble kutusu çiz',
      sfx: 'SFX kutusu çiz',
      other: 'Other kutusu çiz',
    }
    const labels: Record<string, string> = {
      select: 'Seç',
      frame: 'Kutu — taşı / boyutlandır',
      paint: 'Boya fırçası',
      restore: 'Geri al fırçası',
      region:
        regionKind != null
          ? (kindHints[regionKind] ?? 'Metin kutusu çiz')
          : 'Kutu türü seç',
    }
    setToolHint(labels[activeTool] ?? null)
    const t = window.setTimeout(() => setToolHint(null), 2000)
    return () => window.clearTimeout(t)
  }, [activeTool, regionKind])

  // Leaving region tool (or Esc) cancels an in-progress draw.
  const cancelRegionDraw = useEffectEvent(() => {
    const drawing =
      liveRegionRef.current != null || dragRef.current?.mode === 'region'
    if (!drawing) return false
    liveRegionRef.current = null
    if (dragRef.current?.mode === 'region') dragRef.current = null
    setLiveRegionTick((n) => n + 1)
    schedulePaint()
    return true
  })

  useEffect(() => {
    if (activeTool !== 'region') cancelRegionDraw()
  }, [activeTool])

  useEffect(() => {
    if (mode !== 'translator') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (cancelRegionDraw()) {
        e.preventDefault()
        setActiveTool('select')
        return
      }
      if (dragRef.current?.mode === 'region-edit') {
        e.preventDefault()
        liveRegionEditRef.current = null
        dragRef.current = null
        setLiveRegionEditTick((n) => n + 1)
        schedulePaint()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, setActiveTool])

  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [])

  // Native non-passive wheel: React's onWheel is passive, so preventDefault
  // would warn and fail to stop browser scroll while zooming.
  const onWheel = useEffectEvent((e: WheelEvent) => {
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
  })

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const frameHitAt = (pageX: number, pageY: number): FrameHandle | null => {
    if (!selectedBubble || !storedFrame) return null
    if (selectedBubble.clean_status === 'editor') return null
    const scale = transformRef.current.scale || 1
    // Match drawn handle half-size (constant screen px → page px)
    const half = HANDLE_SCREEN_PX / scale
    return hitTestFrame(liveFrameRef.current ?? storedFrame, pageX, pageY, half)
  }

  const regionHitAt = (pageX: number, pageY: number): FrameHandle | null => {
    if (mode !== 'translator' || !selectedRegionBbox) return null
    const scale = transformRef.current.scale || 1
    const half = HANDLE_SCREEN_PX / scale
    return hitTestFrame(
      liveRegionEditRef.current ?? selectedRegionBbox,
      pageX,
      pageY,
      half,
    )
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (viewMode === 'split') {
      // Split sash is a DOM handle — ignore canvas hits near it.
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

    // Brush stroke — requires a selected bubble; clips to its bbox.
    if (e.button === 0 && brushActive) {
      const page = screenToPage(x, y, transformRef.current)
      setCursorPage([page.x, page.y])
      if (!selectedBubble) {
        // Select under cursor if none selected.
        const hit = hitTestBubble(detail.doc.bubbles, page.x, page.y)
        if (hit) selectBubble(hit.id)
        return
      }
      const clip = paintClipBBox(selectedBubble.bbox, brush.radiusPx)
      const pt = clampPointToBBox(page.x, page.y, clip)
      let color = brush.color
      if (brush.mode === 'fill') {
        const src = sourceRef.current
        if (src) {
          color = sampleBitmapColor(src, pt[0]!, pt[1]!)
          setBrushColor(color)
        } else {
          color = color ?? [255, 255, 255]
        }
      }
      liveStrokeRef.current = {
        id: nextStrokeId(),
        bubble_id: selectedBubble.id,
        mode: brush.mode === 'restore' ? 'restore' : 'fill',
        color: brush.mode === 'fill' ? (color ?? [255, 255, 255]) : undefined,
        radius_px: brush.radiusPx,
        points: [pt],
      }
      dragRef.current = {
        mode: 'brush',
        startX: page.x,
        startY: page.y,
        originX: transformRef.current.offsetX,
        originY: transformRef.current.offsetY,
        originSplit: splitRatio,
        bubbleId: selectedBubble.id,
        moved: false,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      setLiveStrokeTick((t) => t + 1)
      setCursor('crosshair')
      return
    }

    // Translator: move/resize selected region (select tool).
    if (
      e.button === 0 &&
      mode === 'translator' &&
      !regionTool &&
      selectedRegionId &&
      selectedRegionBbox
    ) {
      const page = screenToPage(x, y, transformRef.current)
      const handle = regionHitAt(page.x, page.y)
      if (handle) {
        dragRef.current = {
          mode: 'region-edit',
          startX: page.x,
          startY: page.y,
          originX: transformRef.current.offsetX,
          originY: transformRef.current.offsetY,
          originSplit: splitRatio,
          handle,
          originFrame: [
            ...(liveRegionEditRef.current ?? selectedRegionBbox),
          ] as BBox,
          regionId: selectedRegionId,
          moved: false,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
        setCursor(cursorForFrameHandle(handle))
        return
      }
    }

    // Translator region draw — drag a dashed rectangle.
    if (e.button === 0 && regionTool) {
      const page = screenToPage(x, y, transformRef.current)
      // Click on an existing box → select + edit instead of starting a new draw.
      const existing = hitTestRegion(regions, page.x, page.y)
      if (existing) {
        selectRegion(existing.id)
        setActiveTool('select')
        requestAnimationFrame(() => {
          const el = document.querySelector(
            'aside [data-selected="true"] textarea',
          )
          if (el instanceof HTMLTextAreaElement) {
            el.focus()
            const len = el.value.length
            el.setSelectionRange(len, len)
          }
        })
        return
      }
      const px = Math.max(0, Math.min(sourceW, page.x))
      const py = Math.max(0, Math.min(sourceH, page.y))
      liveRegionRef.current = [px, py, px, py]
      dragRef.current = {
        mode: 'region',
        startX: px,
        startY: py,
        originX: transformRef.current.offsetX,
        originY: transformRef.current.offsetY,
        originSplit: splitRatio,
        moved: false,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      setLiveRegionTick((t) => t + 1)
      setCursor('crosshair')
      return
    }

    if (
      e.button === 0 &&
      mode === 'letterer' &&
      selectedBubble &&
      storedFrame &&
      selectedBubble.clean_status !== 'editor'
    ) {
      const page = screenToPage(x, y, transformRef.current)
      const handle = frameHitAt(page.x, page.y)
      if (handle) {
        dragRef.current = {
          mode: 'frame',
          startX: page.x,
          startY: page.y,
          originX: transformRef.current.offsetX,
          originY: transformRef.current.offsetY,
          originSplit: splitRatio,
          handle,
          originFrame: [...(liveFrameRef.current ?? storedFrame)] as BBox,
          bubbleId: selectedBubble.id,
          moved: false,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
        setCursor(cursorForFrameHandle(handle))
        return
      }
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
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (brushActive) {
      const page = screenToPage(x, y, transformRef.current)
      setCursorPage([page.x, page.y])
    }

    const drag = dragRef.current
    if (!drag) {
      if (regionTool) {
        setCursor('crosshair')
      } else if (brushActive) {
        setCursor(selectedBubble ? 'crosshair' : 'cell')
      } else if (
        mode === 'translator' &&
        selectedRegionId &&
        selectedRegionBbox
      ) {
        const page = screenToPage(x, y, transformRef.current)
        setCursor(cursorForFrameHandle(regionHitAt(page.x, page.y)))
      } else if (
        mode === 'letterer' &&
        selectedBubble &&
        storedFrame &&
        selectedBubble.clean_status !== 'editor'
      ) {
        const page = screenToPage(x, y, transformRef.current)
        setCursor(cursorForFrameHandle(frameHitAt(page.x, page.y)))
      } else {
        setCursor('grab')
      }
      return
    }

    if (drag.mode === 'split') {
      return
    }

    if (drag.mode === 'region') {
      const page = screenToPage(x, y, transformRef.current)
      const px = Math.max(0, Math.min(sourceW, page.x))
      const py = Math.max(0, Math.min(sourceH, page.y))
      const x0 = Math.min(drag.startX, px)
      const y0 = Math.min(drag.startY, py)
      const x1 = Math.max(drag.startX, px)
      const y1 = Math.max(drag.startY, py)
      if (Math.abs(x1 - x0) > 0.5 || Math.abs(y1 - y0) > 0.5) drag.moved = true
      liveRegionRef.current = [x0, y0, x1, y1]
      setLiveRegionTick((t) => t + 1)
      schedulePaint()
      return
    }

    if (drag.mode === 'region-edit' && drag.originFrame && drag.handle != null) {
      const page = screenToPage(x, y, transformRef.current)
      const dx = page.x - drag.startX
      const dy = page.y - drag.startY
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) drag.moved = true
      let next: BBox
      if (drag.handle === 'move') {
        next = nudgeFrame(drag.originFrame, dx, dy)
      } else {
        next = resizeFrame(drag.originFrame, drag.handle, dx, dy)
      }
      next = clampFrame(next, sourceW, sourceH)
      liveRegionEditRef.current = next
      setLiveRegionEditTick((t) => t + 1)
      schedulePaint()
      return
    }

    if (drag.mode === 'brush' && liveStrokeRef.current && selectedBubble) {
      const page = screenToPage(x, y, transformRef.current)
      const clip = paintClipBBox(selectedBubble.bbox, brush.radiusPx)
      const pt = clampPointToBBox(page.x, page.y, clip)
      const stroke = liveStrokeRef.current
      if (shouldAppendPoint(stroke.points, pt, stroke.radius_px)) {
        stroke.points = [...stroke.points, pt]
        drag.moved = true
        setLiveStrokeTick((t) => t + 1)
        schedulePaint()
      }
      return
    }

    if (drag.mode === 'frame' && drag.originFrame && drag.handle != null) {
      const page = screenToPage(x, y, transformRef.current)
      const dx = page.x - drag.startX
      const dy = page.y - drag.startY
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) drag.moved = true
      let next: BBox
      if (drag.handle === 'move') {
        next = nudgeFrame(drag.originFrame, dx, dy)
      } else {
        next = resizeFrame(drag.originFrame, drag.handle, dx, dy)
      }
      next = clampFrame(next, sourceW, sourceH)
      liveFrameRef.current = next
      setLiveFrameTick((t) => t + 1)
      schedulePaint()
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

    if (drag?.mode === 'brush') {
      const stroke = liveStrokeRef.current
      liveStrokeRef.current = null
      setLiveStrokeTick((t) => t + 1)
      if (stroke && stroke.points.length > 0) {
        appendPaintStroke(pageId, stroke)
      }
      setCursor(brushActive ? 'crosshair' : 'grab')
      return
    }

    if (drag?.mode === 'region') {
      const final = liveRegionRef.current
      liveRegionRef.current = null
      setLiveRegionTick((t) => t + 1)
      if (final && drag.moved) {
        const [x0, y0, x1, y1] = final
        if (x1 - x0 >= MIN_REGION_PX && y1 - y0 >= MIN_REGION_PX) {
          addRegion(pageId, final, '', regionKind ?? undefined)
          setActiveTool('select')
        }
      }
      setCursor('grab')
      schedulePaint()
      return
    }

    if (drag?.mode === 'region-edit' && drag.regionId) {
      const final = liveRegionEditRef.current
      if (final && drag.moved) {
        updateRegionBbox(pageId, drag.regionId, final)
      }
      liveRegionEditRef.current = null
      setLiveRegionEditTick((t) => t + 1)
      setCursor('grab')
      schedulePaint()
      // Click without drag → keep selection and focus the panel editor.
      if (!drag.moved) {
        selectRegion(drag.regionId)
        requestAnimationFrame(() => {
          const el = document.querySelector(
            'aside [data-selected="true"] textarea',
          )
          if (el instanceof HTMLTextAreaElement) {
            el.focus()
            const len = el.value.length
            el.setSelectionRange(len, len)
          }
        })
      }
      return
    }

    if (drag?.mode === 'frame' && drag.bubbleId != null) {
      const final = liveFrameRef.current
      if (final && drag.moved) {
        // Persist the box only — moving/resizing it never reflows text by
        // itself (plan §Faz 1 #4); the letterer must press "Oto dizgi".
        setFrame(pageId, drag.bubbleId, final)
      }
      liveFrameRef.current = null
      setLiveFrameTick((t) => t + 1)
      setCursor('grab')
      return
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
    // Regions before bubbles — smaller/manual targets win.
    const regionHit = hitTestRegion(regions, page.x, page.y)
    if (regionHit) {
      selectRegion(regionHit.id)
      requestAnimationFrame(() => {
        const el = document.querySelector(
          'aside [data-selected="true"] textarea',
        )
        if (el instanceof HTMLTextAreaElement) {
          el.focus()
          const len = el.value.length
          el.setSelectionRange(len, len)
        }
      })
      return
    }
    const hit = hitTestBubble(detail.doc.bubbles, page.x, page.y)
    if (hit) {
      selectBubble(hit.id)
      if (mode === 'translator') {
        requestAnimationFrame(() => {
          const el = document.querySelector(
            'aside [data-selected="true"] textarea',
          )
          if (el instanceof HTMLTextAreaElement) {
            el.focus()
            const len = el.value.length
            el.setSelectionRange(len, len)
          }
        })
      }
      return
    }
    selectBubble(null)
    selectRegion(null)
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

  const onSplitPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const onMove = (ev: PointerEvent) => {
      const x = ev.clientX - rect.left
      setSplitRatio(x / Math.max(1, rect.width))
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      try {
        ;(ev.target as HTMLElement).releasePointerCapture?.(ev.pointerId)
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden bg-[var(--color-canvas-bg)]"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />
      {viewMode === 'split' && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(splitRatio * 100)}
          aria-label="Görünüm ayıracı"
          tabIndex={0}
          onPointerDown={onSplitPointerDown}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 0.05 : 0.02
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              setSplitRatio(splitRatio - step)
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              setSplitRatio(splitRatio + step)
            }
          }}
          className="absolute top-0 z-10 h-full w-4 -translate-x-1/2 cursor-col-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
          style={{ left: `${splitRatio * 100}%` }}
        >
          <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] text-white shadow-sm">
            ▸◂
          </span>
        </div>
      )}
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
      {toolHint && (
        <div className="pointer-events-none absolute bottom-14 left-1/2 z-10 -translate-x-1/2 rounded-md bg-[var(--color-surface-raised)]/95 px-3 py-1 text-[length:var(--text-ui)] text-[var(--color-ink-muted)] shadow-sm ring-1 ring-[var(--color-border)]">
          {toolHint}
        </div>
      )}
    </div>
  )
}
