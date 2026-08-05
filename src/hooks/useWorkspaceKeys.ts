import { useEffect } from 'react'
import type { PageDoc, PageSummary } from '@/api/types'
import { cleanLayerId, textLayerId } from '@/api/types'
import {
  clampFrame,
  nudgeFrame,
  resolveBubbleFrame,
} from '@/lib/bubbleFrame'
import { useSession } from '@/store/session'

interface Args {
  pages: PageSummary[]
  doc: PageDoc | undefined
  pageId: number | null
}

function orderedBubbles(doc: PageDoc) {
  return [...doc.bubbles].sort(
    (a, b) => (a.reading_order ?? a.id) - (b.reading_order ?? b.id),
  )
}

/** Global keyboard shortcuts for the letterer workspace. */
export function useWorkspaceKeys({ pages, doc, pageId }: Args) {
  const selectPage = useSession((s) => s.selectPage)
  const selectBubble = useSession((s) => s.selectBubble)
  const selectedPageId = useSession((s) => s.selectedPageId)
  const setViewMode = useSession((s) => s.setViewMode)
  const toggleLayer = useSession((s) => s.toggleLayer)
  const toggleBubbleDone = useSession((s) => s.toggleBubbleDone)
  const setFrame = useSession((s) => s.setFrame)
  const undo = useSession((s) => s.undo)
  const redo = useSession((s) => s.redo)
  const pageSession = useSession((s) =>
    pageId != null ? s.pages[pageId] : undefined,
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const inField =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable

      const mod = e.metaKey || e.ctrlKey

      // Undo / redo — allow even from text fields (standard editor feel).
      if (mod && pageId != null && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) redo(pageId)
        else undo(pageId)
        return
      }
      if (mod && pageId != null && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        redo(pageId)
        return
      }

      if (inField) return

      // Page navigation (j/k / PageUp/Down — arrows reserved for frame nudge)
      if (e.key === 'PageDown' || e.key === 'j') {
        if (!pages.length) return
        e.preventDefault()
        const idx = pages.findIndex((p) => p.id === selectedPageId)
        const next = Math.min(pages.length - 1, Math.max(0, idx) + 1)
        selectPage(pages[next]!.id)
        return
      }
      if (e.key === 'PageUp' || e.key === 'k') {
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

      const bubbles = orderedBubbles(doc)
      const selected = pageSession?.selectedBubbleId ?? null
      const idx = bubbles.findIndex((b) => b.id === selected)

      // Frame nudge — arrow keys when a bubble is selected. Only moves the
      // box; text does not reflow until "Oto dizgi" (plan §Faz 1 #4).
      if (
        selected != null &&
        (e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown')
      ) {
        e.preventDefault()
        const bubble = doc.bubbles.find((b) => b.id === selected)
        if (!bubble || bubble.clean_status === 'editor') return
        const be = pageSession?.edit.bubbles[String(selected)]
        const cur = resolveBubbleFrame(bubble, be)
        const step = e.shiftKey ? 10 : 1
        let dx = 0
        let dy = 0
        if (e.key === 'ArrowLeft') dx = -step
        if (e.key === 'ArrowRight') dx = step
        if (e.key === 'ArrowUp') dy = -step
        if (e.key === 'ArrowDown') dy = step
        const next = clampFrame(
          nudgeFrame(cur, dx, dy),
          doc.source.width,
          doc.source.height,
        )
        setFrame(pageId, selected, next)
        return
      }

      // Bubble navigation — n/p and Tab / Shift+Tab in reading order
      if (e.key === 'n' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault()
        const next = bubbles[Math.min(bubbles.length - 1, Math.max(0, idx) + 1)]
        if (next) selectBubble(next.id)
        return
      }
      if (e.key === 'p' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault()
        const next = bubbles[Math.max(0, (idx < 0 ? 0 : idx) - 1)]
        if (next) selectBubble(next.id)
        return
      }

      // Mark selected bubble done
      if ((e.key === 'd' || e.key === 'D') && selected != null) {
        e.preventDefault()
        toggleBubbleDone(pageId, selected)
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
    pageSession?.edit,
    selectPage,
    selectBubble,
    setViewMode,
    toggleLayer,
    toggleBubbleDone,
    setFrame,
    undo,
    redo,
  ])
}
