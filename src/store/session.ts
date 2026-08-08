import { create } from 'zustand'
import type {
  BBox,
  BrushState,
  BubbleEdit,
  BubbleLayout,
  Layer,
  PageEdit,
  PaintStroke,
  Region,
  RegionKind,
  SaveStatus,
  ViewMode,
} from '@/api/types'
import { BRUSH_PRESETS } from '@/lib/paintStroke'

function newRegionId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)]!
  }
  return `r-${suffix}`
}

const UNDO_CAP = 50
/** Consecutive same-key edits (e.g. keystrokes in one bubble) within this
 * window collapse into a single undo step instead of one-per-keystroke. */
const UNDO_COALESCE_MS = 1200

export const DEFAULT_BRUSH: BrushState = {
  mode: 'off',
  radiusPx: BRUSH_PRESETS[2] ?? 8,
  color: null,
}

export interface PageSession {
  selectedBubbleId: number | null
  /** Translator manual box selection — mutually exclusive with bubble. */
  selectedRegionId: string | null
  /** Working overlay (matches server PageEdit shape). */
  edit: PageEdit
  /** True when local edit differs from last hydrated/saved snapshot. */
  dirty: boolean
  saveStatus: SaveStatus
  saveError: string | null
  /**
   * Pending 409: local overlay is still shown; ``server`` is the remote copy.
   * User chooses take-server or keep-mine.
   */
  conflictServer: PageEdit | null
  /** Ephemeral typeset results — not part of the overlay. */
  layoutsByBubble: Record<number, BubbleLayout>
  textLayers: Layer[] | null
  undoPast: PageEdit[]
  undoFuture: PageEdit[]
  /** Set after first hydrate from GET /pages/:id (or explicit load). */
  hydrated: boolean
  /** Last coalesced undo group (e.g. `text:<bubbleId>`) — lets rapid same-key
   * edits (keystrokes) collapse into one undo step instead of one per call. */
  lastUndoCoalesce?: { key: string; at: number }
}

interface SessionState {
  selectedPageId: number | null
  chapterSlug: string | null
  viewMode: ViewMode
  splitRatio: number
  pages: Record<number, PageSession>
  guideDismissed: boolean
  /** Ephemeral brush tool (not persisted in PageEdit). */
  brush: BrushState
  /** Presentation prefs — survive resetAll. */
  ui: UiPrefs

  setChapterSlug: (slug: string | null) => void
  selectPage: (pageId: number | null) => void
  selectBubble: (bubbleId: number | null) => void
  selectRegion: (regionId: string | null) => void

  setBrushMode: (mode: BrushState['mode']) => void
  setBrushRadius: (radiusPx: number) => void
  setBrushColor: (color: [number, number, number] | null) => void
  setActiveTool: (tool: ActiveTool) => void
  setRegionKind: (kind: RegionKind | null) => void
  patchUi: (patch: Partial<UiPrefs>) => void
  setTheme: (theme: ThemePreference) => void
  setWorkspaceRole: (role: WorkspaceRole) => void
  setZoomPercent: (pct: number) => void
  requestZoom: (kind: 'fit' | '100' | 'set', scale?: number) => void
  openGuide: () => void

  /** Load server overlay into session (skips if dirty or incoming rev is stale). */
  hydrateEdit: (pageId: number, edit: PageEdit | null | undefined, rev?: number) => void
  /** Force-replace overlay after successful save or reset. */
  setEditFromServer: (pageId: number, edit: PageEdit) => void

  patchBubble: (
    pageId: number,
    bubbleId: number,
    patch: { [K in keyof BubbleEdit]?: BubbleEdit[K] | null } | null,
    opts?: { undo?: boolean },
  ) => void
  setBubbleText: (pageId: number, bubbleId: number, text: string) => void
  clearBubbleText: (pageId: number, bubbleId: number) => void
  setBubbleFont: (pageId: number, bubbleId: number, fontKey: string | null) => void
  setSizeOverride: (pageId: number, bubbleId: number, scale: number | null) => void
  setFontPx: (pageId: number, bubbleId: number, px: number | null) => void
  setLeading: (pageId: number, bubbleId: number, leading: number | null) => void
  setAlign: (
    pageId: number,
    bubbleId: number,
    align: BubbleEdit['align'] | null,
  ) => void
  setFrame: (
    pageId: number,
    bubbleId: number,
    frame: BubbleEdit['frame'] | null,
    opts?: { undo?: boolean },
  ) => void
  setInset: (pageId: number, bubbleId: number, inset: number | null) => void
  appendPaintStroke: (pageId: number, stroke: PaintStroke) => void
  clearPaintForBubble: (pageId: number, bubbleId: number) => void
  setPageFont: (pageId: number, fontKey: string | null) => void
  toggleLayer: (pageId: number, layerId: string) => void
  setLayerEnabled: (pageId: number, layerId: string, enabled: boolean) => void
  setBubbleDone: (pageId: number, bubbleId: number, done: boolean) => void
  toggleBubbleDone: (pageId: number, bubbleId: number) => void

  addRegion: (
    pageId: number,
    bbox: BBox,
    text?: string,
    kind?: RegionKind,
  ) => string
  updateRegionBbox: (pageId: number, regionId: string, bbox: BBox) => void
  setRegionText: (pageId: number, regionId: string, text: string) => void
  updateRegionStatus: (
    pageId: number,
    regionId: string,
    status: Region['status'],
    confidence?: number | null,
    bubbleId?: number,
  ) => void
  /** Apply server verify overlay (regions + promoted bubble texts) without undo. */
  applyVerifyEdit: (pageId: number, edit: PageEdit) => void
  deleteRegion: (pageId: number, regionId: string) => void
  /** Hard-delete a seed bubble from the working set (Cmd+Z to restore). */
  deleteBubble: (pageId: number, bubbleId: number) => void
  moveOrder: (pageId: number, fromIndex: number, toIndex: number) => void
  reorder: (pageId: number, tokens: string[]) => void

  setLayouts: (pageId: number, layouts: BubbleLayout[]) => void
  applyTypeset: (
    pageId: number,
    layouts: BubbleLayout[],
    textLayers: Layer[],
  ) => void
  /** Drop session typeset result for one bubble (editor trial undo). */
  clearBubbleTypeset: (pageId: number, bubbleId: number) => void
  setViewMode: (mode: ViewMode) => void
  setSplitRatio: (ratio: number) => void

  markSaving: (pageId: number) => void
  markSaved: (pageId: number, edit: PageEdit) => void
  markSaveError: (pageId: number, message: string) => void
  /** Keep local overlay content; adopt server rev after a 409 so retry can succeed. */
  syncRevFromServer: (pageId: number, rev: number) => void
  /** Surface a 409: keep local edit visible, stash server copy for resolution. */
  setConflict: (pageId: number, serverEdit: PageEdit) => void
  /** Resolve 409 by replacing local overlay with the server copy. Returns the adopted edit. */
  resolveConflictTakeServer: (pageId: number) => PageEdit | null
  /** Resolve 409 by keeping local overlay and bumping rev to server's. */
  resolveConflictKeepMine: (pageId: number) => void

  undo: (pageId: number) => void
  redo: (pageId: number) => void

  resetPageLocal: (pageId: number) => void
  clearTypeset: (pageId: number) => void
  resetAll: () => void
  dismissGuide: () => void
  pageSession: (pageId: number | null | undefined) => PageSession
}

export function emptyEdit(rev = 0): PageEdit {
  return {
    rev,
    page: {},
    bubbles: {},
    paint: [],
    regions: [],
    order: [],
    removed_bubbles: [],
  }
}

function emptyPage(): PageSession {
  return {
    selectedBubbleId: null,
    selectedRegionId: null,
    edit: emptyEdit(0),
    dirty: false,
    saveStatus: 'idle',
    saveError: null,
    conflictServer: null,
    layoutsByBubble: {},
    textLayers: null,
    undoPast: [],
    undoFuture: [],
    hydrated: false,
    lastUndoCoalesce: undefined,
  }
}

function ensurePage(
  pages: Record<number, PageSession>,
  pageId: number,
): PageSession {
  return pages[pageId] ?? emptyPage()
}

function cloneEdit(edit: PageEdit): PageEdit {
  return structuredClone(edit)
}

/** Stable compare for autosave dirty detection (ignore key insertion order). */
function stableEditCore(edit: PageEdit): string {
  const core = {
    page: edit.page ?? {},
    bubbles: edit.bubbles ?? {},
    paint: edit.paint ?? [],
    regions: edit.regions ?? [],
    order: edit.order ?? [],
    removed_bubbles: edit.removed_bubbles ?? [],
  }
  return JSON.stringify(core, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(obj).sort()) sorted[k] = obj[k]
      return sorted
    }
    return v
  })
}

function bubbleKey(id: number): string {
  return String(id)
}

/** Infer bubble id from layer id like cln_3 / txt_3 / pnt_3. */
function bubbleIdFromLayer(layerId: string): number | null {
  const m = /^(?:cln|txt|pnt)_(\d+)$/.exec(layerId)
  return m ? Number(m[1]) : null
}

function pruneBubble(be: BubbleEdit): BubbleEdit | null {
  const next: BubbleEdit = { ...be }
  if (next.layers_off && next.layers_off.length === 0) delete next.layers_off
  if (next.done === false) delete next.done
  if (next.typeset_try === false) delete next.typeset_try
  if (Object.keys(next).length === 0) return null
  return next
}

function withBubblePatch(
  edit: PageEdit,
  bubbleId: number,
  patch: { [K in keyof BubbleEdit]?: BubbleEdit[K] | null } | null,
): PageEdit {
  const key = bubbleKey(bubbleId)
  const bubbles = { ...edit.bubbles }
  if (patch === null) {
    delete bubbles[key]
    return { ...edit, bubbles }
  }
  const cur = { ...(bubbles[key] ?? {}) }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null) {
      delete cur[k as keyof BubbleEdit]
    } else {
      ;(cur as Record<string, unknown>)[k] = v
    }
  }
  const pruned = pruneBubble(cur)
  if (pruned) bubbles[key] = pruned
  else delete bubbles[key]
  return { ...edit, bubbles }
}

const GUIDE_KEY = 'fukiflow.guideDismissed'
const UI_KEY = 'fukiflow.ui'

export type ThemePreference = 'system' | 'light' | 'dark'
export type WorkspaceRole = 'letterer' | 'translator'
export type ActiveTool = 'select' | 'frame' | 'paint' | 'restore' | 'region'
export type BubbleFilter = 'all' | 'undone' | 'overflow' | 'flag'
export type ThumbSize = 'sm' | 'lg'
export type ZoomCommand =
  | { seq: number; kind: 'fit' }
  | { seq: number; kind: '100' }
  | { seq: number; kind: 'set'; scale: number }

function normalizeBubbleFilter(
  value: string | undefined | null,
): BubbleFilter {
  if (value === 'editor' || value === 'flag') return 'flag'
  if (value === 'undone' || value === 'overflow' || value === 'all') return value
  return 'all'
}

export interface UiPrefs {
  theme: ThemePreference
  workspaceRole: WorkspaceRole
  galleryWidth: number
  panelWidth: number
  panelListRatio: number
  bubbleFilter: BubbleFilter
  bubbleSearch: string
  activeTool: ActiveTool
  /** Selected region draw kind — null until user picks bubble/sfx/other. */
  regionKind: RegionKind | null
  zoomPercent: number
  galleryDrawerOpen: boolean
  thumbSize: ThumbSize
  zoomCmd: ZoomCommand | null
}

export const UI_DEFAULTS: UiPrefs = {
  theme: 'system',
  workspaceRole: 'letterer',
  galleryWidth: 208,
  panelWidth: 352,
  panelListRatio: 0.32,
  bubbleFilter: 'all',
  bubbleSearch: '',
  activeTool: 'select',
  regionKind: null,
  zoomPercent: 100,
  galleryDrawerOpen: false,
  thumbSize: 'sm',
  zoomCmd: null,
}

export const GALLERY_WIDTH = { min: 160, max: 360, default: 208 }
export const PANEL_WIDTH = { min: 300, max: 560, default: 352 }

function readGuideDismissed(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1'
  } catch {
    return false
  }
}

function readUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(UI_KEY)
    if (!raw) return { ...UI_DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<UiPrefs>
    return {
      ...UI_DEFAULTS,
      theme: parsed.theme ?? UI_DEFAULTS.theme,
      workspaceRole:
        parsed.workspaceRole === 'translator' ? 'translator' : 'letterer',
      galleryWidth: clampNum(
        parsed.galleryWidth,
        GALLERY_WIDTH.min,
        GALLERY_WIDTH.max,
        GALLERY_WIDTH.default,
      ),
      panelWidth: clampNum(
        parsed.panelWidth,
        PANEL_WIDTH.min,
        PANEL_WIDTH.max,
        PANEL_WIDTH.default,
      ),
      panelListRatio: clampNum(parsed.panelListRatio, 0.2, 0.55, 0.32),
      bubbleFilter: normalizeBubbleFilter(parsed.bubbleFilter),
      thumbSize: parsed.thumbSize ?? UI_DEFAULTS.thumbSize,
      // Ephemeral — never hydrate from storage
      bubbleSearch: '',
      activeTool: 'select',
      regionKind: null,
      zoomPercent: 100,
      galleryDrawerOpen: false,
      zoomCmd: null,
    }
  } catch {
    return { ...UI_DEFAULTS }
  }
}

function persistUi(ui: UiPrefs) {
  try {
    localStorage.setItem(
      UI_KEY,
      JSON.stringify({
        theme: ui.theme,
        workspaceRole: ui.workspaceRole,
        galleryWidth: ui.galleryWidth,
        panelWidth: ui.panelWidth,
        panelListRatio: ui.panelListRatio,
        bubbleFilter: ui.bubbleFilter,
        thumbSize: ui.thumbSize,
      }),
    )
  } catch {
    /* ignore */
  }
}

function clampNum(
  v: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (v == null || !Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, v))
}

/** Resolve system/light/dark → attribute written on <html>. */
export function applyThemeAttribute(theme: ThemePreference) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

function toolToBrush(tool: ActiveTool): BrushState['mode'] {
  if (tool === 'paint') return 'fill'
  if (tool === 'restore') return 'restore'
  return 'off'
}

function brushToTool(mode: BrushState['mode']): ActiveTool {
  if (mode === 'fill') return 'paint'
  if (mode === 'restore') return 'restore'
  return 'select'
}

type Mutator = (edit: PageEdit) => PageEdit

function applyEditMutation(
  pages: Record<number, PageSession>,
  pageId: number,
  mutate: Mutator,
  opts?: { undo?: boolean; coalesceKey?: string },
): Record<number, PageSession> {
  const cur = ensurePage(pages, pageId)
  const recordUndo = opts?.undo !== false
  const nextEdit = mutate(cur.edit)

  const now = Date.now()
  const coalesceKey = opts?.coalesceKey
  // Same key (e.g. same bubble's text field) within the window → this edit
  // joins the in-progress undo group instead of pushing a new snapshot.
  const coalescing =
    recordUndo &&
    coalesceKey != null &&
    cur.lastUndoCoalesce?.key === coalesceKey &&
    now - cur.lastUndoCoalesce.at < UNDO_COALESCE_MS

  const undoPast =
    recordUndo && !coalescing
      ? [...cur.undoPast, cloneEdit(cur.edit)].slice(-UNDO_CAP)
      : cur.undoPast
  const undoFuture = recordUndo && !coalescing ? [] : cur.undoFuture
  const lastUndoCoalesce = recordUndo
    ? coalesceKey != null
      ? { key: coalesceKey, at: now }
      : undefined
    : cur.lastUndoCoalesce

  return {
    ...pages,
    [pageId]: {
      ...cur,
      edit: nextEdit,
      dirty: true,
      // Keep conflict/error banners visible while the user keeps editing.
      saveStatus:
        cur.saveStatus === 'error' || cur.saveStatus === 'conflict'
          ? cur.saveStatus
          : 'idle',
      saveError:
        cur.saveStatus === 'error' || cur.saveStatus === 'conflict'
          ? cur.saveError
          : null,
      undoPast,
      undoFuture,
      lastUndoCoalesce,
    },
  }
}

export const useSession = create<SessionState>((set, get) => ({
  selectedPageId: null,
  chapterSlug: null,
  viewMode: 'composed',
  splitRatio: 0.5,
  pages: {},
  guideDismissed: readGuideDismissed(),
  brush: { ...DEFAULT_BRUSH },
  ui: readUiPrefs(),

  setChapterSlug: (slug) => set({ chapterSlug: slug }),

  selectPage: (pageId) => set({ selectedPageId: pageId }),

  selectBubble: (bubbleId) => {
    const pageId = get().selectedPageId
    if (pageId == null) return
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            selectedBubbleId: bubbleId,
            selectedRegionId: bubbleId != null ? null : cur.selectedRegionId,
          },
        },
      }
    })
  },

  selectRegion: (regionId) => {
    const pageId = get().selectedPageId
    if (pageId == null) return
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            selectedRegionId: regionId,
            selectedBubbleId: regionId != null ? null : cur.selectedBubbleId,
          },
        },
      }
    })
  },

  setBrushMode: (mode) =>
    set((s) => {
      const ui = { ...s.ui, activeTool: brushToTool(mode) }
      return { brush: { ...s.brush, mode }, ui }
    }),
  setBrushRadius: (radiusPx) =>
    set((s) => ({
      brush: {
        ...s.brush,
        radiusPx: Math.max(1, Math.min(64, Math.round(radiusPx))),
      },
    })),
  setBrushColor: (color) =>
    set((s) => ({ brush: { ...s.brush, color } })),

  setActiveTool: (tool) =>
    set((s) => {
      const ui = {
        ...s.ui,
        activeTool: tool,
        // Clear draw kind when leaving the region tool.
        regionKind: tool === 'region' ? s.ui.regionKind : null,
      }
      return {
        ui,
        brush: { ...s.brush, mode: toolToBrush(tool) },
      }
    }),

  setRegionKind: (kind) =>
    set((s) => ({
      ui: {
        ...s.ui,
        regionKind: kind,
        ...(kind != null ? { activeTool: 'region' as const } : {}),
      },
      ...(kind != null
        ? { brush: { ...s.brush, mode: 'off' as const } }
        : {}),
    })),

  patchUi: (patch) =>
    set((s) => {
      const ui = { ...s.ui, ...patch }
      persistUi(ui)
      return { ui }
    }),

  setTheme: (theme) =>
    set((s) => {
      const ui = { ...s.ui, theme }
      persistUi(ui)
      applyThemeAttribute(theme)
      return { ui }
    }),

  setWorkspaceRole: (role) =>
    set((s) => {
      const ui = { ...s.ui, workspaceRole: role }
      persistUi(ui)
      return { ui }
    }),

  setZoomPercent: (pct) =>
    set((s) => ({
      ui: { ...s.ui, zoomPercent: Math.round(pct) },
    })),

  requestZoom: (kind, scale) =>
    set((s) => {
      const seq = (s.ui.zoomCmd?.seq ?? 0) + 1
      const zoomCmd: ZoomCommand =
        kind === 'set'
          ? { seq, kind: 'set', scale: scale ?? 1 }
          : { seq, kind }
      return { ui: { ...s.ui, zoomCmd } }
    }),

  openGuide: () => {
    try {
      localStorage.removeItem(GUIDE_KEY)
    } catch {
      /* ignore */
    }
    set({ guideDismissed: false })
  },

  hydrateEdit: (pageId, edit, rev) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      // Don't clobber in-progress local edits.
      if (cur.dirty) return {}
      const incomingRev = rev ?? edit?.rev ?? 0
      const currentRev = cur.edit?.rev ?? 0
      // Don't replace a newer (or equal) local overlay with a stale page-query
      // snapshot — e.g. Translator saved, then Letterer remounted with 1h cache.
      if (cur.hydrated && incomingRev <= currentRev) return {}
      const next = edit ? cloneEdit(edit) : emptyEdit(incomingRev)
      if (rev != null) next.rev = rev
      next.regions = next.regions ?? []
      next.order = next.order ?? []
      next.paint = next.paint ?? []
      next.removed_bubbles = next.removed_bubbles ?? []
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            edit: next,
            dirty: false,
            saveStatus: next.rev > 0 ? 'saved' : 'idle',
            saveError: null,
            conflictServer: null,
            hydrated: true,
            undoPast: cur.hydrated ? cur.undoPast : [],
            undoFuture: cur.hydrated ? cur.undoFuture : [],
            lastUndoCoalesce: cur.hydrated ? cur.lastUndoCoalesce : undefined,
          },
        },
      }
    })
  },

  setEditFromServer: (pageId, edit) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            edit: cloneEdit(edit),
            dirty: false,
            saveStatus: 'saved',
            saveError: null,
            conflictServer: null,
            hydrated: true,
            undoPast: [],
            undoFuture: [],
            lastUndoCoalesce: undefined,
            layoutsByBubble: {},
            textLayers: null,
          },
        },
      }
    })
  },

  patchBubble: (pageId, bubbleId, patch, opts) => {
    set((s) => ({
      pages: applyEditMutation(
        s.pages,
        pageId,
        (edit) => withBubblePatch(edit, bubbleId, patch),
        opts,
      ),
    }))
  },

  setBubbleText: (pageId, bubbleId, text) => {
    set((s) => ({
      pages: applyEditMutation(
        s.pages,
        pageId,
        (edit) => withBubblePatch(edit, bubbleId, { text }),
        { coalesceKey: `text:${bubbleId}` },
      ),
    }))
  },

  clearBubbleText: (pageId, bubbleId) => {
    set((s) => ({
      pages: applyEditMutation(s.pages, pageId, (edit) =>
        withBubblePatch(edit, bubbleId, { text: null }),
      ),
    }))
  },

  setBubbleFont: (pageId, bubbleId, fontKey) => {
    set((s) => ({
      pages: applyEditMutation(s.pages, pageId, (edit) =>
        withBubblePatch(edit, bubbleId, { font: fontKey }),
      ),
    }))
  },

  setSizeOverride: (pageId, bubbleId, scale) => {
    set((s) => ({
      pages: applyEditMutation(s.pages, pageId, (edit) => {
        if (scale == null || scale === 1) {
          return withBubblePatch(edit, bubbleId, { font_scale: null })
        }
        return withBubblePatch(edit, bubbleId, { font_scale: scale })
      }),
    }))
  },

  setFontPx: (pageId, bubbleId, px) => {
    set((s) => ({
      pages: applyEditMutation(s.pages, pageId, (edit) => {
        if (px == null || px <= 0) {
          return withBubblePatch(edit, bubbleId, { font_px: null })
        }
        // Prefer font_px over legacy % scale.
        return withBubblePatch(edit, bubbleId, {
          font_px: Math.round(px),
          font_scale: null,
        })
      }),
    }))
  },

  setLeading: (pageId, bubbleId, leading) => {
    set((s) => ({
      pages: applyEditMutation(s.pages, pageId, (edit) => {
        if (leading == null || leading <= 0) {
          return withBubblePatch(edit, bubbleId, { leading: null })
        }
        return withBubblePatch(edit, bubbleId, {
          leading: Math.round(leading * 100) / 100,
        })
      }),
    }))
  },

  setAlign: (pageId, bubbleId, align) => {
    set((s) => ({
      pages: applyEditMutation(s.pages, pageId, (edit) =>
        withBubblePatch(edit, bubbleId, { align: align ?? null }),
      ),
    }))
  },

  setFrame: (pageId, bubbleId, frame, opts) => {
    set((s) => ({
      pages: applyEditMutation(
        s.pages,
        pageId,
        (edit) =>
          withBubblePatch(edit, bubbleId, {
            frame: frame
              ? [
                  Math.round(frame[0]!),
                  Math.round(frame[1]!),
                  Math.round(frame[2]!),
                  Math.round(frame[3]!),
                ]
              : null,
          }),
        opts,
      ),
    }))
  },

  setInset: (pageId, bubbleId, inset) => {
    set((s) => ({
      pages: applyEditMutation(s.pages, pageId, (edit) => {
        if (inset == null) {
          return withBubblePatch(edit, bubbleId, { inset: null })
        }
        return withBubblePatch(edit, bubbleId, {
          inset: Math.max(0, Math.min(64, Math.round(inset))),
        })
      }),
    }))
  },

  appendPaintStroke: (pageId, stroke) => {
    set((s) => ({
      pages: applyEditMutation(s.pages, pageId, (edit) => ({
        ...edit,
        paint: [...(edit.paint ?? []), stroke],
      })),
    }))
  },

  clearPaintForBubble: (pageId, bubbleId) => {
    set((s) => ({
      pages: applyEditMutation(s.pages, pageId, (edit) => ({
        ...edit,
        paint: (edit.paint ?? []).filter((p) => p.bubble_id !== bubbleId),
      })),
    }))
  },

  setPageFont: (pageId, fontKey) => {
    set((s) => ({
      pages: applyEditMutation(s.pages, pageId, (edit) => {
        const page = { ...(edit.page ?? {}) }
        if (!fontKey) delete page.font
        else page.font = fontKey
        return { ...edit, page }
      }),
    }))
  },

  toggleLayer: (pageId, layerId) => {
    const bid = bubbleIdFromLayer(layerId)
    if (bid == null) return
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      const be = cur.edit.bubbles[bubbleKey(bid)] ?? {}
      const off = new Set(be.layers_off ?? [])
      if (off.has(layerId)) off.delete(layerId)
      else off.add(layerId)
      return {
        pages: applyEditMutation(s.pages, pageId, (edit) =>
          withBubblePatch(edit, bid, {
            layers_off: off.size ? [...off] : null,
          }),
        ),
      }
    })
  },

  setLayerEnabled: (pageId, layerId, enabled) => {
    const bid = bubbleIdFromLayer(layerId)
    if (bid == null) return
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      const be = cur.edit.bubbles[bubbleKey(bid)] ?? {}
      const off = new Set(be.layers_off ?? [])
      if (enabled) off.delete(layerId)
      else off.add(layerId)
      return {
        pages: applyEditMutation(s.pages, pageId, (edit) =>
          withBubblePatch(edit, bid, {
            layers_off: off.size ? [...off] : null,
          }),
        ),
      }
    })
  },

  setBubbleDone: (pageId, bubbleId, done) => {
    set((s) => ({
      pages: applyEditMutation(s.pages, pageId, (edit) =>
        withBubblePatch(edit, bubbleId, {
          done: done ? true : null,
        }),
      ),
    }))
  },

  toggleBubbleDone: (pageId, bubbleId) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      const done = Boolean(cur.edit.bubbles[bubbleKey(bubbleId)]?.done)
      return {
        pages: applyEditMutation(s.pages, pageId, (edit) =>
          withBubblePatch(edit, bubbleId, {
            done: !done ? true : null,
          }),
        ),
      }
    })
  },

  addRegion: (pageId, bbox, text = '', kind) => {
    const resolved = kind ?? useSession.getState().ui.regionKind
    if (resolved == null) {
      throw new Error('region kind required before addRegion')
    }
    const id = newRegionId()
    const isBubble = resolved === 'bubble'
    const region: Region = {
      id,
      bbox,
      text,
      kind: resolved,
      // sfx/other skip YOLO — stay in the list as confirmed without bubble_id.
      status: isBubble ? 'unclassified' : 'confirmed',
      confidence: null,
    }
    set((s) => {
      const pages = applyEditMutation(s.pages, pageId, (edit) => {
        const regions = [...(edit.regions ?? []), region]
        const order = [...(edit.order ?? [])]
        if (!order.includes(id)) order.push(id)
        return { ...edit, regions, order }
      })
      const next = ensurePage(pages, pageId)
      return {
        pages: {
          ...pages,
          [pageId]: {
            ...next,
            selectedRegionId: id,
            selectedBubbleId: null,
          },
        },
        ui: { ...s.ui, activeTool: 'select', regionKind: null },
      }
    })
    return id
  },

  updateRegionBbox: (pageId, regionId, bbox) => {
    set((s) => ({
      pages: applyEditMutation(
        s.pages,
        pageId,
        (edit) => ({
          ...edit,
          regions: (edit.regions ?? []).map((r) => {
            if (r.id !== regionId) return r
            const kind = r.kind ?? 'bubble'
            // Only bubble-kind YOLO results are invalidated by geometry edits.
            if (kind !== 'bubble') {
              return { ...r, kind, bbox }
            }
            return {
              ...r,
              kind,
              bbox,
              status:
                r.status === 'confirmed' || r.status === 'unconfirmed'
                  ? 'unclassified'
                  : r.status,
              confidence:
                r.status === 'confirmed' || r.status === 'unconfirmed'
                  ? null
                  : r.confidence,
              bubble_id:
                r.status === 'confirmed' ? undefined : r.bubble_id,
            }
          }),
        }),
        { coalesceKey: `region-bbox:${regionId}` },
      ),
    }))
  },

  setRegionText: (pageId, regionId, text) => {
    set((s) => ({
      pages: applyEditMutation(
        s.pages,
        pageId,
        (edit) => ({
          ...edit,
          regions: (edit.regions ?? []).map((r) => {
            if (r.id !== regionId) return r
            const kind = r.kind ?? 'bubble'
            if (kind !== 'bubble') {
              return { ...r, kind, text }
            }
            return {
              ...r,
              kind,
              text,
              status:
                r.status === 'confirmed' || r.status === 'unconfirmed'
                  ? 'unclassified'
                  : r.status,
              confidence:
                r.status === 'confirmed' || r.status === 'unconfirmed'
                  ? null
                  : r.confidence,
              bubble_id:
                r.status === 'confirmed' ? undefined : r.bubble_id,
            }
          }),
        }),
        { coalesceKey: `region-text:${regionId}` },
      ),
    }))
  },

  updateRegionStatus: (pageId, regionId, status, confidence, bubbleId) => {
    // Ephemeral UI state — don't dirty/autosave (avoids persisting "verifying"
    // then having the server skip it as non-pending).
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      const regions = (cur.edit.regions ?? []).map((r) => {
        if (r.id !== regionId) return r
        const next: Region = { ...r, status }
        if (confidence !== undefined) next.confidence = confidence
        if (bubbleId !== undefined) next.bubble_id = bubbleId
        return next
      })
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            edit: { ...cur.edit, regions },
          },
        },
      }
    })
  },

  applyVerifyEdit: (pageId, edit) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      const local = cur.edit
      const serverRegions = new Map(
        (edit.regions ?? []).map((r) => [r.id, r] as const),
      )
      const regions = (local.regions ?? []).map((r) => {
        const sr = serverRegions.get(r.id)
        if (!sr) return r
        return {
          ...r,
          status: sr.status,
          confidence: sr.confidence,
          bubble_id: sr.bubble_id,
        }
      })
      // Adopt server-only region rows (rare).
      for (const sr of edit.regions ?? []) {
        if (!regions.some((r) => r.id === sr.id)) regions.push(sr)
      }

      const bubbles = { ...local.bubbles }
      for (const [key, be] of Object.entries(edit.bubbles ?? {})) {
        if (!be || typeof be !== 'object') continue
        // Only adopt bubble text written by verify (new promotes).
        if (typeof be.text === 'string') {
          bubbles[key] = { ...(bubbles[key] ?? {}), text: be.text }
        }
      }

      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            edit: {
              ...local,
              rev: edit.rev,
              regions,
              bubbles,
              order: edit.order ?? local.order,
            },
            // Verify result is persisted server-side; clear dirty only when
            // local content matched what we sent (rev bump absorbed).
            dirty: false,
            saveStatus: 'saved' as const,
            saveError: null,
            conflictServer: null,
            hydrated: true,
          },
        },
      }
    })
  },

  deleteRegion: (pageId, regionId) => {
    set((s) => {
      const pages = applyEditMutation(s.pages, pageId, (edit) => ({
        ...edit,
        regions: (edit.regions ?? []).filter((r) => r.id !== regionId),
        order: (edit.order ?? []).filter((t) => t !== regionId),
      }))
      const cur = ensurePage(pages, pageId)
      return {
        pages: {
          ...pages,
          [pageId]: {
            ...cur,
            selectedRegionId:
              cur.selectedRegionId === regionId ? null : cur.selectedRegionId,
          },
        },
      }
    })
  },

  deleteBubble: (pageId, bubbleId) => {
    set((s) => {
      const pages = applyEditMutation(s.pages, pageId, (edit) => {
        const removed = edit.removed_bubbles ?? []
        if (removed.includes(bubbleId)) return edit
        const bubbles = { ...edit.bubbles }
        delete bubbles[String(bubbleId)]
        const token = `b:${bubbleId}`
        return {
          ...edit,
          removed_bubbles: [...removed, bubbleId],
          bubbles,
          order: (edit.order ?? []).filter((t) => t !== token),
          paint: (edit.paint ?? []).filter((st) => st.bubble_id !== bubbleId),
        }
      })
      const cur = ensurePage(pages, pageId)
      const layoutsByBubble = { ...cur.layoutsByBubble }
      delete layoutsByBubble[bubbleId]
      const textId = `txt_${bubbleId}`
      const textLayers = cur.textLayers
        ? cur.textLayers.filter(
            (l) => l.id !== textId && l.bubble_id !== bubbleId,
          )
        : null
      return {
        pages: {
          ...pages,
          [pageId]: {
            ...cur,
            layoutsByBubble,
            textLayers,
            selectedBubbleId:
              cur.selectedBubbleId === bubbleId ? null : cur.selectedBubbleId,
          },
        },
      }
    })
  },

  moveOrder: (pageId, fromIndex, toIndex) => {
    set((s) => ({
      pages: applyEditMutation(s.pages, pageId, (edit) => {
        const order = [...(edit.order ?? [])]
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= order.length ||
          toIndex >= order.length ||
          fromIndex === toIndex
        ) {
          return edit
        }
        const [item] = order.splice(fromIndex, 1)
        if (item == null) return edit
        order.splice(toIndex, 0, item)
        return { ...edit, order }
      }),
    }))
  },

  reorder: (pageId, tokens) => {
    set((s) => ({
      pages: applyEditMutation(s.pages, pageId, (edit) => ({
        ...edit,
        order: [...tokens],
      })),
    }))
  },

  setLayouts: (pageId, layouts) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      const map: Record<number, BubbleLayout> = { ...cur.layoutsByBubble }
      for (const lay of layouts) map[lay.bubble_id] = lay
      return {
        pages: { ...s.pages, [pageId]: { ...cur, layoutsByBubble: map } },
      }
    })
  },

  applyTypeset: (pageId, layouts, textLayers) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      const map: Record<number, BubbleLayout> = { ...cur.layoutsByBubble }
      for (const lay of layouts) map[lay.bubble_id] = lay
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            layoutsByBubble: map,
            textLayers,
          },
        },
      }
    })
  },

  clearBubbleTypeset: (pageId, bubbleId) => {
    set((s) => {
      const pages = applyEditMutation(s.pages, pageId, (edit) =>
        withBubblePatch(edit, bubbleId, {
          typeset_try: null,
          font_px: null,
          frame: null,
          leading: null,
          align: null,
        }),
      )
      const cur = ensurePage(pages, pageId)
      const layoutsByBubble = { ...cur.layoutsByBubble }
      delete layoutsByBubble[bubbleId]
      const textId = `txt_${bubbleId}`
      const textLayers = cur.textLayers
        ? cur.textLayers.filter(
            (l) => l.id !== textId && l.bubble_id !== bubbleId,
          )
        : null
      return {
        pages: {
          ...pages,
          [pageId]: {
            ...cur,
            layoutsByBubble,
            textLayers,
          },
        },
      }
    })
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setSplitRatio: (ratio) =>
    set({ splitRatio: Math.min(0.95, Math.max(0.05, ratio)) }),

  markSaving: (pageId) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      return {
        pages: {
          ...s.pages,
          [pageId]: { ...cur, saveStatus: 'saving', saveError: null },
        },
      }
    })
  },

  markSaved: (pageId, edit) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      const localCore = stableEditCore(cur.edit)
      const savedCore = stableEditCore(edit)
      const stillDirty = localCore !== savedCore
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            // Prefer server shape when content matches — avoids key-order churn.
            edit: stillDirty
              ? { ...cur.edit, rev: edit.rev }
              : cloneEdit({ ...edit, rev: edit.rev }),
            dirty: stillDirty,
            saveStatus: stillDirty ? 'idle' : 'saved',
            saveError: null,
            conflictServer: null,
            hydrated: true,
          },
        },
      }
    })
  },

  markSaveError: (pageId, message) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            saveStatus: 'error',
            saveError: message,
          },
        },
      }
    })
  },

  syncRevFromServer: (pageId, rev) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      if (cur.edit.rev === rev) return {}
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            edit: { ...cur.edit, rev },
            // Stay dirty — local content still needs to land on the new rev.
            dirty: true,
            saveStatus: 'idle',
            saveError: null,
          },
        },
      }
    })
  },

  setConflict: (pageId, serverEdit) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            conflictServer: cloneEdit(serverEdit),
            dirty: true,
            saveStatus: 'conflict',
            saveError:
              'Sunucuda daha yeni bir kayıt var — seçiminizi yapın',
          },
        },
      }
    })
  },

  resolveConflictTakeServer: (pageId) => {
    let adoptedEdit: PageEdit | null = null
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      if (!cur.conflictServer) return {}
      adoptedEdit = cloneEdit(cur.conflictServer)
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            edit: adoptedEdit,
            conflictServer: null,
            dirty: false,
            saveStatus: 'saved',
            saveError: null,
            undoPast: [],
            undoFuture: [],
            lastUndoCoalesce: undefined,
            layoutsByBubble: {},
            textLayers: null,
            hydrated: true,
          },
        },
      }
    })
    return adoptedEdit
  },

  resolveConflictKeepMine: (pageId) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      const serverRev = cur.conflictServer?.rev
      if (serverRev == null) return {}
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            edit: { ...cur.edit, rev: serverRev },
            conflictServer: null,
            dirty: true,
            saveStatus: 'idle',
            saveError: null,
          },
        },
      }
    })
  },

  undo: (pageId) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      if (!cur.undoPast.length) return {}
      const prev = cur.undoPast[cur.undoPast.length - 1]!
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            edit: cloneEdit(prev),
            dirty: true,
            saveStatus: 'idle',
            saveError: null,
            undoPast: cur.undoPast.slice(0, -1),
            undoFuture: [cloneEdit(cur.edit), ...cur.undoFuture].slice(
              0,
              UNDO_CAP,
            ),
            // Don't let typing right after an undo silently coalesce into it.
            lastUndoCoalesce: undefined,
            layoutsByBubble: {},
            textLayers: null,
          },
        },
      }
    })
  },

  redo: (pageId) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      if (!cur.undoFuture.length) return {}
      const next = cur.undoFuture[0]!
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            edit: cloneEdit(next),
            dirty: true,
            saveStatus: 'idle',
            saveError: null,
            undoPast: [...cur.undoPast, cloneEdit(cur.edit)].slice(-UNDO_CAP),
            undoFuture: cur.undoFuture.slice(1),
            lastUndoCoalesce: undefined,
            layoutsByBubble: {},
            textLayers: null,
          },
        },
      }
    })
  },

  resetPageLocal: (pageId) => {
    set((s) => {
      const prev = ensurePage(s.pages, pageId)
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...emptyPage(),
            selectedBubbleId: prev.selectedBubbleId,
            hydrated: true,
            saveStatus: 'saved',
          },
        },
      }
    })
  },

  clearTypeset: (pageId) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            layoutsByBubble: {},
            textLayers: null,
          },
        },
      }
    })
  },

  resetAll: () =>
    set((s) => ({
      pages: {},
      viewMode: 'composed',
      splitRatio: 0.5,
      brush: { ...DEFAULT_BRUSH },
      // Keep ui prefs (theme, panel widths, filters).
      ui: {
        ...s.ui,
        activeTool: 'select',
        regionKind: null,
        zoomPercent: 100,
        zoomCmd: null,
        galleryDrawerOpen: false,
      },
    })),

  dismissGuide: () => {
    try {
      localStorage.setItem(GUIDE_KEY, '1')
    } catch {
      /* ignore */
    }
    set({ guideDismissed: true })
  },

  pageSession: (pageId) => {
    if (pageId == null) return emptyPage()
    return ensurePage(get().pages, pageId)
  },
}))

/** Derive flat maps from overlay for compositor / typeset helpers. */
export function textOverridesFromEdit(
  edit: PageEdit | undefined,
): Record<number, string> {
  const out: Record<number, string> = {}
  if (!edit) return out
  for (const [k, be] of Object.entries(edit.bubbles)) {
    if (be.text !== undefined) out[Number(k)] = be.text
  }
  return out
}

export function bubbleFontsFromEdit(
  edit: PageEdit | undefined,
): Record<number, string> {
  const out: Record<number, string> = {}
  if (!edit) return out
  for (const [k, be] of Object.entries(edit.bubbles)) {
    if (be.font) out[Number(k)] = be.font
  }
  return out
}

export function sizeOverridesFromEdit(
  edit: PageEdit | undefined,
): Record<number, number> {
  const out: Record<number, number> = {}
  if (!edit) return out
  for (const [k, be] of Object.entries(edit.bubbles)) {
    if (be.font_scale != null && be.font_scale !== 1) {
      out[Number(k)] = be.font_scale
    }
  }
  return out
}

export function disabledLayerIdsFromEdit(
  edit: PageEdit | undefined,
): Set<string> {
  const out = new Set<string>()
  if (!edit) return out
  for (const be of Object.values(edit.bubbles)) {
    for (const lid of be.layers_off ?? []) out.add(lid)
  }
  return out
}

export function doneCountFromEdit(edit: PageEdit | undefined): number {
  if (!edit) return 0
  const removed = new Set(edit.removed_bubbles ?? [])
  return Object.entries(edit.bubbles).filter(([key, b]) => {
    if (!b.done) return false
    const bid = Number(key)
    return !removed.has(bid)
  }).length
}

export function translatedCountFromEdit(edit: PageEdit | undefined): number {
  if (!edit) return 0
  const removed = new Set(edit.removed_bubbles ?? [])
  let n = 0
  for (const [key, be] of Object.entries(edit.bubbles)) {
    if (removed.has(Number(key))) continue
    if (typeof be.text === 'string' && be.text.trim()) n += 1
  }
  for (const r of edit.regions ?? []) {
    if (typeof r.text === 'string' && r.text.trim()) n += 1
  }
  return n
}

export function pageFontFromEdit(edit: PageEdit | undefined): string | null {
  return edit?.page?.font ?? null
}

/** Fingerprint fields that should auto-trigger typeset (not frame). */
export function typesetTriggerFromEdit(edit: PageEdit | undefined): {
  text: Record<number, string>
  fonts: Record<number, string>
  scales: Record<number, number>
  fontPx: Record<number, number>
  leading: Record<number, number>
  align: Record<number, string>
} {
  const text = textOverridesFromEdit(edit)
  const fonts = bubbleFontsFromEdit(edit)
  const scales = sizeOverridesFromEdit(edit)
  const fontPx: Record<number, number> = {}
  const leading: Record<number, number> = {}
  const align: Record<number, string> = {}
  if (edit) {
    for (const [k, be] of Object.entries(edit.bubbles)) {
      const id = Number(k)
      if (be.font_px != null) fontPx[id] = be.font_px
      if (be.leading != null) leading[id] = be.leading
      if (be.align) align[id] = be.align
    }
  }
  return { text, fonts, scales, fontPx, leading, align }
}
