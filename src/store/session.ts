import { create } from 'zustand'
import type {
  BrushState,
  BubbleEdit,
  BubbleLayout,
  Layer,
  PageEdit,
  PaintStroke,
  SaveStatus,
  ViewMode,
} from '@/api/types'
import { BRUSH_PRESETS } from '@/lib/paintStroke'

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

  setChapterSlug: (slug: string | null) => void
  selectPage: (pageId: number | null) => void
  selectBubble: (bubbleId: number | null) => void

  setBrushMode: (mode: BrushState['mode']) => void
  setBrushRadius: (radiusPx: number) => void
  setBrushColor: (color: [number, number, number] | null) => void

  /** Load server overlay into session (no-op if dirty local edits exist). */
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

  setLayouts: (pageId: number, layouts: BubbleLayout[]) => void
  applyTypeset: (
    pageId: number,
    layouts: BubbleLayout[],
    textLayers: Layer[],
  ) => void
  setViewMode: (mode: ViewMode) => void
  setSplitRatio: (ratio: number) => void

  markSaving: (pageId: number) => void
  markSaved: (pageId: number, edit: PageEdit) => void
  markSaveError: (pageId: number, message: string) => void
  /** Keep local overlay content; adopt server rev after a 409 so retry can succeed. */
  syncRevFromServer: (pageId: number, rev: number) => void
  /** Surface a 409: keep local edit visible, stash server copy for resolution. */
  setConflict: (pageId: number, serverEdit: PageEdit) => void
  /** Resolve 409 by replacing local overlay with the server copy. */
  resolveConflictTakeServer: (pageId: number) => void
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
  return { rev, page: {}, bubbles: {}, paint: [] }
}

function emptyPage(): PageSession {
  return {
    selectedBubbleId: null,
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

function readGuideDismissed(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1'
  } catch {
    return false
  }
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
          [pageId]: { ...cur, selectedBubbleId: bubbleId },
        },
      }
    })
  },

  setBrushMode: (mode) =>
    set((s) => ({ brush: { ...s.brush, mode } })),
  setBrushRadius: (radiusPx) =>
    set((s) => ({
      brush: {
        ...s.brush,
        radiusPx: Math.max(1, Math.min(64, Math.round(radiusPx))),
      },
    })),
  setBrushColor: (color) =>
    set((s) => ({ brush: { ...s.brush, color } })),

  hydrateEdit: (pageId, edit, rev) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      // Don't clobber in-progress local edits.
      if (cur.dirty) return {}
      const next = edit ? cloneEdit(edit) : emptyEdit(rev ?? 0)
      if (rev != null) next.rev = rev
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
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      if (!cur.conflictServer) return {}
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            edit: cloneEdit(cur.conflictServer),
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
    set({
      pages: {},
      viewMode: 'composed',
      splitRatio: 0.5,
      brush: { ...DEFAULT_BRUSH },
    }),

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
  return Object.values(edit.bubbles).filter((b) => b.done).length
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
