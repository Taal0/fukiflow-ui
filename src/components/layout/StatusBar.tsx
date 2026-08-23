import type { SaveStatus } from '@/api/types'
import { cn } from '@/lib/utils'

interface StatusBarProps {
  saveStatus?: SaveStatus
  saveError?: string | null
  dirty?: boolean
  zoomPercent: number
  selectedLabel?: string | null
  typesetPending?: boolean
  /** Hide the typeset status segment (translator view). */
  hideTypeset?: boolean
  pageProgress?: string | null
  /** Replaces the selection label while a page is opening. */
  loadingMessage?: string | null
}

function saveDotClass(status: SaveStatus | undefined, dirty?: boolean) {
  if (status === 'error' || status === 'conflict') return 'bg-[var(--color-danger)]'
  if (status === 'saving') return 'bg-[var(--color-warn)] animate-pulse'
  if (status === 'saved' && !dirty) return 'bg-[var(--color-success)]'
  if (dirty) return 'bg-[var(--color-warn)]'
  return 'bg-[var(--color-ink-muted)]'
}

function saveLabel(
  status: SaveStatus | undefined,
  dirty?: boolean,
): string {
  if (status === 'saving') return 'Kaydediliyor…'
  if (status === 'conflict') return 'Kayıt çakışması'
  if (status === 'error') return 'Kayıt hatası'
  if (status === 'saved' && !dirty) return 'Kaydedildi'
  if (dirty) return 'Kaydedilmedi'
  return '—'
}

export function StatusBar({
  saveStatus,
  saveError,
  dirty,
  zoomPercent,
  selectedLabel,
  typesetPending,
  hideTypeset,
  pageProgress,
  loadingMessage,
}: StatusBarProps) {
  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
      <span
        className="flex items-center gap-1.5"
        aria-live="polite"
        title={saveError ?? undefined}
      >
        <span
          className={cn('h-1.5 w-1.5 rounded-full', saveDotClass(saveStatus, dirty))}
          aria-hidden
        />
        <span
          className={cn(
            (saveStatus === 'error' || saveStatus === 'conflict') &&
              'text-[var(--color-danger)]',
          )}
        >
          {saveLabel(saveStatus, dirty)}
        </span>
      </span>
      <span className="text-[var(--color-border)]" aria-hidden>
        |
      </span>
      <span className="tabular-nums">{zoomPercent}%</span>
      <span className="text-[var(--color-border)]" aria-hidden>
        |
      </span>
      <span className="truncate" aria-live="polite">
        {loadingMessage ?? selectedLabel ?? 'Öğe seçilmedi'}
      </span>
      {!hideTypeset && (
        <>
          <span className="text-[var(--color-border)]" aria-hidden>
            |
          </span>
          <span>{typesetPending ? 'Dizgi…' : 'Dizgi hazır'}</span>
        </>
      )}
      {pageProgress && (
        <>
          <span className="text-[var(--color-border)]" aria-hidden>
            |
          </span>
          <span className="ml-auto tabular-nums">{pageProgress}</span>
        </>
      )}
    </footer>
  )
}
