import { useState } from 'react'
import { ApiError, api, triggerDownload } from '@/api/client'
import type { FontInfo, PageDetail, PageSummary, SaveStatus } from '@/api/types'
import { FontSelect } from '@/components/FontSelect'
import { ViewToggle } from '@/components/ViewToggle'
import { Button } from '@/components/ui/button'
import {
  buildComposePayloadForPage,
  buildWorkingDoc,
  disabledOffList,
} from '@/lib/workingDoc'
import { pageFontFromEdit, useSession } from '@/store/session'

interface ToolbarProps {
  pageLabel?: string
  detail?: PageDetail
  pages?: PageSummary[]
  fonts: FontInfo[]
  chapterSlug: string | null
  typesetPending?: boolean
  typesetError?: string | null
  saveStatus?: SaveStatus
  saveError?: string | null
  dirty?: boolean
  /** Vision/fonts API returned 503 — disable typeset/download. */
  visionUnavailable?: boolean
  onResetPage?: () => void
  onAutoTypesetPage?: () => void
  onRetrySave?: () => void
  onConflictTakeServer?: () => void
  onConflictKeepMine?: () => void
  onOpenShortcuts?: () => void
}

export function Toolbar({
  pageLabel,
  detail,
  pages = [],
  fonts,
  chapterSlug,
  typesetPending,
  typesetError,
  saveStatus,
  saveError,
  dirty,
  visionUnavailable,
  onResetPage,
  onAutoTypesetPage,
  onRetrySave,
  onConflictTakeServer,
  onConflictKeepMine,
  onOpenShortcuts,
}: ToolbarProps) {
  const viewMode = useSession((s) => s.viewMode)
  const setViewMode = useSession((s) => s.setViewMode)
  const setPageFont = useSession((s) => s.setPageFont)
  const resetAll = useSession((s) => s.resetAll)
  const sessionPages = useSession((s) => s.pages)
  const pageId = detail?.page.id
  const fontOverride =
    pageId != null ? pageFontFromEdit(sessionPages[pageId]?.edit) : null

  const [busy, setBusy] = useState<'page' | 'chapter' | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [dlError, setDlError] = useState<string | null>(null)

  const composeBlocked = visionUnavailable === true

  const downloadPage = async () => {
    if (!detail || composeBlocked) return
    setBusy('page')
    setDlError(null)
    setProgress('Sayfa hazırlanıyor…')
    try {
      const session = sessionPages[detail.page.id]
      const doc = buildWorkingDoc(detail.doc, session)
      const blob = await api.composeBlob(
        detail.page.id,
        {
          doc,
          off: disabledOffList(session),
          font: pageFontFromEdit(session?.edit),
        },
        { download: true },
      )
      triggerDownload(blob, `${detail.page.stem}-compose.png`)
      setProgress(null)
    } catch (err) {
      setDlError(formatErr(err))
      setProgress(null)
    } finally {
      setBusy(null)
    }
  }

  const downloadChapter = async () => {
    if (!chapterSlug || !pages.length || composeBlocked) return
    setBusy('chapter')
    setDlError(null)
    setProgress(`0 / ${pages.length}`)
    try {
      const payloads = []
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i]!
        setProgress(`${i + 1} / ${pages.length} hazırlanıyor…`)
        // Always load seed + DB edit from the API. Live session overlays
        // (unsaved work + typeset cache) are merged inside the helper.
        const pageDetail = await api.page(p.id)
        const session = sessionPages[p.id]
        payloads.push(await buildComposePayloadForPage(pageDetail, session))
      }
      setProgress('Zip paketleniyor…')
      const blob = await api.downloadChapter(chapterSlug, payloads)
      triggerDownload(blob, `${chapterSlug}-compose.zip`)
      setProgress(null)
    } catch (err) {
      setDlError(formatErr(err))
      setProgress(null)
    } finally {
      setBusy(null)
    }
  }

  const saveLabel =
    saveStatus === 'saving'
      ? 'Kaydediliyor…'
      : saveStatus === 'conflict'
        ? 'Kayıt çakışması'
        : saveStatus === 'error'
          ? 'Kayıt hatası'
          : saveStatus === 'saved' && !dirty
            ? 'Kaydedildi'
            : dirty
              ? 'Kaydedilmedi'
              : null

  return (
    <header className="relative flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4">
      <div className="flex min-w-0 items-baseline gap-3">
        <span
          className="text-lg tracking-tight text-[var(--color-accent)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          FukiFlow
        </span>
        {pageLabel && (
          <span className="truncate text-sm text-[var(--color-ink-muted)]">
            {pageLabel}
          </span>
        )}
        {typesetPending && (
          <span className="text-[11px] text-[var(--color-ink-muted)]">
            Dizgi…
          </span>
        )}
        {saveLabel && (
          <span
            className={
              saveStatus === 'error' || saveStatus === 'conflict'
                ? 'text-[11px] text-[var(--color-danger)]'
                : 'text-[11px] text-[var(--color-ink-muted)]'
            }
            title={saveError ?? undefined}
          >
            {saveLabel}
          </span>
        )}
        {saveStatus === 'conflict' && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => onConflictTakeServer?.()}
              title="Sunucudaki sürümü al; yerel değişiklikler silinir"
            >
              Sunucuyu al
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-[var(--color-danger)]"
              onClick={() => onConflictKeepMine?.()}
              title="Yerel sürümü sunucuya yaz"
            >
              Benimkini yaz
            </Button>
          </>
        )}
        {saveStatus === 'error' && onRetrySave && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-[var(--color-danger)]"
            onClick={() => onRetrySave()}
          >
            Tekrar kaydet
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <FontSelect
          fonts={fonts}
          value={fontOverride}
          onChange={(key) => {
            if (pageId == null) return
            setPageFont(pageId, key)
          }}
          allowEmpty
          emptyLabel="Varsayılan font"
          title="Sayfa geneli font"
          className="w-40"
        />
        <ViewToggle value={viewMode} onChange={setViewMode} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            !detail || typesetPending || busy != null || composeBlocked
          }
          onClick={() => onAutoTypesetPage?.()}
          title={
            composeBlocked
              ? 'Dizgi servisi kapalı'
              : 'Sayfadaki tüm balonları mevcut kutu/punto ile yeniden diz'
          }
        >
          Oto dizgi
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!detail || busy != null || composeBlocked}
          onClick={() => void downloadPage()}
          title={
            composeBlocked
              ? 'Dizgi servisi kapalı; indirme yapılamıyor'
              : undefined
          }
        >
          Sayfa indir
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            !chapterSlug ||
            !pages.length ||
            busy != null ||
            composeBlocked
          }
          onClick={() => void downloadChapter()}
          title={
            composeBlocked
              ? 'Dizgi servisi kapalı; indirme yapılamıyor'
              : undefined
          }
        >
          Bölüm zip
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onOpenShortcuts?.()}
          title="Klavye kısayolları (?)"
        >
          ?
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!detail}
          onClick={() => onResetPage?.()}
          title="Bu sayfayı seed haline döndür"
        >
          Sayfa sıfırla
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => resetAll()}
          title="Tüm oturumu temizle"
        >
          Oturum sıfırla
        </Button>
      </div>

      {(progress || dlError || typesetError || saveError) && (
        <div className="absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 rounded-md bg-[var(--color-surface-raised)] px-3 py-1.5 text-xs shadow-sm ring-1 ring-[var(--color-border)]">
          {dlError || typesetError || saveError ? (
            <span className="text-[var(--color-danger)]">
              {dlError || typesetError || saveError}
            </span>
          ) : (
            <span className="text-[var(--color-ink-muted)]">{progress}</span>
          )}
        </div>
      )}
    </header>
  )
}

function formatErr(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 503) {
      return 'Dizgi servisi şu an kapalı; indirme yapılamıyor'
    }
    return err.message
  }
  return err instanceof Error ? err.message : 'İndirme başarısız'
}
