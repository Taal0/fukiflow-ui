import { useEffect } from 'react'
import { isDetailForPage } from '@/api/pageCache'
import type { PageDetail } from '@/api/types'
import { useSession } from '@/store/session'

/**
 * Single hydrate path for Translator + Letterer (and any future role view).
 *
 * Only hydrates when ``detail.page.id`` matches ``pageId`` so a stale query
 * result cannot copy another manga's overlay onto this page (re-uploads share
 * bubble ids, which makes cross-page merges look like "texts jumping").
 */
export function useHydratePageEdit(
  pageId: number | null | undefined,
  detail: PageDetail | undefined,
): void {
  const hydrateEdit = useSession((s) => s.hydrateEdit)

  useEffect(() => {
    // Narrow pageId before the detail guard so hydrateEdit gets a number.
    if (pageId == null || !isDetailForPage(detail, pageId)) return
    hydrateEdit(
      pageId,
      detail.edit,
      detail.edit_rev ?? detail.edit?.rev ?? 0,
    )
  }, [detail, pageId, hydrateEdit])
}
