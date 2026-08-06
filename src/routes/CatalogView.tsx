import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useChapters, useDeleteChapterMutation } from '@/api/queries'
import type { Chapter } from '@/api/types'
import { CatalogHeader } from '@/components/catalog/CatalogHeader'
import { ChapterGrid } from '@/components/catalog/ChapterGrid'
import { DropZone } from '@/components/upload/DropZone'
import { UploadDialog } from '@/components/upload/UploadDialog'
import { ConfirmDialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Toaster } from '@/components/ui/toaster'
import {
  applyThemeAttribute,
  useSession,
} from '@/store/session'
import { toast } from '@/store/toast'

export function CatalogView() {
  const navigate = useNavigate()
  const chapters = useChapters()
  const deleteChapter = useDeleteChapterMutation()
  const theme = useSession((s) => s.ui.theme)
  const workspaceRole = useSession((s) => s.ui.workspaceRole)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [initialFiles, setInitialFiles] = useState<File[] | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Chapter | null>(null)

  useEffect(() => {
    applyThemeAttribute(theme)
  }, [theme])

  const openUpload = (files?: File[]) => {
    setInitialFiles(files ?? null)
    setUploadOpen(true)
  }

  const openChapter = (slug: string) => {
    if (workspaceRole === 'translator') {
      navigate(`/translate/${slug}`)
    } else {
      navigate(`/edit/${slug}`)
    }
  }

  const list = chapters.data ?? []
  const loading = chapters.isLoading
  const error =
    chapters.error instanceof ApiError
      ? chapters.error.message
      : chapters.error
        ? 'Katalog yüklenemedi'
        : null

  return (
    <div className="flex h-full flex-col bg-[var(--color-canvas)]">
      <CatalogHeader onUpload={() => openUpload()} />

      <main className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {loading && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] animate-pulse rounded-md bg-[var(--color-surface-muted)]"
              />
            ))}
          </div>
        )}

        {error && (
          <p className="text-[length:var(--text-ui)] text-[var(--color-danger)]">
            {error}
          </p>
        )}

        {!loading && !error && list.length === 0 && (
          <div className="flex h-full min-h-[24rem] flex-col items-center justify-center gap-4">
            <EmptyState
              icon={<Upload className="h-8 w-8" strokeWidth={1.5} />}
              title="İlk manganızı yükleyin"
              description="Sayfa görsellerini veya bir ZIP dosyasını sürükleyin."
              className="py-2"
            />
            <DropZone
              className="w-full max-w-md"
              onFiles={(files) => openUpload(files)}
            />
          </div>
        )}

        {!loading && !error && list.length > 0 && (
          <ChapterGrid
            chapters={list}
            onOpen={openChapter}
            onDelete={(ch) => setPendingDelete(ch)}
          />
        )}
      </main>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open)
          if (!open) setInitialFiles(null)
        }}
        initialFiles={initialFiles}
      />

      <ConfirmDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Chapter'ı sil"
        description={
          pendingDelete
            ? `'${pendingDelete.title}' ve tüm sayfaları kalıcı olarak silinecek.`
            : ''
        }
        confirmLabel="Sil"
        tone="danger"
        onConfirm={() => {
          if (!pendingDelete) return
          deleteChapter.mutate(pendingDelete.slug, {
            onError: (e) => {
              toast(
                e instanceof ApiError ? e.message : 'Silinemedi',
                'danger',
              )
            },
          })
          setPendingDelete(null)
        }}
      />

      <Toaster />
    </div>
  )
}
