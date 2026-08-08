import { useEffect, useState } from 'react'
import type { BubbleLayout, PageDoc, PageSummary } from '@/api/types'
import { cleanLayerId, textLayerId } from '@/api/types'
import {
  clampFrame,
  nudgeFrame,
  resolveBubbleFrame,
} from '@/lib/bubbleFrame'
import { bubbleFlags } from '@/components/flags'
import { layoutForBubble } from '@/components/bubbles/bubbleUtils'
import { useSession } from '@/store/session'
import { toast } from '@/store/toast'

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

function openFlaggedBubbles(
  doc: PageDoc,
  layoutsByBubble: Record<number, BubbleLayout>,
  editBubbles: Record<string, { done?: boolean }>,
) {
  return orderedBubbles(doc).filter((b) => {
    if (editBubbles[String(b.id)]?.done) return false
    const layout = layoutForBubble(b.id, layoutsByBubble, doc.layers)
    return bubbleFlags(b, layout).length > 0
  })
}

/** Single source of truth for workspace shortcuts (handlers + help panel). */
export const WORKSPACE_SHORTCUTS: ReadonlyArray<{
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
  { group: 'Balon', keys: 'N / Tab', label: 'Sonraki balon' },
  { group: 'Balon', keys: 'P / ⇧Tab', label: 'Önceki balon' },
  { group: 'Balon', keys: 'D', label: 'Bitti işaretle' },
  { group: 'Balon', keys: 'Delete / ⌫', label: 'Balonu sil' },
  { group: 'Balon', keys: 'C', label: 'Clean katmanı aç/kapa' },
  { group: 'Balon', keys: 'T', label: 'Metin katmanı aç/kapa' },
  { group: 'İnceleme', keys: '⇧N', label: 'Sonraki inceleme' },
  { group: 'İnceleme', keys: '⇧P', label: 'Önceki inceleme' },
  { group: 'İnceleme', keys: 'F', label: 'İnceleme filtresi' },
  { group: 'Kutu', keys: '←↑↓→', label: 'Kutuyu 1 px kaydır' },
  { group: 'Kutu', keys: '⇧ + ok', label: 'Kutuyu 10 px kaydır' },
  { group: 'Araçlar', keys: 'V', label: 'Seç' },
  { group: 'Araçlar', keys: 'M', label: 'Kutu' },
  { group: 'Fırça', keys: 'B', label: 'Boya fırçası' },
  { group: 'Fırça', keys: 'R', label: 'Geri al fırçası' },
  { group: 'Fırça', keys: '[ ]', label: 'Fırça boyutu −/+' },
  { group: 'Fırça', keys: '⇧[ ⇧]', label: 'Fırça boyutu ±4' },
  { group: 'Genel', keys: 'Esc', label: 'Aracı kapat / seçimi kaldır' },
  { group: 'Genel', keys: '?', label: 'Kısayollar paneli' },
  {
    group: 'Genel',
    keys: '⌘…',
    label: 'Tarayıcı kısayolları (yenile, sekme…) — uygulama yakalamaz',
  },
]

/** Global keyboard shortcuts for the letterer workspace. */
export function useWorkspaceKeys({ pages, doc, pageId }: Args) {
  const selectPage = useSession((s) => s.selectPage)
  const selectBubble = useSession((s) => s.selectBubble)
  const selectedPageId = useSession((s) => s.selectedPageId)
  const setViewMode = useSession((s) => s.setViewMode)
  const toggleLayer = useSession((s) => s.toggleLayer)
  const toggleBubbleDone = useSession((s) => s.toggleBubbleDone)
  const deleteBubble = useSession((s) => s.deleteBubble)
  const setFrame = useSession((s) => s.setFrame)
  const setBrushMode = useSession((s) => s.setBrushMode)
  const setBrushRadius = useSession((s) => s.setBrushRadius)
  const setActiveTool = useSession((s) => s.setActiveTool)
  const brush = useSession((s) => s.brush)
  const activeTool = useSession((s) => s.ui.activeTool)
  const bubbleFilter = useSession((s) => s.ui.bubbleFilter)
  const patchUi = useSession((s) => s.patchUi)
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

      // Help panel — allow from fields too (? alone, or Shift+/).
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

      // Undo / redo — allow even from text fields (standard editor feel).
      // Only ⌘Z / ⌘⇧Z / ⌘Y — never other browser chords (⌘⇧R reload, ⌘T, …).
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

      // Tools
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault()
        setActiveTool('select')
        return
      }
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        setActiveTool('frame')
        return
      }
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        setActiveTool(activeTool === 'paint' ? 'select' : 'paint')
        return
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        setActiveTool(activeTool === 'restore' ? 'select' : 'restore')
        return
      }
      if (e.key === '[' || e.key === ']') {
        e.preventDefault()
        const step = e.shiftKey ? 4 : 1
        const delta = e.key === ']' ? step : -step
        setBrushRadius(brush.radiusPx + delta)
        return
      }

      if (!doc || pageId == null) return

      const bubbles = orderedBubbles(doc)
      const selected = pageSession?.selectedBubbleId ?? null
      const idx = bubbles.findIndex((b) => b.id === selected)
      const layoutsByBubble = pageSession?.layoutsByBubble ?? {}
      const editBubbles = pageSession?.edit.bubbles ?? {}

      // Soft-flag review queue — Shift+N / Shift+P (before plain n/p)
      if (e.shiftKey && (e.key === 'N' || e.key === 'n')) {
        e.preventDefault()
        const flagged = openFlaggedBubbles(doc, layoutsByBubble, editBubbles)
        if (!flagged.length) {
          toast('Bu sayfada inceleme kalmadı', 'info')
          return
        }
        const cur = flagged.findIndex((b) => b.id === selected)
        const next = flagged[Math.min(flagged.length - 1, Math.max(0, cur) + 1)]
        if (next) selectBubble(next.id)
        return
      }
      if (e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault()
        const flagged = openFlaggedBubbles(doc, layoutsByBubble, editBubbles)
        if (!flagged.length) {
          toast('Bu sayfada inceleme kalmadı', 'info')
          return
        }
        const cur = flagged.findIndex((b) => b.id === selected)
        const next = flagged[Math.max(0, (cur < 0 ? 0 : cur) - 1)]
        if (next) selectBubble(next.id)
        return
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        patchUi({
          bubbleFilter: bubbleFilter === 'flag' ? 'all' : 'flag',
        })
        return
      }

      // Frame nudge — arrow keys when a bubble is selected. Only moves the
      // box; text does not reflow until "Oto dizgi" (plan §Faz 1 #4).
      // Disabled while brushing so arrows don't fight the tool.
      if (
        brush.mode === 'off' &&
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

      // Hard-delete selected bubble
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selected != null
      ) {
        e.preventDefault()
        deleteBubble(pageId, selected)
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

      // Escape clears brush tool first, then bubble selection
      if (e.key === 'Escape') {
        if (brush.mode !== 'off' || activeTool === 'frame') {
          setActiveTool('select')
          return
        }
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
    pageSession?.layoutsByBubble,
    brush.mode,
    brush.radiusPx,
    activeTool,
    bubbleFilter,
    shortcutsOpen,
    selectPage,
    selectBubble,
    setViewMode,
    toggleLayer,
    toggleBubbleDone,
    deleteBubble,
    setFrame,
    setBrushMode,
    setBrushRadius,
    setActiveTool,
    patchUi,
    undo,
    redo,
  ])

  return { shortcutsOpen, setShortcutsOpen }
}
