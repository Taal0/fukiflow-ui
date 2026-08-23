import { EmptyState } from '@/components/ui/empty-state'
import { IndeterminateBar } from '@/components/ui/indeterminate-bar'

export function PageStatusPlaceholder({
  status,
  errorMessage,
  onRetry,
  retrying,
}: {
  status: string
  errorMessage?: string | null
  onRetry?: () => void
  retrying?: boolean
}) {
  if (status === 'error') {
    return (
      <EmptyState
        title="Sayfa işlenemedi"
        description={
          errorMessage || 'Sayfa işlenirken bir hata oluştu.'
        }
        actionLabel={onRetry ? 'Tekrar dene' : undefined}
        onAction={onRetry}
        actionDisabled={retrying}
      />
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-8 text-center">
      <div className="w-48">
        <IndeterminateBar />
      </div>
      <p className="text-[length:var(--text-ui)] text-[var(--color-ink-muted)]">
        Sayfa işleniyor…
      </p>
    </div>
  )
}
