import { useEffect } from 'react'
import type { PageDetail } from '@/api/types'
import { useSession } from '@/store/session'

/**
 * Single hydrate path for Translator + Letterer (and any future role view).
 *
 * Guards live in ``hydrateEdit`` (dirty / rev). Callers only ensure the
 * detail belongs to ``pageId`` (placeholderData can briefly show the prior page).
 */
export function useHydratePageEdit(
  pageId: number | null | undefined,
  detail: PageDetail | undefined,
): void {
  const hydrateEdit = useSession((s) => s.hydrateEdit)

  useEffect(() => {
    if (!detail || pageId == null) return
    if (detail.page.id !== pageId) return
    hydrateEdit(
      pageId,
      detail.edit,
      detail.edit_rev ?? detail.edit?.rev ?? 0,
    )
  }, [detail, pageId, hydrateEdit])
}
