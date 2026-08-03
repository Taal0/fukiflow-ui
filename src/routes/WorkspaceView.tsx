import { useEffect, useMemo } from 'react'
import { ApiError } from '@/api/client'
import { useChapterPages, useChapters, useFonts, usePage } from '@/api/queries'
import { PageCanvas } from '@/canvas/PageCanvas'
import { BubbleList } from '@/components/BubbleList'
import { MobileWarning } from '@/components/MobileWarning'
import { OnboardingGuide } from '@/components/OnboardingGuide'
import { PageGallery } from '@/components/PageGallery'
import { Toolbar } from '@/components/Toolbar'
import { useDebouncedTypeset } from '@/hooks/useDebouncedTypeset'
import { useWorkspaceKeys } from '@/hooks/useWorkspaceKeys'
import { buildWorkingDoc } from '@/lib/workingDoc'
import { useSession } from '@/store/session'

export function WorkspaceView() {
  const chapters = useChapters()
  const chapterSlug = useSession((s) => s.chapterSlug)
  const setChapterSlug = useSession((s) => s.setChapterSlug)
  const selectedPageId = useSession((s) => s.selectedPageId)
  const selectPage = useSession((s) => s.selectPage)
  const selectBubble = useSession((s) => s.selectBubble)
  const setLayerEnabled = useSession((s) => s.setLayerEnabled)
  const setTextOverride = useSession((s) => s.setTextOverride)
  const clearTextOverride = useSession((s) => s.clearTextOverride)
  const setBubbleFont = useSession((s) => s.setBubbleFont)
  const setSizeOverride = useSession((s) => s.setSizeOverride)
  const pageSession = useSession((s) =>
    selectedPageId != null ? s.pages[selectedPageId] : undefined,
  )

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
          pages={pagesQ.data ?? []}
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
            disabledLayerIds={pageSession?.disabledLayerIds ?? new Set()}
            layoutsByBubble={pageSession?.layoutsByBubble ?? {}}
            textOverrides={pageSession?.textOverrides ?? {}}
            bubbleFontOverrides={pageSession?.bubbleFontOverrides ?? {}}
            sizeOverrides={pageSession?.sizeOverrides ?? {}}
            fonts={fontsQ.data ?? []}
            typesetPending={typesetPending}
            onSelect={selectBubble}
            onToggleLayer={(layerId, enabled) => {
              if (selectedPageId == null) return
              setLayerEnabled(selectedPageId, layerId, enabled)
            }}
            onTextChange={(bubbleId, text) => {
              if (selectedPageId == null) return
              setTextOverride(selectedPageId, bubbleId, text)
            }}
            onResetText={(bubbleId) => {
              if (selectedPageId == null) return
              clearTextOverride(selectedPageId, bubbleId)
            }}
            onBubbleFont={(bubbleId, fontKey) => {
              if (selectedPageId == null) return
              setBubbleFont(selectedPageId, bubbleId, fontKey)
            }}
            onSizeChange={(bubbleId, scale) => {
              if (selectedPageId == null) return
              setSizeOverride(selectedPageId, bubbleId, scale)
            }}
          />
        ) : (
          <aside className="w-[22rem] shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)]" />
        )}
      </div>
    </div>
  )
}
