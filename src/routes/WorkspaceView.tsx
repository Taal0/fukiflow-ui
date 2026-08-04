import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '@/api/client'
import {
  useChapterPages,
  useChapters,
  useDeletePageEditMutation,
  useFonts,
  usePage,
} from '@/api/queries'
import { PageCanvas } from '@/canvas/PageCanvas'
import { BubbleList } from '@/components/BubbleList'
import { MobileWarning } from '@/components/MobileWarning'
import { OnboardingGuide } from '@/components/OnboardingGuide'
import { PageGallery } from '@/components/PageGallery'
import { Toolbar } from '@/components/Toolbar'
import { useAutosave } from '@/hooks/useAutosave'
import { useDebouncedTypeset } from '@/hooks/useDebouncedTypeset'
import { useWorkspaceKeys } from '@/hooks/useWorkspaceKeys'
import { buildWorkingDoc } from '@/lib/workingDoc'
import {
  bubbleFontsFromEdit,
  disabledLayerIdsFromEdit,
  doneCountFromEdit,
  sizeOverridesFromEdit,
  textOverridesFromEdit,
  useSession,
} from '@/store/session'

export function WorkspaceView() {
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
  const setSizeOverride = useSession((s) => s.setSizeOverride)
  const setBubbleDone = useSession((s) => s.setBubbleDone)
  const hydrateEdit = useSession((s) => s.hydrateEdit)
  const resetPageLocal = useSession((s) => s.resetPageLocal)
  const pageSession = useSession((s) =>
    selectedPageId != null ? s.pages[selectedPageId] : undefined,
  )
  const deleteEdit = useDeletePageEditMutation()
  const [hideDone, setHideDone] = useState(false)

  // Auto-select first chapter + first page.
  useEffect(() => {
    if (chapterSlug || !chapters.data?.length) return
    setChapterSlug(chapters.data[0]!.slug)
  }, [chapters.data, chapterSlug, setChapterSlug])

  const pagesQ = useChapterPages(chapterSlug ?? undefined)
  const fontsQ = useFonts()
  const pageQ = usePage(selectedPageId)

  useEffect(() => {
    if (selectedPageId != null || !pagesQ.data?.length) return
    selectPage(pagesQ.data[0]!.id)
  }, [pagesQ.data, selectedPageId, selectPage])

  // Hydrate overlay from page payload (single request).
  useEffect(() => {
    if (!pageQ.data || selectedPageId == null) return
    if (pageQ.data.page.id !== selectedPageId) return
    hydrateEdit(
      selectedPageId,
      pageQ.data.edit,
      pageQ.data.edit_rev ?? pageQ.data.edit?.rev ?? 0,
    )
  }, [pageQ.data, selectedPageId, hydrateEdit])

  useAutosave()

  const { pending: typesetPending, error: typesetError } = useDebouncedTypeset(
    pageQ.data,
  )

  const workingDetail = useMemo(() => {
    if (!pageQ.data) return undefined
    const doc = buildWorkingDoc(pageQ.data.doc, pageSession)
    return { ...pageQ.data, doc }
  }, [pageQ.data, pageSession])

  useWorkspaceKeys({
    pages: pagesQ.data ?? [],
    doc: workingDetail?.doc,
    pageId: selectedPageId,
  })

  const chapterTitle =
    chapters.data?.find((c) => c.slug === chapterSlug)?.title ?? chapterSlug
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
  const sizeOverrides = sizeOverridesFromEdit(edit)
  const disabledLayerIds = disabledLayerIdsFromEdit(edit)

  const resetPage = async () => {
    if (selectedPageId == null) return
    try {
      await deleteEdit.mutateAsync(selectedPageId)
      resetPageLocal(selectedPageId)
    } catch (err) {
      // Local reset still useful if server delete fails on missing row.
      if (err instanceof ApiError && err.status === 404) {
        resetPageLocal(selectedPageId)
        return
      }
      console.error(err)
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <MobileWarning />
      <OnboardingGuide />
      <Toolbar
        pageLabel={pageLabel}
        detail={workingDetail}
        pages={pagesQ.data}
        fonts={fontsQ.data ?? []}
        chapterSlug={chapterSlug}
        typesetPending={typesetPending}
        typesetError={typesetError}
        saveStatus={pageSession?.saveStatus}
        saveError={pageSession?.saveError}
        dirty={pageSession?.dirty}
        onResetPage={() => void resetPage()}
      />

      {(fontsUnavailable || catalogError) && (
        <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-accent-soft)] px-4 py-2 text-xs text-[var(--color-ink)]">
          {catalogError && <span>{catalogError}. </span>}
          {fontsUnavailable && (
            <span>
              Dizgi servisi şu an kapalı — görüntüleme çalışmaya devam ediyor;
              düzenleme ve indirme için servisi başlatın.
            </span>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <PageGallery
          pages={pagesWithProgress}
          selectedPageId={selectedPageId}
          onSelect={selectPage}
          loading={pagesQ.isLoading || chapters.isLoading}
          error={catalogError}
        />

        <main className="relative min-w-0 flex-1">
          {pageQ.error && !workingDetail && (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[var(--color-danger)]">
              {pageQ.error instanceof ApiError
                ? pageQ.error.message
                : 'Sayfa açılamadı'}
            </div>
          )}
          {workingDetail && (
            <PageCanvas
              detail={workingDetail}
              fonts={fontsQ.data ?? []}
            />
          )}
          {!pageQ.isPending && !pageQ.error && !workingDetail && (
            <div className="flex h-full items-center justify-center text-sm text-[var(--color-ink-muted)]">
              Soldan bir sayfa seçin
            </div>
          )}
          {pageQ.isFetching && workingDetail && (
            <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-[var(--color-surface-raised)]/90 px-2 py-1 text-[11px] text-[var(--color-ink-muted)] shadow-sm ring-1 ring-[var(--color-border)]">
              Sayfa yükleniyor…
            </div>
          )}
          {pageQ.isPending && !workingDetail && (
            <div className="flex h-full items-center justify-center text-sm text-[var(--color-ink-muted)]">
              Sayfa yükleniyor…
            </div>
          )}
        </main>

        {workingDetail ? (
          <BubbleList
            doc={workingDetail.doc}
            selectedBubbleId={pageSession?.selectedBubbleId ?? null}
            disabledLayerIds={disabledLayerIds}
            layoutsByBubble={pageSession?.layoutsByBubble ?? {}}
            textOverrides={textOverrides}
            bubbleFontOverrides={bubbleFontOverrides}
            sizeOverrides={sizeOverrides}
            bubbleEdits={edit?.bubbles ?? {}}
            fonts={fontsQ.data ?? []}
            typesetPending={typesetPending}
            hideDone={hideDone}
            onHideDoneChange={setHideDone}
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
            onSizeChange={(bubbleId, scale) => {
              if (selectedPageId == null) return
              setSizeOverride(selectedPageId, bubbleId, scale)
            }}
            onToggleDone={(bubbleId, done) => {
              if (selectedPageId == null) return
              setBubbleDone(selectedPageId, bubbleId, done)
            }}
          />
        ) : (
          <aside className="w-[22rem] shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)]" />
        )}
      </div>
    </div>
  )
}
