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
import { EmptyState } from '@/components/ui/empty-state'
import { Toaster } from '@/components/ui/toaster'
import { StatusBar } from '@/components/layout/StatusBar'
import { WorkspaceShell } from '@/components/layout/WorkspaceShell'
import { useAutosave } from '@/hooks/useAutosave'
import { useDebouncedTypeset } from '@/hooks/useDebouncedTypeset'
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
  const pageSession = useSession((s) =>
    selectedPageId != null ? s.pages[selectedPageId] : undefined,
  )
  const deleteEdit = useDeletePageEditMutation()
  const deletePage = useDeletePageMutation()
  const [guideOpen, setGuideOpen] = useState(false)

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
  const fontsQ = useFonts()
  const pageQ = usePage(selectedPageId)

  useHydratePageEdit(selectedPageId, pageQ.data)

  useEffect(() => {
    if (selectedPageId != null || !pagesQ.data?.length) return
    selectPage(pagesQ.data[0]!.id)
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
    if (!pageQ.data) return undefined
    const doc = buildWorkingDoc(pageQ.data.doc, pageSession)
    return { ...pageQ.data, doc }
  }, [pageQ.data, pageSession])

  const chapterTitle =
    chapters.data?.find((c) => c.slug === chapterSlug)?.title ?? chapterSlug
  const chapterSource =
    chapters.data?.find((c) => c.slug === chapterSlug)?.source_type ?? 'seed'
  const canDeletePages = chapterSource === 'upload'

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

  const pageLabel =
    pageQ.data && chapterTitle
      ? `${chapterTitle} · s. ${pageQ.data.page.page_no}`
      : undefined

  const sessionPages = useSession((s) => s.pages)
  const pagesWithProgress = useMemo(() => {
    return (pagesQ.data ?? []).map((p) => {
      const session = sessionPages[p.id]
      if (!session?.hydrated) return p
      return { ...p, done_count: doneCountFromEdit(session.edit) }
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
    if (!workingDetail || selectedPageId == null) return
    const session = useSession.getState().pages[selectedPageId]
    const forceOverrides: Record<
      number,
      { font_px?: number; frame?: [number, number, number, number] }
    > = {}

    for (const id of bubbleIds) {
      const bubble = workingDetail.doc.bubbles.find((b) => b.id === id)
      if (!bubble || bubble.clean_status === 'editor') continue
      const be = session?.edit.bubbles[String(id)]
      const layout =
        session?.layoutsByBubble[id] ??
        workingDetail.doc.layers.find((l) => l.id === textLayerId(id))?.layout
      const text =
        be?.text !== undefined
          ? be.text
          : (workingDetail.doc.texts.find((t) => t.bubble_id === id)?.text ?? '')
      if (!String(text).trim()) continue

      const fontPx = resolveFontPx(be, layout)
      const frame = frames?.[id] ?? resolveBubbleFrame(bubble, be)

      const patch: {
        font_px?: number
        frame?: [number, number, number, number]
      } = {}
      if (be?.font_px == null) patch.font_px = fontPx
      if (!be?.frame && !frames?.[id]) patch.frame = frame
      if (Object.keys(patch).length) {
        useSession.getState().patchBubble(selectedPageId, id, patch, {
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
    pageId: selectedPageId,
  })

  const resetPage = async () => {
    if (selectedPageId == null) return
    try {
      await deleteEdit.mutateAsync(selectedPageId)
      resetPageLocal(selectedPageId)
      toast('Sayfa sıfırlandı', 'success')
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        resetPageLocal(selectedPageId)
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
          if (selectedPageId == null) return
          setLayerEnabled(selectedPageId, layerId, enabled)
        }}
        onTextChange={(bubbleId, text) => {
          if (selectedPageId == null) return
          setBubbleText(selectedPageId, bubbleId, text)
        }}
        onResetText={(bubbleId) => {
          if (selectedPageId == null) return
          clearBubbleText(selectedPageId, bubbleId)
        }}
        onBubbleFont={(bubbleId, fontKey) => {
          if (selectedPageId == null) return
          setBubbleFont(selectedPageId, bubbleId, fontKey)
        }}
        onFontPx={(bubbleId, px) => {
          if (selectedPageId == null) return
          setFontPx(selectedPageId, bubbleId, px)
        }}
        onLeading={(bubbleId, leading) => {
          if (selectedPageId == null) return
          setLeading(selectedPageId, bubbleId, leading)
        }}
        onAlign={(bubbleId, align) => {
          if (selectedPageId == null) return
          setAlign(selectedPageId, bubbleId, align)
        }}
        onResetFrame={(bubbleId) => {
          if (selectedPageId == null) return
          setFrame(selectedPageId, bubbleId, null)
          autoTypesetBubbles([bubbleId])
        }}
        onAutoTypeset={(bubbleId) => autoTypesetBubbles([bubbleId])}
        onToggleDone={(bubbleId, done) => {
          if (selectedPageId == null) return
          setBubbleDone(selectedPageId, bubbleId, done)
        }}
        onInset={(bubbleId, inset) => {
          if (selectedPageId == null) return
          setInset(selectedPageId, bubbleId, inset)
        }}
      />
    </div>
  ) : (
    <aside
      style={{ width: panelResize.width }}
      className="shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)]"
    />
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
          if (selectedPageId != null) conflict.takeServer(selectedPageId)
        }}
        onKeepMine={() => {
          if (selectedPageId == null) return
          conflict.keepMine(selectedPageId)
          retrySave(selectedPageId)
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
              if (selectedPageId != null) retrySave(selectedPageId)
            }}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onOpenGuide={() => setGuideOpen(true)}
            onUndo={() => {
              if (selectedPageId != null) undo(selectedPageId)
            }}
            onRedo={() => {
              if (selectedPageId != null) redo(selectedPageId)
            }}
          />
        }
        tip={<OnboardingTip />}
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
        rail={workingDetail ? <ToolRail /> : null}
        canvas={
          <>
            {workingDetail && (
              <ToolOptionsBar
                selectedBubbleId={pageSession?.selectedBubbleId ?? null}
                onClearPaint={(bubbleId) => {
                  if (selectedPageId == null) return
                  clearPaintForBubble(selectedPageId, bubbleId)
                }}
              />
            )}
            <main className="relative min-h-0 flex-1">
              {pageQ.error && !workingDetail && (
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
                  />
                  <ZoomControls />
                </>
              )}
              {!pageQ.isPending && !pageQ.error && !workingDetail && (
                <EmptyState
                  title="Sayfa seçilmedi"
                  description="Soldan bir sayfa seçerek düzenlemeye başlayın."
                />
              )}
              {pageQ.isFetching && workingDetail && (
                <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-[var(--color-surface-raised)]/90 px-2 py-1 text-[length:var(--text-meta)] text-[var(--color-ink-muted)] shadow-sm ring-1 ring-[var(--color-border)]">
                  Sayfa yükleniyor…
                </div>
              )}
              {pageQ.isPending && !workingDetail && (
                <EmptyState title="Sayfa yükleniyor…" />
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
          />
        }
      />
    </>
  )
}
