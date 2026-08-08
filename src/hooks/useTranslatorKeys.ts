import { useEffect, useState } from 'react'
import type { PageDoc, PageEdit, PageSummary } from '@/api/types'
import {
  bubbleOrderToken,
  orderedItems,
} from '@/lib/workingDoc'
import { useSession } from '@/store/session'

interface Args {
  pages: PageSummary[]
  doc: PageDoc | undefined
  pageId: number | null
  edit: PageEdit | undefined
  /** Prefer over bare selectPage so URL stays in sync. */
  onSelectPage?: (pageId: number) => void
}

export const TRANSLATOR_SHORTCUTS: ReadonlyArray<{
  keys: string
  label: string
  group: string
}> = [
  { group: 'Düzenleme', keys: '⌘Z', label: 'Geri al' },
  { group: 'Düzenleme', keys: '⌘⇧Z / ⌘Y', label: 'İleri al' },
  { group: 'Sayfa', keys: 'J / PageDown', label: 'Sonraki sayfa' },
  { group: 'Sayfa', keys: 'K / PageUp', label: 'Önceki sayfa' },
  { group: 'Görünüm', keys: '1', label: 'Sonuç' },
  { group: 'Görünüm', keys: '2', label: 'Orijinal' },
  { group: 'Görünüm', keys: '3', label: 'Yan yana' },
  { group: 'Sıra', keys: 'N / Tab', label: 'Sonraki öğe' },
  { group: 'Sıra', keys: 'P / ⇧Tab', label: 'Önceki öğe' },
  { group: 'Sıra', keys: 'Alt+↑ / Alt+↓', label: 'Sırada taşı' },
  { group: 'Sıra', keys: 'Delete / ⌫', label: 'Balonu / kutuyu sil' },
  { group: 'Araçlar', keys: 'V', label: 'Seç' },
  { group: 'Araçlar', keys: 'R', label: 'Kutu türü seç (Bubble / SFX / Other)' },
  { group: 'Genel', keys: 'Esc', label: 'Çizimi iptal / select' },
  { group: 'Genel', keys: '?', label: 'Kısayollar paneli' },
  {
    group: 'Genel',
    keys: '⌘…',
    label: 'Tarayıcı kısayolları (yenile, sekme…) — uygulama yakalamaz',
  },
]

export function useTranslatorKeys({
  pages,
  doc,
  pageId,
  edit,
  onSelectPage,
}: Args) {
  const selectPageStore = useSession((s) => s.selectPage)
  const goToPage = onSelectPage ?? selectPageStore
  const selectBubble = useSession((s) => s.selectBubble)
  const selectRegion = useSession((s) => s.selectRegion)
  const selectedPageId = useSession((s) => s.selectedPageId)
  const setViewMode = useSession((s) => s.setViewMode)
  const setActiveTool = useSession((s) => s.setActiveTool)
  const setRegionKind = useSession((s) => s.setRegionKind)
  const activeTool = useSession((s) => s.ui.activeTool)
  const reorder = useSession((s) => s.reorder)
  const deleteBubble = useSession((s) => s.deleteBubble)
  const deleteRegion = useSession((s) => s.deleteRegion)
  const undo = useSession((s) => s.undo)
  const redo = useSession((s) => s.redo)
  const pageSession = useSession((s) =>
    pageId != null ? s.pages[pageId] : undefined,
  )
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

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

      if (!mod && (e.key === '?' || (e.key === '/' && e.shiftKey))) {
        if (!inField || e.key === '?') {
          e.preventDefault()
          setShortcutsOpen((v) => !v)
          return
        }
      }
      if (e.key === 'Escape' && shortcutsOpen) {
        e.preventDefault()
        setShortcutsOpen(false)
        return
      }

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

      // Let the browser keep ⌘/Ctrl chords (reload, new tab, find, …).
      if (mod) return

      if (inField) return

      if (e.key === 'PageDown' || e.key === 'j') {
        if (!pages.length) return
        e.preventDefault()
        const idx = pages.findIndex((p) => p.id === selectedPageId)
        const next = Math.min(pages.length - 1, Math.max(0, idx) + 1)
        goToPage(pages[next]!.id)
        return
      }
      if (e.key === 'PageUp' || e.key === 'k') {
        if (!pages.length) return
        e.preventDefault()
        const idx = pages.findIndex((p) => p.id === selectedPageId)
        const next = Math.max(0, (idx < 0 ? 0 : idx) - 1)
        goToPage(pages[next]!.id)
        return
      }

      if (e.key === '1') {
        e.preventDefault()
        setViewMode('composed')
        return
      }
      if (e.key === '2') {
        e.preventDefault()
        setViewMode('original')
        return
      }
      if (e.key === '3') {
        e.preventDefault()
        setViewMode('split')
        return
      }

      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault()
        setActiveTool('select')
        return
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        setActiveTool('region')
        setRegionKind(null)
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        if (activeTool === 'region') {
          setActiveTool('select')
          return
        }
        selectBubble(null)
        selectRegion(null)
        return
      }

      if (!doc || pageId == null || !edit) return
      const items = orderedItems(doc, edit)
      if (!items.length) return

      const tokens = items.map((it) =>
        it.kind === 'bubble' ? bubbleOrderToken(Number(it.id)) : it.id,
      )

      const currentIndex = (() => {
        if (pageSession?.selectedRegionId) {
          return items.findIndex(
            (it) =>
              it.kind === 'region' && it.id === pageSession.selectedRegionId,
          )
        }
        if (pageSession?.selectedBubbleId != null) {
          return items.findIndex(
            (it) =>
              it.kind === 'bubble' &&
              Number(it.id) === pageSession.selectedBubbleId,
          )
        }
        return -1
      })()

      const selectAt = (index: number) => {
        const item = items[index]
        if (!item) return
        if (item.kind === 'bubble') selectBubble(Number(item.id))
        else selectRegion(item.id)
      }

      // Alt+↑/↓ reorder
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        if (currentIndex < 0) return
        e.preventDefault()
        const to =
          e.key === 'ArrowUp'
            ? Math.max(0, currentIndex - 1)
            : Math.min(items.length - 1, currentIndex + 1)
        if (to === currentIndex) return
        const next = [...tokens]
        const [row] = next.splice(currentIndex, 1)
        if (row == null) return
        next.splice(to, 0, row)
        reorder(pageId, next)
        return
      }

      // Hard-delete selected bubble or region
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (pageSession?.selectedRegionId) {
          e.preventDefault()
          deleteRegion(pageId, pageSession.selectedRegionId)
          return
        }
        if (pageSession?.selectedBubbleId != null) {
          e.preventDefault()
          deleteBubble(pageId, pageSession.selectedBubbleId)
          return
        }
      }

      const goNext =
        e.key === 'n' ||
        e.key === 'N' ||
        (e.key === 'Tab' && !e.shiftKey)
      const goPrev =
        e.key === 'p' ||
        e.key === 'P' ||
        (e.key === 'Tab' && e.shiftKey)

      if (goNext) {
        e.preventDefault()
        const next =
          currentIndex < 0 ? 0 : Math.min(items.length - 1, currentIndex + 1)
        selectAt(next)
        return
      }
      if (goPrev) {
        e.preventDefault()
        const next =
          currentIndex < 0
            ? items.length - 1
            : Math.max(0, currentIndex - 1)
        selectAt(next)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    pages,
    doc,
    pageId,
    edit,
    selectedPageId,
    pageSession?.selectedBubbleId,
    pageSession?.selectedRegionId,
    activeTool,
    shortcutsOpen,
    goToPage,
    selectBubble,
    selectRegion,
    setViewMode,
    setActiveTool,
    setRegionKind,
    reorder,
    deleteBubble,
    deleteRegion,
    undo,
    redo,
  ])

  return {
    shortcutsOpen,
    setShortcutsOpen,
    shortcuts: TRANSLATOR_SHORTCUTS,
  }
}
