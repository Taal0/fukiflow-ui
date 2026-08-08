import { useMemo, useRef } from 'react'
import { isDetailForPage } from '@/api/pageCache'
import type { PageDetail } from '@/api/types'

export type HeldPageDetail = {
  /** Page currently painted (may lag selection while the next page fetches). */
  pageId: number
  detail: PageDetail
  /** Selection moved on; held detail is the previous page until fetch lands. */
  isTransitioning: boolean
}

/**
 * Keep the last fully-matched page on screen while the next page loads.
 *
 * Unlike react-query ``placeholderData``, the held seed is always paired with
 * the same pageId — never merge page A's art with page B's overlay (re-uploads
 * share bubble ids and that looks like texts jumping between mangas).
 *
 * Cleared on chapter change so another manga is never held across the boundary.
 *
 * Note: while ``isTransitioning``, paint/edit still target the held page (not
 * the newly selected id) so seed + overlay stay paired until the fetch lands.
 */
export function useHeldPageDetail(
  selectedPageId: number | null | undefined,
  liveDetail: PageDetail | undefined,
  chapterSlug: string | null | undefined,
): HeldPageDetail | null {
  const chapterKey = chapterSlug ?? null
  const heldRef = useRef<{
    chapter: string | null
    pageId: number
    detail: PageDetail
  } | null>(null)

  if (heldRef.current && heldRef.current.chapter !== chapterKey) {
    heldRef.current = null
  }

  // Narrow pageId before the detail guard so both are typed inside the block.
  if (
    selectedPageId != null &&
    isDetailForPage(liveDetail, selectedPageId)
  ) {
    heldRef.current = {
      chapter: chapterKey,
      pageId: selectedPageId,
      detail: liveDetail,
    }
  }

  const held = heldRef.current
  const pageId = held?.pageId ?? null
  const detail = held?.detail
  const isTransitioning =
    pageId != null &&
    selectedPageId != null &&
    selectedPageId !== pageId

  return useMemo(() => {
    if (pageId == null || detail == null) return null
    return { pageId, detail, isTransitioning }
  }, [pageId, detail, isTransitioning])
}
