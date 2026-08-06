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
