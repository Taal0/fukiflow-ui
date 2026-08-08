import type { QueryClient } from '@tanstack/react-query'
import type { PageDetail, PageEdit } from './types'

/** React Query key for a full page detail (seed doc + mutable overlay). */
export function pageQueryKey(pageId: number) {
  return ['pages', pageId] as const
}

const EMPTY_EDIT: PageEdit = {
  rev: 0,
  page: {},
  bubbles: {},
  paint: [],
  regions: [],
  order: [],
  removed_bubbles: [],
}

/** Patch only the PageEdit overlay — seed doc / assets stay warm. */
export function applyPageEditToCache(
  qc: QueryClient,
  pageId: number,
  overlay: {
    edit: PageEdit
    rev: number
    author?: string | null
  },
): void {
  qc.setQueryData(pageQueryKey(pageId), (old: PageDetail | undefined) => {
    if (!old) return old
    return {
      ...old,
      edit: overlay.edit,
      edit_rev: overlay.rev,
      edit_author:
        overlay.author !== undefined ? overlay.author : old.edit_author,
    }
  })
}

/** Inject YOLO-promoted bubbles + clean layer assets into the cached seed doc. */
export function injectPromotedIntoCache(
  qc: QueryClient,
  pageId: number,
  payload: {
    bubbles: PageDetail['doc']['bubbles']
    layer_assets?: PageDetail['layer_assets']
    layers?: PageDetail['doc']['layers']
  },
): void {
  if (!payload.bubbles.length && !payload.layer_assets?.length) return
  qc.setQueryData(pageQueryKey(pageId), (old: PageDetail | undefined) => {
    if (!old) return old
    const existingIds = new Set(old.doc.bubbles.map((b) => b.id))
    const newBubbles = payload.bubbles.filter((b) => !existingIds.has(b.id))
    const existingLayerIds = new Set(old.doc.layers.map((l) => l.id))
    const newLayers = (payload.layers ?? []).filter(
      (l) => !existingLayerIds.has(l.id),
    )
    const existingAssetIds = new Set(old.layer_assets.map((a) => a.layer_id))
    const newAssets = (payload.layer_assets ?? []).filter(
      (a) => !existingAssetIds.has(a.layer_id),
    )
    return {
      ...old,
      doc: {
        ...old.doc,
        bubbles: [...old.doc.bubbles, ...newBubbles],
        layers: [...old.doc.layers, ...newLayers],
      },
      layer_assets: [...old.layer_assets, ...newAssets],
      page: {
        ...old.page,
        bubble_count: old.doc.bubbles.length + newBubbles.length,
      },
    }
  })
}

/** After delete / reset — clear overlay in cache immediately (don't wait for refetch). */
export function clearPageEditInCache(qc: QueryClient, pageId: number): void {
  applyPageEditToCache(qc, pageId, {
    edit: EMPTY_EDIT,
    rev: 0,
    author: null,
  })
}

/** Gallery progress + page list badges after overlay writes. */
export function invalidateChapterOverlayLists(qc: QueryClient): void {
  void qc.invalidateQueries({
    predicate: (q) =>
      Array.isArray(q.queryKey) &&
      q.queryKey[0] === 'chapters' &&
      (q.queryKey[2] === 'progress' || q.queryKey[2] === 'pages'),
  })
}
