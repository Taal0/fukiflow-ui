import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '@/api/client'
import {
  useChapterPages,
  useChapters,
  useDeletePageEditMutation,
  useDeletePageMutation,
  useFonts,
  usePage,
  usePrefetchNeighborPages,
  useReprocessPageMutation,
} from '@/api/queries'
import { textLayerId } from '@/api/types'
import { PageCanvas } from '@/canvas/PageCanvas'
import { BubblePanel } from '@/components/bubbles/BubblePanel'
import { ToolOptionsBar } from '@/components/canvas/ToolOptionsBar'
import { ToolRail } from '@/components/canvas/ToolRail'
import { ZoomControls } from '@/components/canvas/ZoomControls'
import { ConflictDialog } from '@/components/ConflictDialog'
import { MobileWarning } from '@/components/MobileWarning'
import {
  OnboardingGuide,
  OnboardingTip,
} from '@/components/OnboardingGuide'
import { PageGallery } from '@/components/PageGallery'
import { ShortcutsHelp } from '@/components/ShortcutsHelp'
import { Toolbar } from '@/components/Toolbar'
import { CanvasPlaceholder } from '@/components/loading/CanvasPlaceholder'
import { PageStatusPlaceholder } from '@/components/loading/PageStatusPlaceholder'
import { PanelPlaceholder } from '@/components/loading/PanelPlaceholder'
import { EmptyState } from '@/components/ui/empty-state'
import { IndeterminateBar } from '@/components/ui/indeterminate-bar'
import { Toaster } from '@/components/ui/toaster'
import { StatusBar } from '@/components/layout/StatusBar'
import { WorkspaceShell } from '@/components/layout/WorkspaceShell'
import { useAutosave } from '@/hooks/useAutosave'
import { useDelayedFlag } from '@/hooks/useDelayedFlag'
import { useDebouncedTypeset } from '@/hooks/useDebouncedTypeset'
import { useHeldPageDetail } from '@/hooks/useHeldPageDetail'
import { useHydratePageEdit } from '@/hooks/useHydratePageEdit'
import { useResizablePanel } from '@/hooks/useResizablePanel'
import { useResolveConflict } from '@/hooks/useResolveConflict'
import { useWorkspaceKeys } from '@/hooks/useWorkspaceKeys'
import {
  resolveBubbleFrame,
  resolveFontPx,
} from '@/lib/bubbleFrame'
import { buildWorkingDoc } from '@/lib/workingDoc'
import {
  applyThemeAttribute,
  bubbleFontsFromEdit,
  disabledLayerIdsFromEdit,
  doneCountFromEdit,
  GALLERY_WIDTH,
  PANEL_WIDTH,
  textOverridesFromEdit,
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

export function WorkspaceView() {
  const { slug: routeSlug } = useParams()
  const navigate = useNavigate()
  const chapters = useChapters()
  const chapterSlug = useSession((s) => s.chapterSlug)
  const setChapterSlug = useSession((s) => s.setChapterSlug)
  const selectedPageId = useSession((s) => s.selectedPageId)
  const selectPage = useSession((s) => s.selectPage)
  const selectBubble = useSession((s) => s.selectBubble)
  const setLayerEnabled = useSession((s) => s.setLayerEnabled)
  const setBubbleText = useSession((s) => s.setBubbleText)
  const clearBubbleText = useSession((s) => s.clearBubbleText)
  const setBubbleFont = useSession((s) => s.setBubbleFont)
  const setFontPx = useSession((s) => s.setFontPx)
  const setLeading = useSession((s) => s.setLeading)
  const setAlign = useSession((s) => s.setAlign)
  const setFrame = useSession((s) => s.setFrame)
  const setBubbleDone = useSession((s) => s.setBubbleDone)
  const setInset = useSession((s) => s.setInset)
  const deleteBubble = useSession((s) => s.deleteBubble)
  const clearBubbleTypeset = useSession((s) => s.clearBubbleTypeset)
  const clearPaintForBubble = useSession((s) => s.clearPaintForBubble)
  const resetPageLocal = useSession((s) => s.resetPageLocal)
  const undo = useSession((s) => s.undo)
  const redo = useSession((s) => s.redo)
  const theme = useSession((s) => s.ui.theme)
  const galleryWidth = useSession((s) => s.ui.galleryWidth)
  const panelWidth = useSession((s) => s.ui.panelWidth)
  const zoomPercent = useSession((s) => s.ui.zoomPercent)
  const galleryDrawerOpen = useSession((s) => s.ui.galleryDrawerOpen)
  const patchUi = useSession((s) => s.patchUi)
  const deleteEdit = useDeletePageEditMutation()
  const deletePage = useDeletePageMutation()
  const reprocess = useReprocessPageMutation()
  const [guideOpen, setGuideOpen] = useState(false)
  const [canvasReady, setCanvasReady] = useState(false)

  const isTablet = useMediaQuery('(max-width: 1023px)')
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  useEffect(() => {
    applyThemeAttribute(theme)
  }, [theme])

  // URL is source of truth for chapter.
  useEffect(() => {
    if (!routeSlug) {
      navigate('/', { replace: true })
      return
    }
    if (chapterSlug !== routeSlug) {
      setChapterSlug(routeSlug)
      selectPage(null)
    }
  }, [routeSlug, chapterSlug, setChapterSlug, navigate, selectPage])

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

  const pagesQ = useChapterPages(chapterSlug ?? undefined)
  const chapterPageIds = useMemo(
    () => pagesQ.data?.map((p) => p.id) ?? [],
    [pagesQ.data],
  )
  const fontsQ = useFonts()
  const pageQ = usePage(selectedPageId)
  usePrefetchNeighborPages(selectedPageId, chapterPageIds)
  const held = useHeldPageDetail(selectedPageId, pageQ.data, chapterSlug)
  // Paint/edit the held page so seed + overlay stay paired during fetches.
  const activePageId = held?.pageId ?? null
  const pageSession = useSession((s) =>
    activePageId != null ? s.pages[activePageId] : undefined,
  )

  useHydratePageEdit(selectedPageId, pageQ.data)

  // Drop a selection that belongs to another manga (chapter switch / stale store).
  useEffect(() => {
    if (!pagesQ.data?.length) return
    const valid =
      selectedPageId != null &&
      pagesQ.data.some((p) => p.id === selectedPageId)
    if (valid) return
    const firstReady =
      pagesQ.data.find((p) => (p.processing_status ?? 'ready') === 'ready') ??
      pagesQ.data[0]!
    selectPage(firstReady.id)
  }, [pagesQ.data, selectedPageId, selectPage])

  // Unknown slug → back to catalog.
  useEffect(() => {
    if (!routeSlug || chapters.isLoading || !chapters.data) return
    if (!chapters.data.some((c) => c.slug === routeSlug)) {
      navigate('/', { replace: true })
    }
  }, [routeSlug, chapters.data, chapters.isLoading, navigate])

  const { retrySave } = useAutosave()
  const conflict = useResolveConflict()

  const {
    pending: typesetPending,
    error: typesetError,
    runTypeset,
  } = useDebouncedTypeset(pageQ.data)

  useEffect(() => {
    if (typesetError) toast(typesetError, 'danger', 5000)
  }, [typesetError])

  useEffect(() => {
    if (pageSession?.saveStatus === 'error' && pageSession.saveError) {
      toast(pageSession.saveError, 'danger', 5000)
    }
  }, [pageSession?.saveStatus, pageSession?.saveError])

  const workingDetail = useMemo(() => {
    if (!held) return undefined
    const doc = buildWorkingDoc(held.detail.doc, pageSession)
    return { ...held.detail, doc }
  }, [held, pageSession])

  const chapterTitle =
    chapters.data?.find((c) => c.slug === chapterSlug)?.title ?? chapterSlug
  const chapterSource =
    chapters.data?.find((c) => c.slug === chapterSlug)?.source_type ?? 'seed'
  const firstRunSource = chapterSource === 'upload' ? 'upload' : 'seed'
  const dismissFirstRunStep = useSession((s) => s.dismissFirstRunStep)
  const canDeletePages = true

  useEffect(() => {
    if (!chapterSlug || !chapters.data) return
    dismissFirstRunStep(1)
    if (firstRunSource === 'seed') dismissFirstRunStep(2)
  }, [chapterSlug, chapters.data, firstRunSource, dismissFirstRunStep])

  const handleDeletePage = (pageId: number) => {
    const list = pagesQ.data ?? []
    const idx = list.findIndex((p) => p.id === pageId)
    const next =
      list[idx + 1]?.id ?? list[idx - 1]?.id ?? null
    deletePage.mutate(pageId, {
      onSuccess: (data) => {
        if (data.chapter_deleted) {
          navigate('/', { replace: true })
          toast('Chapter silindi', 'success')
          return
        }
        if (selectedPageId === pageId) selectPage(next)
        toast('Sayfa silindi', 'success')
      },
      onError: (e) => {
        toast(e instanceof ApiError ? e.message : 'Sayfa silinemedi', 'danger')
      },
    })
  }

  const handleReprocessPage = (pageId: number) => {
    reprocess.mutate(pageId, {
      onError: (e) => {
        toast(
          e instanceof ApiError ? e.message : 'Sayfa yeniden işlenemedi',
          'danger',
        )
      },
    })
  }

  const pageLabel =
    pageQ.data && chapterTitle
      ? `${chapterTitle} · s. ${pageQ.data.page.page_no}`
      : undefined

  const sessionPages = useSession((s) => s.pages)
  const pagesWithProgress = useMemo(() => {
    return (pagesQ.data ?? []).map((p) => {
      const session = sessionPages[p.id]
      if (!session?.hydrated) return p
      const removedN = session.edit.removed_bubbles?.length ?? 0
      return {
        ...p,
        done_count: doneCountFromEdit(session.edit),
        bubble_count: Math.max(0, p.bubble_count - removedN),
      }
    })
  }, [pagesQ.data, sessionPages])

  const catalogError =
    chapters.error instanceof ApiError
      ? chapters.error.message
      : chapters.error
        ? 'Katalog yüklenemedi'
        : pagesQ.error instanceof ApiError
          ? pagesQ.error.message
          : pagesQ.error
            ? 'Sayfalar yüklenemedi'
            : null

  const fontsUnavailable =
    fontsQ.error instanceof ApiError && fontsQ.error.status === 503

  const edit = pageSession?.edit
  const textOverrides = textOverridesFromEdit(edit)
  const bubbleFontOverrides = bubbleFontsFromEdit(edit)
  const disabledLayerIds = disabledLayerIdsFromEdit(edit)

  const autoTypesetBubbles = (
    bubbleIds: number[],
    frames?: Record<number, [number, number, number, number]>,
  ) => {
    if (!workingDetail || activePageId == null) return
    const session = useSession.getState().pages[activePageId]
    const forceOverrides: Record<
      number,
      { font_px?: number; frame?: [number, number, number, number] }
    > = {}

    for (const id of bubbleIds) {
      const bubble = workingDetail.doc.bubbles.find((b) => b.id === id)
      if (!bubble) continue
      const be = session?.edit.bubbles[String(id)]
      // Page-wide Oto dizgi skips textured fills unless already opted in.
      // Per-bubble Dizgi dene sets typeset_try below before this runs.
      if (bubble.clean_status === 'editor' && !be?.typeset_try) {
        // Explicit single-bubble call from inspector → opt in.
        if (bubbleIds.length === 1) {
          useSession.getState().patchBubble(activePageId, id, {
            typeset_try: true,
          })
        } else {
          continue
        }
      }
      const beAfter =
        useSession.getState().pages[activePageId]?.edit.bubbles[String(id)] ?? be
      const layout =
        session?.layoutsByBubble[id] ??
        workingDetail.doc.layers.find((l) => l.id === textLayerId(id))?.layout
      const text =
        beAfter?.text !== undefined
          ? beAfter.text
          : (workingDetail.doc.texts.find((t) => t.bubble_id === id)?.text ?? '')
      if (!String(text).trim()) continue

      const fontPx = resolveFontPx(beAfter, layout)
      const frame = frames?.[id] ?? resolveBubbleFrame(bubble, beAfter)

      const patch: {
        font_px?: number
        frame?: [number, number, number, number]
      } = {}
      if (beAfter?.font_px == null) patch.font_px = fontPx
      if (!beAfter?.frame && !frames?.[id]) patch.frame = frame
      if (Object.keys(patch).length) {
        useSession.getState().patchBubble(activePageId, id, patch, {
          undo: false,
        })
      }

      forceOverrides[id] = { font_px: fontPx, frame }
    }

    if (!Object.keys(forceOverrides).length) return
    runTypeset({
      forceBubbleIds: Object.keys(forceOverrides).map(Number),
      forceOverrides,
    })
  }

  const { shortcutsOpen, setShortcutsOpen } = useWorkspaceKeys({
    pages: pagesQ.data ?? [],
    doc: workingDetail?.doc,
    pageId: activePageId,
  })

  const resetPage = async () => {
    if (activePageId == null) return
    try {
      await deleteEdit.mutateAsync(activePageId)
      resetPageLocal(activePageId)
      toast('Sayfa sıfırlandı', 'success')
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        resetPageLocal(activePageId)
        toast('Sayfa sıfırlandı', 'success')
        return
      }
      toast(
        err instanceof Error ? err.message : 'Sayfa sıfırlanamadı',
        'danger',
      )
    }
  }

  const selectedBubble = workingDetail?.doc.bubbles.find(
    (b) => b.id === pageSession?.selectedBubbleId,
  )
  const selectedLabel = selectedBubble
    ? `Sıra ${selectedBubble.reading_order ?? '—'} · #${selectedBubble.id}`
    : null

  const pageProgress =
    pagesQ.data && pagesQ.data.length
      ? (() => {
          const idx = pagesQ.data.findIndex((p) => p.id === selectedPageId)
          return idx >= 0
            ? `Sayfa ${idx + 1}/${pagesQ.data.length}`
            : null
        })()
      : null

  const canUndo = Boolean(pageSession?.undoPast.length)
  const canRedo = Boolean(pageSession?.undoFuture.length)

  const previewPage =
    pagesQ.data?.find((p) => p.id === selectedPageId) ?? pagesQ.data?.[0]
  const previewUrl = previewPage?.thumb_url ?? null
  const previewAspect =
    previewPage && previewPage.height > 0
      ? previewPage.width / previewPage.height
      : 2 / 3
  const pageCountHint = chapters.data?.find(
    (c) => c.slug === chapterSlug,
  )?.page_count

  const selectedSummary = (pagesQ.data ?? []).find(
    (p) => p.id === selectedPageId,
  )
  const pageStatus = selectedSummary?.processing_status ?? 'ready'
  const notReady =
    pageStatus !== 'ready' ||
    (pageQ.error instanceof ApiError && pageQ.error.status === 409)

  const switching = Boolean(held?.isTransitioning)
  const opening =
    Boolean(!pageQ.error) &&
    !notReady &&
    ((pageQ.isLoading && !workingDetail) ||
      Boolean(workingDetail && !canvasReady && !switching))
  const showLoadChrome = useDelayedFlag(opening || switching, 150)
  const showSlowHint = useDelayedFlag(opening || switching, 1200)
  const loadingMessage =
    opening || switching
      ? showLoadChrome
        ? showSlowHint
          ? 'Büyük sayfa, biraz sürer'
          : 'Sayfa açılıyor'
        : null
      : null

  useEffect(() => {
    if (!workingDetail) setCanvasReady(false)
  }, [workingDetail])

  const galleryNode = (
    <>
      {isDesktop && (
        <div className="relative flex h-full shrink-0">
          <PageGallery
            pages={pagesWithProgress}
            selectedPageId={selectedPageId}
            onSelect={selectPage}
            loading={pagesQ.isLoading || chapters.isLoading}
            error={catalogError}
            width={galleryResize.width}
            canDeletePages={canDeletePages}
            onDeletePage={handleDeletePage}
            onReprocessPage={handleReprocessPage}
            pageCountHint={pageCountHint}
          />
          <div
            {...galleryResize.handleProps}
            className="absolute right-0 top-0 z-10 h-full w-1.5 translate-x-1/2 cursor-col-resize hover:bg-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
          />
        </div>
      )}
      {isTablet && (
        <PageGallery
          pages={pagesWithProgress}
          selectedPageId={selectedPageId}
          onSelect={selectPage}
          loading={pagesQ.isLoading || chapters.isLoading}
          error={catalogError}
          width={GALLERY_WIDTH.default}
          asDrawer
          drawerOpen={galleryDrawerOpen}
          onCloseDrawer={() => patchUi({ galleryDrawerOpen: false })}
          canDeletePages={canDeletePages}
          onDeletePage={handleDeletePage}
          onReprocessPage={handleReprocessPage}
          pageCountHint={pageCountHint}
        />
      )}
    </>
  )

  const panelNode = workingDetail ? (
    <div className="relative flex h-full shrink-0">
      <div
        {...panelResize.handleProps}
        className="absolute left-0 top-0 z-10 h-full w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
      />
      <BubblePanel
        doc={workingDetail.doc}
        selectedBubbleId={pageSession?.selectedBubbleId ?? null}
        disabledLayerIds={disabledLayerIds}
        layoutsByBubble={pageSession?.layoutsByBubble ?? {}}
        textOverrides={textOverrides}
        bubbleFontOverrides={bubbleFontOverrides}
        bubbleEdits={edit?.bubbles ?? {}}
        regions={edit?.regions ?? []}
        order={edit?.order ?? []}
        fonts={fontsQ.data ?? []}
        typesetPending={typesetPending}
        width={panelResize.width}
        onSelect={selectBubble}
        onToggleLayer={(layerId, enabled) => {
          if (activePageId == null) return
          setLayerEnabled(activePageId, layerId, enabled)
        }}
        onTextChange={(bubbleId, text) => {
          if (activePageId == null) return
          setBubbleText(activePageId, bubbleId, text)
        }}
        onResetText={(bubbleId) => {
          if (activePageId == null) return
          clearBubbleText(activePageId, bubbleId)
        }}
        onBubbleFont={(bubbleId, fontKey) => {
          if (activePageId == null) return
          setBubbleFont(activePageId, bubbleId, fontKey)
        }}
        onFontPx={(bubbleId, px) => {
          if (activePageId == null) return
          setFontPx(activePageId, bubbleId, px)
        }}
        onLeading={(bubbleId, leading) => {
          if (activePageId == null) return
          setLeading(activePageId, bubbleId, leading)
        }}
        onAlign={(bubbleId, align) => {
          if (activePageId == null) return
          setAlign(activePageId, bubbleId, align)
        }}
        onResetFrame={(bubbleId) => {
          if (activePageId == null) return
          setFrame(activePageId, bubbleId, null)
          autoTypesetBubbles([bubbleId])
        }}
        onAutoTypeset={(bubbleId) => autoTypesetBubbles([bubbleId])}
        onClearTypeset={(bubbleId) => {
          if (activePageId == null) return
          clearBubbleTypeset(activePageId, bubbleId)
        }}
        onToggleDone={(bubbleId, done) => {
          if (activePageId == null) return
          setBubbleDone(activePageId, bubbleId, done)
        }}
        onInset={(bubbleId, inset) => {
          if (activePageId == null) return
          setInset(activePageId, bubbleId, inset)
        }}
        onDeleteBubble={(bubbleId) => {
          if (activePageId == null) return
          deleteBubble(activePageId, bubbleId)
        }}
      />
    </div>
  ) : (
    <div className="relative flex h-full shrink-0">
      <div
        {...panelResize.handleProps}
        className="absolute left-0 top-0 z-10 h-full w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
      />
      <PanelPlaceholder width={panelResize.width} title="Balonlar" />
    </div>
  )

  return (
    <>
      <MobileWarning />
      <Toaster />
      <OnboardingGuide open={guideOpen} onOpenChange={setGuideOpen} />
      <ShortcutsHelp
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <ConflictDialog
        open={pageSession?.saveStatus === 'conflict'}
        onTakeServer={() => {
          if (activePageId != null) conflict.takeServer(activePageId)
        }}
        onKeepMine={() => {
          if (activePageId == null) return
          conflict.keepMine(activePageId)
          retrySave(activePageId)
        }}
      />

      <WorkspaceShell
        toolbar={
          <Toolbar
            pageLabel={pageLabel}
            detail={workingDetail}
            pages={pagesQ.data}
            fonts={fontsQ.data ?? []}
            chapterSlug={chapterSlug}
            typesetPending={typesetPending}
            visionUnavailable={fontsUnavailable}
            canUndo={canUndo}
            canRedo={canRedo}
            showGalleryToggle={isTablet}
            onToggleGallery={() =>
              patchUi({ galleryDrawerOpen: !galleryDrawerOpen })
            }
            onResetPage={() => void resetPage()}
            onAutoTypesetPage={() => {
              if (!workingDetail) return
              autoTypesetBubbles(workingDetail.doc.bubbles.map((b) => b.id))
            }}
            onRetrySave={() => {
              if (activePageId != null) retrySave(activePageId)
            }}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onOpenGuide={() => setGuideOpen(true)}
            onUndo={() => {
              if (activePageId != null) undo(activePageId)
            }}
            onRedo={() => {
              if (activePageId != null) redo(activePageId)
            }}
          />
        }
        tip={<OnboardingTip step={4} source={firstRunSource} />}
        banner={
          (fontsUnavailable || catalogError) && (
            <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-accent-soft)] px-4 py-2 text-[length:var(--text-ui)] text-[var(--color-ink)]">
              {catalogError && <span>{catalogError}. </span>}
              {fontsUnavailable && (
                <span>
                  Dizgi servisi şu an kapalı (503) — görüntüleme çalışmaya devam
                  ediyor; oto dizgi ve indirme için servisi başlatın. Kayıtlar
                  yerelde bekler.
                </span>
              )}
            </div>
          )
        }
        gallery={galleryNode}
        rail={<ToolRail />}
        canvas={
          <>
            {workingDetail && (
              <ToolOptionsBar
                selectedBubbleId={pageSession?.selectedBubbleId ?? null}
                onClearPaint={(bubbleId) => {
                  if (activePageId == null) return
                  clearPaintForBubble(activePageId, bubbleId)
                }}
              />
            )}
            <main
              className="relative min-h-0 flex-1"
              aria-busy={opening || switching}
            >
              {notReady && !workingDetail && (
                <PageStatusPlaceholder
                  status={
                    pageStatus !== 'ready' ? pageStatus : 'processing'
                  }
                  errorMessage={
                    selectedSummary?.error_message ??
                    (pageQ.error instanceof ApiError
                      ? pageQ.error.message
                      : null)
                  }
                  onRetry={
                    pageStatus === 'error' && selectedPageId != null
                      ? () => handleReprocessPage(selectedPageId)
                      : undefined
                  }
                  retrying={
                    reprocess.isPending &&
                    reprocess.variables === selectedPageId
                  }
                />
              )}
              {pageQ.error && !workingDetail && !notReady && (
                <EmptyState
                  title="Sayfa açılamadı"
                  description={
                    pageQ.error instanceof ApiError
                      ? pageQ.error.message
                      : 'Sayfa yüklenirken bir hata oluştu.'
                  }
                />
              )}
              {workingDetail && (
                <>
                  <PageCanvas
                    detail={workingDetail}
                    fonts={fontsQ.data ?? []}
                    onReadyChange={setCanvasReady}
                  />
                  <ZoomControls />
                </>
              )}
              {!pageQ.isLoading &&
                !pageQ.error &&
                !workingDetail &&
                !opening &&
                !notReady && (
                  <EmptyState
                    title="Sayfa seçilmedi"
                    description="Soldan bir sayfa seçerek düzenlemeye başlayın."
                  />
                )}
              {opening && (
                <CanvasPlaceholder
                  previewUrl={previewUrl}
                  aspect={previewAspect}
                  showBar={showLoadChrome}
                />
              )}
              {switching && showLoadChrome && (
                <IndeterminateBar className="absolute inset-x-0 top-0 z-20" />
              )}
            </main>
          </>
        }
        panel={panelNode}
        status={
          <StatusBar
            saveStatus={pageSession?.saveStatus}
            saveError={pageSession?.saveError}
            dirty={pageSession?.dirty}
            zoomPercent={zoomPercent}
            selectedLabel={selectedLabel}
            typesetPending={typesetPending}
            pageProgress={pageProgress}
            loadingMessage={loadingMessage}
          />
        }
      />
    </>
  )
}
