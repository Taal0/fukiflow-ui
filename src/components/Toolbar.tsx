import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MoreHorizontal,
  Undo2,
  Redo2,
  PanelLeft,
  Download,
  FileImage,
  FileArchive,
  RotateCcw,
  Trash2,
  Keyboard,
  CircleHelp,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
  Type,
} from 'lucide-react'
import { ApiError, api, triggerDownload } from '@/api/client'
import type { FontInfo, PageDetail, PageSummary } from '@/api/types'
import { BrandMark } from '@/components/BrandMark'
import { FontSelect } from '@/components/FontSelect'
import { RoleSwitch } from '@/components/RoleSwitch'
import { ViewToggle } from '@/components/ViewToggle'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Segmented } from '@/components/ui/segmented'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  buildComposePayloadForPage,
  buildWorkingDoc,
  disabledOffList,
} from '@/lib/workingDoc'
import {
  pageFontFromEdit,
  useSession,
} from '@/store/session'
import { toast, dismissToast, updateToast } from '@/store/toast'

interface ToolbarProps {
  pageLabel?: string
  detail?: PageDetail
  pages?: PageSummary[]
  fonts: FontInfo[]
  chapterSlug: string | null
  typesetPending?: boolean
  visionUnavailable?: boolean
  canUndo?: boolean
  canRedo?: boolean
  onResetPage?: () => void
  onAutoTypesetPage?: () => void
  onRetrySave?: () => void
  onOpenShortcuts?: () => void
  onOpenGuide?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onToggleGallery?: () => void
  showGalleryToggle?: boolean
}

export function Toolbar({
  pageLabel,
  detail,
  pages = [],
  fonts,
  chapterSlug,
  typesetPending,
  visionUnavailable,
  canUndo,
  canRedo,
  onResetPage,
  onAutoTypesetPage,
  onRetrySave,
  onOpenShortcuts,
  onOpenGuide,
  onUndo,
  onRedo,
  onToggleGallery,
  showGalleryToggle,
}: ToolbarProps) {
  const viewMode = useSession((s) => s.viewMode)
  const setViewMode = useSession((s) => s.setViewMode)
  const setPageFont = useSession((s) => s.setPageFont)
  const resetAll = useSession((s) => s.resetAll)
  const theme = useSession((s) => s.ui.theme)
  const setTheme = useSession((s) => s.setTheme)
  const sessionPages = useSession((s) => s.pages)
  const pageId = detail?.page.id
  const fontOverride =
    pageId != null ? pageFontFromEdit(sessionPages[pageId]?.edit) : null

  const [busy, setBusy] = useState<'page' | 'chapter' | null>(null)
  const [confirmPage, setConfirmPage] = useState(false)
  const [confirmSession, setConfirmSession] = useState(false)
  const [sessionTyped, setSessionTyped] = useState('')

  const composeBlocked = visionUnavailable === true

  const downloadPage = async () => {
    if (!detail || composeBlocked) return
    setBusy('page')
    const tid = toast('Sayfa hazırlanıyor…', 'info', 0)
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
      dismissToast(tid)
      toast('Sayfa indirildi', 'success')
    } catch (err) {
      dismissToast(tid)
      toast(formatErr(err), 'danger', 6000)
    } finally {
      setBusy(null)
    }
  }

  const downloadChapter = async () => {
    if (!chapterSlug || !pages.length || composeBlocked) return
    setBusy('chapter')
    const tid = toast(`0 / ${pages.length}`, 'info', 0)
    try {
      const payloads = []
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i]!
        updateToast(tid, `${i + 1} / ${pages.length} hazırlanıyor…`)
        const pageDetail = await api.page(p.id)
        const session = sessionPages[p.id]
        payloads.push(await buildComposePayloadForPage(pageDetail, session))
      }
      updateToast(tid, 'Zip paketleniyor…')
      const blob = await api.downloadChapter(chapterSlug, payloads)
      triggerDownload(blob, `${chapterSlug}-compose.zip`)
      dismissToast(tid)
      toast('Bölüm zip indirildi', 'success')
    } catch (err) {
      dismissToast(tid)
      toast(formatErr(err), 'danger', 6000)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <header className="relative flex h-12 shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {showGalleryToggle && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Sayfa galerisi"
              onClick={onToggleGallery}
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
          <RoleSwitch value="letterer" chapterSlug={chapterSlug} />
          {pageLabel && (
            <>
              <div className="mx-1 hidden h-5 w-px bg-[var(--color-border)] sm:block" />
              <span
                className="hidden min-w-0 truncate text-[length:var(--text-meta)] text-[var(--color-ink-muted)] sm:inline"
                title={pageLabel}
              >
                {pageLabel}
              </span>
            </>
          )}
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
            className="ml-1 hidden w-36 lg:inline-flex"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!canUndo}
            onClick={onUndo}
            title="Geri al (⌘Z)"
            aria-label="Geri al"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!canRedo}
            onClick={onRedo}
            title="İleri al (⌘⇧Z)"
            aria-label="İleri al"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <ViewToggle value={viewMode} onChange={setViewMode} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!detail || typesetPending || busy != null || composeBlocked}
            onClick={() => onAutoTypesetPage?.()}
            title={
              composeBlocked
                ? 'Dizgi servisi kapalı'
                : 'Sayfadaki tüm balonları yeniden diz'
            }
            className="gap-1.5"
          >
            <Type className="h-3.5 w-3.5" aria-hidden />
            Oto dizgi
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                disabled={busy != null || composeBlocked || !detail}
                title={
                  composeBlocked
                    ? 'Dizgi servisi kapalı; indirme yapılamıyor'
                    : undefined
                }
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                İndir
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!detail || busy != null}
                onSelect={() => void downloadPage()}
              >
                <FileImage className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                Sayfa PNG
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!chapterSlug || !pages.length || busy != null}
                onSelect={() => void downloadChapter()}
              >
                <FileArchive className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                Bölüm ZIP
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Diğer"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuItem
                disabled={!detail}
                onSelect={() => setConfirmPage(true)}
              >
                <RotateCcw className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                Sayfa sıfırla
              </DropdownMenuItem>
              <DropdownMenuItem
                danger
                onSelect={() => {
                  setSessionTyped('')
                  setConfirmSession(true)
                }}
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                Oturum sıfırla
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onOpenShortcuts?.()}>
                <Keyboard className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                Kısayollar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onOpenGuide?.()}>
                <CircleHelp className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                Nasıl çalışır
              </DropdownMenuItem>
              {onRetrySave && (
                <DropdownMenuItem onSelect={() => onRetrySave()}>
                  <RefreshCw className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  Tekrar kaydet
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-1.5">
                Tema
              </DropdownMenuLabel>
              <div
                className="px-2 pb-1.5"
                onPointerDown={(e) => e.preventDefault()}
              >
                <Segmented
                  ariaLabel="Tema"
                  value={theme}
                  onChange={setTheme}
                  size="md"
                  fill
                  options={[
                    {
                      value: 'light' as const,
                      title: 'Açık',
                      ariaLabel: 'Açık',
                      label: (
                        <Sun className="mx-auto h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                      ),
                    },
                    {
                      value: 'dark' as const,
                      title: 'Koyu',
                      ariaLabel: 'Koyu',
                      label: (
                        <Moon className="mx-auto h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                      ),
                    },
                    {
                      value: 'system' as const,
                      title: 'Sistem',
                      ariaLabel: 'Sistem',
                      label: (
                        <Monitor className="mx-auto h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                      ),
                    },
                  ]}
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <ConfirmDialog
        open={confirmPage}
        onOpenChange={setConfirmPage}
        title="Sayfayı sıfırla?"
        description="Bu sayfadaki yerel düzenlemeler silinir ve seed haline döner. Geri alınabilir."
        confirmLabel="Sayfayı sıfırla"
        onConfirm={() => onResetPage?.()}
      />
      <ConfirmDialog
        open={confirmSession}
        onOpenChange={setConfirmSession}
        title="Oturumu sıfırla?"
        description="Tüm sayfalardaki yerel düzenlemeler silinir. Bu işlem geri alınamaz."
        confirmLabel="Oturumu sıfırla"
        tone="danger"
        confirmText="SIFIRLA"
        typedValue={sessionTyped}
        onTypedValueChange={setSessionTyped}
        onConfirm={() => resetAll()}
      />
    </>
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
