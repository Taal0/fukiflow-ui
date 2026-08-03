import { useEffect } from 'react'
import type { PageDoc, PageSummary } from '@/api/types'
import { cleanLayerId, textLayerId } from '@/api/types'
import { useSession } from '@/store/session'

interface Args {
  pages: PageSummary[]
  doc: PageDoc | undefined
  pageId: number | null
}

/** Global keyboard shortcuts for the letterer workspace. */
export function useWorkspaceKeys({ pages, doc, pageId }: Args) {
  const selectPage = useSession((s) => s.selectPage)
  const selectBubble = useSession((s) => s.selectBubble)
  const selectedPageId = useSession((s) => s.selectedPageId)
  const setViewMode = useSession((s) => s.setViewMode)
  const toggleLayer = useSession((s) => s.toggleLayer)
  const pageSession = useSession((s) =>
    pageId != null ? s.pages[pageId] : undefined,
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return
      }

      // Page navigation
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j') {
        if (!pages.length) return
        e.preventDefault()
        const idx = pages.findIndex((p) => p.id === selectedPageId)
        const next = Math.min(pages.length - 1, Math.max(0, idx) + 1)
        selectPage(pages[next]!.id)
        return
      }
      if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k') {
        if (!pages.length) return
        e.preventDefault()
        const idx = pages.findIndex((p) => p.id === selectedPageId)
        const next = Math.max(0, (idx < 0 ? 0 : idx) - 1)
        selectPage(pages[next]!.id)
        return
      }

      // View modes
      if (e.key === '1') {
        setViewMode('composed')
        return
      }
      if (e.key === '2') {
        setViewMode('original')
        return
      }
      if (e.key === '3') {
        setViewMode('split')
        return
      }

      if (!doc || pageId == null) return

      const bubbles = [...doc.bubbles].sort(
        (a, b) =>
          (a.reading_order ?? a.id) - (b.reading_order ?? b.id),
      )
      const selected = pageSession?.selectedBubbleId ?? null
      const idx = bubbles.findIndex((b) => b.id === selected)

      // Bubble navigation
      if (e.key === 'ArrowRight' || e.key === 'n') {
        e.preventDefault()
        const next = bubbles[Math.min(bubbles.length - 1, Math.max(0, idx) + 1)]
        if (next) selectBubble(next.id)
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'p') {
        e.preventDefault()
        const next = bubbles[Math.max(0, (idx < 0 ? 0 : idx) - 1)]
        if (next) selectBubble(next.id)
        return
      }

      // Toggle layers for selected bubble
      if ((e.key === 'c' || e.key === 'C') && selected != null) {
        e.preventDefault()
        toggleLayer(pageId, cleanLayerId(selected))
        return
      }
      if ((e.key === 't' || e.key === 'T') && selected != null) {
        e.preventDefault()
        toggleLayer(pageId, textLayerId(selected))
        return
      }

      // Escape clears bubble selection
      if (e.key === 'Escape') {
        selectBubble(null)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    pages,
    doc,
    pageId,
    selectedPageId,
    pageSession?.selectedBubbleId,
    selectPage,
    selectBubble,
    setViewMode,
    toggleLayer,
  ])
}
