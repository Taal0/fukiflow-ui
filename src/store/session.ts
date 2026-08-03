import { create } from 'zustand'
import type { BubbleLayout, Layer, ViewMode } from '@/api/types'

export interface PageSession {
  selectedBubbleId: number | null
  disabledLayerIds: Set<string>
  textOverrides: Record<number, string>
  bubbleFontOverrides: Record<number, string>
  sizeOverrides: Record<number, number>
  layoutsByBubble: Record<number, BubbleLayout>
  /** Replaces seed text layers after a successful typeset. */
  textLayers: Layer[] | null
}

interface SessionState {
  selectedPageId: number | null
  chapterSlug: string | null
  fontOverride: string | null
  viewMode: ViewMode
  splitRatio: number
  pages: Record<number, PageSession>
  /** First-visit coachmark dismissed. */
  guideDismissed: boolean

  setChapterSlug: (slug: string | null) => void
  selectPage: (pageId: number | null) => void
  selectBubble: (bubbleId: number | null) => void
  toggleLayer: (pageId: number, layerId: string) => void
  setLayerEnabled: (pageId: number, layerId: string, enabled: boolean) => void
  setTextOverride: (pageId: number, bubbleId: number, text: string) => void
  clearTextOverride: (pageId: number, bubbleId: number) => void
  setFontOverride: (fontKey: string | null) => void
  setBubbleFont: (pageId: number, bubbleId: number, fontKey: string | null) => void
  setSizeOverride: (pageId: number, bubbleId: number, scale: number | null) => void
  setLayouts: (pageId: number, layouts: BubbleLayout[]) => void
  applyTypeset: (
    pageId: number,
    layouts: BubbleLayout[],
    textLayers: Layer[],
  ) => void
  setViewMode: (mode: ViewMode) => void
  setSplitRatio: (ratio: number) => void
  resetPage: (pageId: number) => void
  clearTypeset: (pageId: number) => void
  resetAll: () => void
  dismissGuide: () => void
  pageSession: (pageId: number | null | undefined) => PageSession
}

function emptyPage(): PageSession {
  return {
    selectedBubbleId: null,
    disabledLayerIds: new Set(),
    textOverrides: {},
    bubbleFontOverrides: {},
    sizeOverrides: {},
    layoutsByBubble: {},
    textLayers: null,
  }
}

function ensurePage(
  pages: Record<number, PageSession>,
  pageId: number,
): PageSession {
  return pages[pageId] ?? emptyPage()
}

const GUIDE_KEY = 'fukiflow.guideDismissed'

function readGuideDismissed(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1'
  } catch {
    return false
  }
}

export const useSession = create<SessionState>((set, get) => ({
  selectedPageId: null,
  chapterSlug: null,
  fontOverride: null,
  viewMode: 'composed',
  splitRatio: 0.5,
  pages: {},
  guideDismissed: readGuideDismissed(),

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

  toggleLayer: (pageId, layerId) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      const next = new Set(cur.disabledLayerIds)
      if (next.has(layerId)) next.delete(layerId)
      else next.add(layerId)
      return {
        pages: { ...s.pages, [pageId]: { ...cur, disabledLayerIds: next } },
      }
    })
  },

  setLayerEnabled: (pageId, layerId, enabled) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      const next = new Set(cur.disabledLayerIds)
      if (enabled) next.delete(layerId)
      else next.add(layerId)
      return {
        pages: { ...s.pages, [pageId]: { ...cur, disabledLayerIds: next } },
      }
    })
  },

  setTextOverride: (pageId, bubbleId, text) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...cur,
            textOverrides: { ...cur.textOverrides, [bubbleId]: text },
          },
        },
      }
    })
  },

  clearTextOverride: (pageId, bubbleId) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      const next = { ...cur.textOverrides }
      delete next[bubbleId]
      return {
        pages: {
          ...s.pages,
          [pageId]: { ...cur, textOverrides: next },
        },
      }
    })
  },

  setFontOverride: (fontKey) => set({ fontOverride: fontKey }),

  setBubbleFont: (pageId, bubbleId, fontKey) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      const next = { ...cur.bubbleFontOverrides }
      if (fontKey == null) delete next[bubbleId]
      else next[bubbleId] = fontKey
      return {
        pages: {
          ...s.pages,
          [pageId]: { ...cur, bubbleFontOverrides: next },
        },
      }
    })
  },

  setSizeOverride: (pageId, bubbleId, scale) => {
    set((s) => {
      const cur = ensurePage(s.pages, pageId)
      const next = { ...cur.sizeOverrides }
      if (scale == null || scale === 1) delete next[bubbleId]
      else next[bubbleId] = scale
      return {
        pages: { ...s.pages, [pageId]: { ...cur, sizeOverrides: next } },
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

  resetPage: (pageId) => {
    set((s) => {
      const prev = ensurePage(s.pages, pageId)
      return {
        pages: {
          ...s.pages,
          [pageId]: {
            ...emptyPage(),
            selectedBubbleId: prev.selectedBubbleId,
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
      fontOverride: null,
      viewMode: 'composed',
      splitRatio: 0.5,
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
