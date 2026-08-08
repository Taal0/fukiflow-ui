import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, PanelLeft } from 'lucide-react'
import { ApiError } from '@/api/client'
import {
  useChapterPages,
  useChapters,
  useDeletePageMutation,
  useFonts,
  usePage,
  usePrefetchNeighborPages,
} from '@/api/queries'
import { PageCanvas } from '@/canvas/PageCanvas'
import { ToolRail } from '@/components/canvas/ToolRail'
import { ZoomControls } from '@/components/canvas/ZoomControls'
import { ConflictDialog } from '@/components/ConflictDialog'
import { MobileWarning } from '@/components/MobileWarning'
import { PageGallery } from '@/components/PageGallery'
import { ShortcutsHelp } from '@/components/ShortcutsHelp'
import { BrandMark } from '@/components/BrandMark'
import { RoleSwitch } from '@/components/RoleSwitch'
import { ViewToggle } from '@/components/ViewToggle'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Toaster } from '@/components/ui/toaster'
import { StatusBar } from '@/components/layout/StatusBar'
import { WorkspaceShell } from '@/components/layout/WorkspaceShell'
import { TranslatorPanel } from '@/components/translator/TranslatorPanel'
import { useAutosave } from '@/hooks/useAutosave'
import { useDebouncedTypeset } from '@/hooks/useDebouncedTypeset'
import { useDebouncedVerify } from '@/hooks/useDebouncedVerify'
import { useHeldPageDetail } from '@/hooks/useHeldPageDetail'
import { useHydratePageEdit } from '@/hooks/useHydratePageEdit'
import { useResizablePanel } from '@/hooks/useResizablePanel'
import { useResolveConflict } from '@/hooks/useResolveConflict'
import { useTranslatorKeys } from '@/hooks/useTranslatorKeys'
import { buildWorkingDoc, orderedItems } from '@/lib/workingDoc'
import {
  applyThemeAttribute,
  GALLERY_WIDTH,
  PANEL_WIDTH,
  useSession,
} from '@/store/session'
import { toast } from '@/store/toast'

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const m = window.matchMedia(query)
    const onChange = () => setMatches(m.matches)
    onChange()
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export function TranslatorView() {
  const { slug: routeSlug, pageId: routePageId } = useParams()
  const navigate = useNavigate()
  const chapters = useChapters()
  const chapterSlug = useSession((s) => s.chapterSlug)
  const setChapterSlug = useSession((s) => s.setChapterSlug)
  const selectedPageId = useSession((s) => s.selectedPageId)
  const selectPage = useSession((s) => s.selectPage)
  const selectBubble = useSession((s) => s.selectBubble)
  const selectRegion = useSession((s) => s.selectRegion)
  const setBubbleText = useSession((s) => s.setBubbleText)
  const setRegionText = useSession((s) => s.setRegionText)
  const deleteRegion = useSession((s) => s.deleteRegion)
  const deleteBubble = useSession((s) => s.deleteBubble)
  const reorder = useSession((s) => s.reorder)
  const setViewMode = useSession((s) => s.setViewMode)
  const viewMode = useSession((s) => s.viewMode)
  const theme = useSession((s) => s.ui.theme)
  const galleryWidth = useSession((s) => s.ui.galleryWidth)
  const panelWidth = useSession((s) => s.ui.panelWidth)
  const zoomPercent = useSession((s) => s.ui.zoomPercent)
  const galleryDrawerOpen = useSession((s) => s.ui.galleryDrawerOpen)
  const patchUi = useSession((s) => s.patchUi)
  const setActiveTool = useSession((s) => s.setActiveTool)
  const pagesMap = useSession((s) => s.pages)
  const deletePage = useDeletePageMutation()

  const isTablet = useMediaQuery('(max-width: 1023px)')
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  useEffect(() => {
    applyThemeAttribute(theme)
  }, [theme])

  useEffect(() => {
    setViewMode('original')
    setActiveTool('select')
  }, [setViewMode, setActiveTool])

  const galleryResize = useResizablePanel({
    value: galleryWidth,
    onChange: (w) => patchUi({ galleryWidth: w }),
    min: GALLERY_WIDTH.min,
    max: GALLERY_WIDTH.max,
    defaultValue: GALLERY_WIDTH.default,
    edge: 'right',
  })

  const panelResize = useResizablePanel({
    value: panelWidth,
    onChange: (w) => patchUi({ panelWidth: w }),
    min: PANEL_WIDTH.min,
    max: PANEL_WIDTH.max,
    defaultValue: PANEL_WIDTH.default,
    edge: 'left',
  })

  useEffect(() => {
    if (!chapters.data?.length) {
      if (!routeSlug && !chapters.isLoading) {
        navigate('/', { replace: true })
      }
      return
    }
    if (routeSlug) {
      if (chapterSlug !== routeSlug) {
        setChapterSlug(routeSlug)
        selectPage(null)
      }
      return
    }
    // Bare /translate → catalog (no auto-pick).
    navigate('/', { replace: true })
  }, [
    chapters.data,
    chapters.isLoading,
    chapterSlug,
    routeSlug,
    setChapterSlug,
    selectPage,
    navigate,
  ])

  const pagesQuery = useChapterPages(chapterSlug ?? undefined)
  const pages = pagesQuery.data ?? []
  const chapterPageIds = useMemo(() => pages.map((p) => p.id), [pages])

  /** Navigate + store together — URL is source of truth for deep links. */
  const goToPage = (pageId: number) => {
    selectPage(pageId)
    if (chapterSlug) {
      const target = `/translate/${chapterSlug}/${pageId}`
      if (window.location.pathname !== target) {
        navigate(target)
      }
    }
  }

  // Sync store ← URL when the route changes (deep link, back/forward).
  // Do NOT depend on selectedPageId — that caused a revert race with the
  // navigate effect (selectPage(5) while URL still had 3 → snap back to 3).
  useEffect(() => {
    if (!pages.length || !chapterSlug) return

    if (routePageId != null) {
      const id = Number(routePageId)
      if (Number.isFinite(id) && pages.some((p) => p.id === id)) {
        if (useSession.getState().selectedPageId !== id) selectPage(id)
        return
      }
    }

    // No / invalid page in URL — land on current store page or first.
    const cur = useSession.getState().selectedPageId
    const fallback =
      cur != null && pages.some((p) => p.id === cur) ? cur : pages[0]!.id
    selectPage(fallback)
    navigate(`/translate/${chapterSlug}/${fallback}`, { replace: true })
  }, [pages, chapterSlug, routePageId, selectPage, navigate])

  const pageQuery = usePage(selectedPageId)
  usePrefetchNeighborPages(selectedPageId, chapterPageIds)
  const held = useHeldPageDetail(selectedPageId, pageQuery.data, chapterSlug)
  const activePageId = held?.pageId ?? null
  const pageSession = useSession((s) =>
    activePageId != null ? s.pages[activePageId] : undefined,
  )
  const fontsQuery = useFonts()
  const fonts = fontsQuery.data ?? []

  useHydratePageEdit(selectedPageId, pageQuery.data)

  useAutosave({ userId: 'translator' })
  const conflict = useResolveConflict()
  const {
    pending: typesetPending,
    error: typesetError,
  } = useDebouncedTypeset(pageQuery.data)
  const { error: verifyError } = useDebouncedVerify(pageQuery.data)

  useEffect(() => {
    if (typesetError) toast(typesetError, 'danger', 5000)
  }, [typesetError])

  useEffect(() => {
    if (verifyError) toast(verifyError, 'danger', 5000)
  }, [verifyError])

  const keys = useTranslatorKeys({
    pages,
    doc: held?.detail.doc,
    pageId: activePageId,
    edit: pageSession?.edit,
    onSelectPage: goToPage,
  })

  const workingDetail = useMemo(() => {
    if (!held) return undefined
    const working = buildWorkingDoc(held.detail.doc, pageSession)
    return { ...held.detail, doc: working }
  }, [held, pageSession])

  const galleryPages = useMemo(() => {
    return pages.map((p) => {
      const session = pagesMap[p.id]
      if (!session?.hydrated) return p
      const regionN = session.edit.regions?.length ?? 0
      const removedN = session.edit.removed_bubbles?.length ?? 0
      let translated = 0
      const removed = new Set(session.edit.removed_bubbles ?? [])
      for (const [key, be] of Object.entries(session.edit.bubbles)) {
        if (removed.has(Number(key))) continue
        if (typeof be.text === 'string' && be.text.trim()) translated += 1
      }
      for (const r of session.edit.regions ?? []) {
        if (r.text?.trim()) translated += 1
      }
      return {
        ...p,
        translated_count: translated,
        bubble_count: Math.max(0, p.bubble_count - removedN) + regionN,
      }
    })
  }, [pages, pagesMap])

  const selectedLabel = useMemo(() => {
    if (!workingDetail || !pageSession) return null
    const items = orderedItems(workingDetail.doc, pageSession.edit)
    if (pageSession.selectedRegionId) {
      const idx = items.findIndex(
        (i) => i.kind === 'region' && i.id === pageSession.selectedRegionId,
      )
      return idx >= 0 ? `R${idx + 1} · kutu` : 'Kutu'
    }
    if (pageSession.selectedBubbleId != null) {
      const idx = items.findIndex(
        (i) =>
          i.kind === 'bubble' && Number(i.id) === pageSession.selectedBubbleId,
      )
      return idx >= 0
        ? `Sıra ${idx + 1} · #${pageSession.selectedBubbleId}`
        : `#${pageSession.selectedBubbleId}`
    }
    return null
  }, [workingDetail, pageSession])

  const pageIdx = pages.findIndex((p) => p.id === selectedPageId)
  const orderStats = useMemo(() => {
    if (!workingDetail || !pageSession) return { total: 0, translated: 0 }
    const items = orderedItems(workingDetail.doc, pageSession.edit)
    let translated = 0
    for (const item of items) {
      if (item.kind === 'bubble') {
        if (pageSession.edit.bubbles[item.id]?.text?.trim()) translated += 1
      } else if (
        pageSession.edit.regions?.find((r) => r.id === item.id)?.text?.trim()
      ) {
        translated += 1
      }
    }
    return { total: items.length, translated }
  }, [workingDetail, pageSession])
  const pageProgress = [
    orderStats.total
      ? `${orderStats.translated}/${orderStats.total} çevrildi`
      : null,
    pageIdx >= 0 ? `Sayfa ${pageIdx + 1}/${pages.length}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const goPrevPage = () => {
    if (pageIdx <= 0) return
    goToPage(pages[pageIdx - 1]!.id)
  }
  const goNextPage = () => {
    if (pageIdx < 0 || pageIdx >= pages.length - 1) return
    goToPage(pages[pageIdx + 1]!.id)
  }

  const currentPage = pageIdx >= 0 ? pages[pageIdx] : undefined
  const pageLabel = currentPage
    ? currentPage.stem || `Sayfa ${currentPage.page_no}`
    : null

  const chapterSource =
    chapters.data?.find((c) => c.slug === chapterSlug)?.source_type ?? 'seed'
  const canDeletePages = chapterSource === 'upload'

  const handleDeletePage = (pageId: number) => {
    const idx = pages.findIndex((p) => p.id === pageId)
    const next = pages[idx + 1]?.id ?? pages[idx - 1]?.id ?? null
    deletePage.mutate(pageId, {
      onSuccess: (data) => {
        if (data.chapter_deleted) {
          navigate('/', { replace: true })
          toast('Chapter silindi', 'success')
          return
        }
        if (selectedPageId === pageId) {
          if (next != null) goToPage(next)
          else navigate('/', { replace: true })
        }
        toast('Sayfa silindi', 'success')
      },
      onError: (e) => {
        toast(e instanceof ApiError ? e.message : 'Sayfa silinemedi', 'danger')
      },
    })
  }

  const galleryNode = (
    <>
      {isDesktop && (
        <div className="relative flex h-full shrink-0">
          <PageGallery
            pages={galleryPages}
            selectedPageId={selectedPageId}
            onSelect={goToPage}
            loading={pagesQuery.isLoading || chapters.isLoading}
            error={
              pagesQuery.error instanceof Error
                ? pagesQuery.error.message
                : null
            }
            width={galleryResize.width}
            progressMode="translated"
            canDeletePages={canDeletePages}
            onDeletePage={handleDeletePage}
          />
          <div
            {...galleryResize.handleProps}
            className="absolute right-0 top-0 z-10 h-full w-1.5 translate-x-1/2 cursor-col-resize hover:bg-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
          />
        </div>
      )}
      {isTablet && (
        <PageGallery
          pages={galleryPages}
          selectedPageId={selectedPageId}
          onSelect={goToPage}
          loading={pagesQuery.isLoading || chapters.isLoading}
          error={
            pagesQuery.error instanceof Error
              ? pagesQuery.error.message
              : null
          }
          width={GALLERY_WIDTH.default}
          asDrawer
          drawerOpen={galleryDrawerOpen}
          onCloseDrawer={() => patchUi({ galleryDrawerOpen: false })}
          progressMode="translated"
          canDeletePages={canDeletePages}
          onDeletePage={handleDeletePage}
        />
      )}
    </>
  )

  return (
    <>
      <MobileWarning />
      <WorkspaceShell
        toolbar={
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3">
            {isTablet && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Sayfa listesi"
                aria-pressed={galleryDrawerOpen}
                onClick={() =>
                  patchUi({ galleryDrawerOpen: !galleryDrawerOpen })
                }
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            <Link
              to="/"
              className="outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
              title="Projeler"
            >
              <BrandMark size="sm" />
            </Link>
            <RoleSwitch value="translator" chapterSlug={chapterSlug} />

            <div className="mx-1 hidden h-5 w-px bg-[var(--color-border)] sm:block" />

            {/* Page switcher — primary nav for translator flow */}
            <div className="flex min-w-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Önceki sayfa"
                title="Önceki sayfa (K)"
                disabled={pageIdx <= 0}
                onClick={goPrevPage}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span
                className="min-w-[4.5rem] text-center text-[length:var(--text-ui)] tabular-nums text-[var(--color-ink)]"
                title={pageLabel ?? undefined}
              >
                {pageIdx >= 0
                  ? `${pageIdx + 1} / ${pages.length}`
                  : '—'}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Sonraki sayfa"
                title="Sonraki sayfa (J)"
                disabled={pageIdx < 0 || pageIdx >= pages.length - 1}
                onClick={goNextPage}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {pageLabel && (
                <span className="ml-1 hidden min-w-0 max-w-[12rem] truncate text-[length:var(--text-meta)] text-[var(--color-ink-muted)] md:inline">
                  {pageLabel}
                </span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <ViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>
        }
        gallery={galleryNode}
        rail={<ToolRail tools={['select', 'region']} />}
        canvas={
          <div className="relative min-h-0 flex-1">
            {workingDetail ? (
              <>
                <PageCanvas
                  detail={workingDetail}
                  fonts={fonts}
                  mode="translator"
                />
                <ZoomControls />
                {(held?.isTransitioning || pageQuery.isFetching) && (
                  <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-[var(--color-surface-raised)]/90 px-2 py-1 text-[length:var(--text-meta)] text-[var(--color-ink-muted)] shadow-sm ring-1 ring-[var(--color-border)]">
                    Sayfa yükleniyor…
                  </div>
                )}
              </>
            ) : pageQuery.isLoading ? (
              <EmptyState title="Sayfa yükleniyor…" />
            ) : (
              <EmptyState
                title="Sayfa seçilmedi"
                description="Soldan bir sayfa seçin"
              />
            )}
          </div>
        }
        panel={
          <div className="relative flex h-full shrink-0">
            <div
              {...panelResize.handleProps}
              className="absolute left-0 top-0 z-10 h-full w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
            />
            {workingDetail && pageSession ? (
              <TranslatorPanel
                doc={workingDetail.doc}
                edit={pageSession.edit}
                width={panelResize.width}
                selectedBubbleId={pageSession.selectedBubbleId}
                selectedRegionId={pageSession.selectedRegionId}
                onSelectBubble={(id) => selectBubble(id)}
                onSelectRegion={(id) => selectRegion(id)}
                onBubbleText={(id, text) => {
                  if (activePageId != null) setBubbleText(activePageId, id, text)
                }}
                onRegionText={(id, text) => {
                  if (activePageId != null) setRegionText(activePageId, id, text)
                }}
                onDeleteRegion={(id) => {
                  if (activePageId != null) deleteRegion(activePageId, id)
                }}
                onDeleteBubble={(id) => {
                  if (activePageId != null) deleteBubble(activePageId, id)
                }}
                onReorder={(tokens) => {
                  if (activePageId != null) reorder(activePageId, tokens)
                }}
              />
            ) : (
              <div
                style={{ width: panelResize.width }}
                className="h-full border-l border-[var(--color-border)]"
              />
            )}
          </div>
        }
        status={
          <StatusBar
            saveStatus={pageSession?.saveStatus}
            saveError={pageSession?.saveError}
            dirty={pageSession?.dirty}
            zoomPercent={zoomPercent}
            selectedLabel={selectedLabel}
            typesetPending={typesetPending}
            hideTypeset
            pageProgress={pageProgress || null}
          />
        }
      />
      {activePageId != null && (
        <ConflictDialog
          open={pageSession?.saveStatus === 'conflict'}
          onTakeServer={() => conflict.takeServer(activePageId)}
          onKeepMine={() => conflict.keepMine(activePageId)}
        />
      )}
      <ShortcutsHelp
        open={keys.shortcutsOpen}
        onClose={() => keys.setShortcutsOpen(false)}
        shortcuts={keys.shortcuts}
      />
      <Toaster />
    </>
  )
}
