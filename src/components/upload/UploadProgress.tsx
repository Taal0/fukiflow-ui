import { Check, Loader2, X } from 'lucide-react'
import type { UploadState } from './useUpload'
import { cn } from '@/lib/utils'

interface UploadProgressProps {
  state: UploadState
}

export function UploadProgress({ state }: UploadProgressProps) {
  const { progress, pages, activeLabel } = state
  const pct =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[length:var(--text-ui)] font-medium text-[var(--color-ink)]">
            İşleniyor… {progress.current} / {progress.total || '—'} sayfa
          </p>
          <span className="text-[length:var(--text-meta)] tabular-nums text-[var(--color-ink-muted)]">
            %{pct}
          </span>
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]"
          role="progressbar"
          aria-valuenow={progress.current}
          aria-valuemin={0}
          aria-valuemax={progress.total || undefined}
        >
          <div
            className="h-full bg-[var(--color-accent)] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {pages.length > 0 && (
        <ul className="grid max-h-48 grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-1.5 overflow-y-auto">
          {pages.map((p) => (
            <li
              key={p.pageNo}
              className={cn(
                'relative aspect-square overflow-hidden rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)]',
              )}
              title={
                p.status === 'error'
                  ? p.error || `Sayfa ${p.pageNo} hata`
                  : `Sayfa ${p.pageNo}`
              }
            >
              {p.thumbUrl && p.status === 'done' ? (
                <img
                  src={p.thumbUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full items-center justify-center text-[length:var(--text-meta)] tabular-nums text-[var(--color-ink-muted)]">
                  {p.pageNo}
                </span>
              )}
              {p.status === 'processing' && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                  <Loader2
                    className="h-4 w-4 text-white motion-safe:animate-spin"
                    aria-hidden
                  />
                </span>
              )}
              {p.status === 'done' && (
                <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-success)] text-white">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
                </span>
              )}
              {p.status === 'error' && (
                <span className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-danger)_55%,transparent)]">
                  <X className="h-4 w-4 text-white" strokeWidth={2.5} aria-hidden />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {activeLabel && (
        <p className="text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
          Aktif: {activeLabel}
        </p>
      )}
    </div>
  )
}
