import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DropZone } from './DropZone'
import { UploadProgress } from './UploadProgress'
import { useUpload } from './useUpload'
import { FIRST_RUN_STEPS } from '@/components/OnboardingGuide'
import {
  isFirstRunPending,
  useSession,
} from '@/store/session'

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const MAX_TOTAL_BYTES = 150 * 1024 * 1024

function isZip(file: File): boolean {
  const n = file.name.toLowerCase()
  return (
    n.endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed'
  )
}

function isImage(file: File): boolean {
  const n = file.name.toLowerCase()
  const ext = n.slice(n.lastIndexOf('.'))
  return IMAGE_EXTS.has(ext) || file.type.startsWith('image/')
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional preselected files (e.g. from empty-state drop). */
  initialFiles?: File[] | null
}

export function UploadDialog({
  open,
  onOpenChange,
  initialFiles,
}: UploadDialogProps) {
  const navigate = useNavigate()
  const workspaceRole = useSession((s) => s.ui.workspaceRole)
  const uploadTipPending = useSession((s) =>
    isFirstRunPending(s.firstRunDone, 2),
  )
  const dismissFirstRunStep = useSession((s) => s.dismissFirstRunStep)
  const { state, start, cancel, reset } = useUpload()
  const [files, setFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)

  useEffect(() => {
    if (state.status === 'complete') dismissFirstRunStep(2)
  }, [state.status, dismissFirstRunStep])

  const busy =
    state.status === 'uploading' || state.status === 'processing'

  useEffect(() => {
    if (!open) return
    if (initialFiles?.length) {
      applyFiles(initialFiles)
    }
  }, [open, initialFiles])

  const applyFiles = (next: File[]) => {
    setValidationError(null)
    if (!next.length) {
      setFiles([])
      return
    }
    const zipOnly = next.length === 1 && isZip(next[0]!)
    if (zipOnly) {
      setFiles(next)
      if (!title.trim()) {
        const stem = next[0]!.name.replace(/\.zip$/i, '')
        setTitle(stem)
      }
      return
    }
    const images = next.filter(isImage)
    if (!images.length) {
      setValidationError('En az bir görsel dosyası (PNG, JPG, WebP) seçin')
      return
    }
    const total = images.reduce((s, f) => s + f.size, 0)
    if (total > MAX_TOTAL_BYTES) {
      setValidationError(`Toplam boyut 150 MB sınırını aşıyor (${formatBytes(total)})`)
      return
    }
    setFiles(images)
    if (!title.trim() && images[0]) {
      // Folder-ish name from first file parent isn't available; leave blank.
    }
  }

  const summary = useMemo(() => {
    if (!files.length) return null
    if (files.length === 1 && isZip(files[0]!)) {
      return `1 ZIP dosyası (${formatBytes(files[0]!.size)})`
    }
    const total = files.reduce((s, f) => s + f.size, 0)
    return `${files.length} dosya (${formatBytes(total)})`
  }, [files])

  const requestClose = (next: boolean) => {
    if (!next && busy) {
      setConfirmClose(true)
      return
    }
    if (!next) {
      reset()
      setFiles([])
      setTitle('')
      setValidationError(null)
    }
    onOpenChange(next)
  }

  const goToEditor = () => {
    const slug = state.result?.slug
    if (!slug) return
    dismissFirstRunStep(2)
    onOpenChange(false)
    reset()
    setFiles([])
    setTitle('')
    if (workspaceRole === 'translator') {
      navigate(`/translate/${slug}`)
    } else {
      navigate(`/edit/${slug}`)
    }
  }

  const stage =
    state.status === 'complete'
      ? 'done'
      : state.status === 'error' && !files.length
        ? 'select'
        : busy || state.status === 'error'
          ? 'progress'
          : 'select'

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent
          className="sm:max-w-lg"
          onEscapeKeyDown={(e) => {
            if (busy) {
              e.preventDefault()
              setConfirmClose(true)
            }
          }}
          onPointerDownOutside={(e) => {
            if (busy) {
              e.preventDefault()
              setConfirmClose(true)
            }
          }}
        >
          <DialogTitle>Manga Yükle</DialogTitle>
          <DialogDescription className="sr-only">
            Manga sayfalarını veya ZIP dosyasını yükleyin
          </DialogDescription>

          {stage === 'select' && (
            <div className="mt-4 flex flex-col gap-4">
              {uploadTipPending && (
                <p className="text-[length:var(--text-ui)] text-[var(--color-ink-muted)]">
                  {FIRST_RUN_STEPS[2].tip}
                </p>
              )}
              <DropZone
                onFiles={applyFiles}
                autoFocus
                disabled={busy}
              />
              <div>
                <label
                  htmlFor="upload-title"
                  className="mb-1 block text-[length:var(--text-meta)] text-[var(--color-ink-muted)]"
                >
                  Başlık
                </label>
                <input
                  id="upload-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Chapter başlığı (opsiyonel)"
                  className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[length:var(--text-ui)] text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
                />
              </div>
              {summary && (
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
                  <p>
                    Seçili: <span className="text-[var(--color-ink)]">{summary}</span>
                  </p>
                  <p className="mt-0.5">Sıralama: dosya adına göre</p>
                </div>
              )}
              {(validationError || state.error) && (
                <p className="text-[length:var(--text-ui)] text-[var(--color-danger)]">
                  {validationError || state.error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => requestClose(false)}
                >
                  İptal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!files.length || busy}
                  onClick={() => void start(files, title || undefined)}
                >
                  Yükle →
                </Button>
              </div>
            </div>
          )}

          {stage === 'progress' && (
            <div className="mt-4 flex flex-col gap-4">
              <UploadProgress state={state} />
              {state.status === 'error' && state.error && (
                <p className="text-[length:var(--text-ui)] text-[var(--color-danger)]">
                  {state.error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (busy) setConfirmClose(true)
                    else requestClose(false)
                  }}
                >
                  {busy ? 'İptal' : 'Kapat'}
                </Button>
              </div>
            </div>
          )}

          {stage === 'done' && state.result && (
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-success)] text-white">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
                <div>
                  <p className="text-[length:var(--text-ui)] font-semibold text-[var(--color-ink)]">
                    Yükleme tamamlandı
                  </p>
                  <p className="mt-1 text-[length:var(--text-title)] font-medium text-[var(--color-ink)]">
                    {state.result.title}
                  </p>
                  <p className="mt-1 text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
                    {state.result.pages} sayfa işlendi
                    {state.result.errors.length
                      ? `, ${state.result.errors.length} hata`
                      : ', 0 hata'}
                  </p>
                  {state.result.errors.length > 0 && (
                    <ul className="mt-2 max-h-24 overflow-y-auto text-[length:var(--text-meta)] text-[var(--color-danger)]">
                      {state.result.errors.map((err, i) => (
                        <li key={i}>
                          {err.stem || `Sayfa ${err.page_no}`}: {err.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => requestClose(false)}
                >
                  Kapat
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={goToEditor}
                  autoFocus
                >
                  Editöre Git →
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Yüklemeyi iptal et?"
        description="İptal etmek istediğinize emin misiniz? İşlenmiş sayfalar kalır; geri dönüş yok."
        confirmLabel="İptal et"
        tone="danger"
        onConfirm={() => {
          cancel()
          reset()
          setFiles([])
          setTitle('')
          setValidationError(null)
          onOpenChange(false)
        }}
      />
    </>
  )
}
