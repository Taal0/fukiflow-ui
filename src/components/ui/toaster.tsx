import { useEffect } from 'react'
import { useToast } from '@/store/toast'
import { cn } from '@/lib/utils'

export function Toaster() {
  const toasts = useToast((s) => s.toasts)
  const dismiss = useToast((s) => s.dismiss)

  return (
    <div
      className="pointer-events-none fixed bottom-10 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastCard
          key={t.id}
          id={t.id}
          message={t.message}
          tone={t.tone}
          duration={t.duration}
          onDismiss={dismiss}
        />
      ))}
    </div>
  )
}

function ToastCard({
  id,
  message,
  tone,
  duration = 4000,
  onDismiss,
}: {
  id: string
  message: string
  tone: string
  duration?: number
  onDismiss: (id: string) => void
}) {
  useEffect(() => {
    if (duration <= 0) return
    const t = window.setTimeout(() => onDismiss(id), duration)
    return () => window.clearTimeout(t)
  }, [id, duration, onDismiss])

  return (
    <div
      className={cn(
        'pointer-events-auto rounded-md px-3 py-2 text-[length:var(--text-ui)] shadow-md ring-1 ring-[var(--color-border)]',
        tone === 'danger'
          ? 'bg-[var(--color-surface-raised)] text-[var(--color-danger)]'
          : tone === 'warn'
            ? 'bg-[var(--color-surface-raised)] text-[var(--color-warn)]'
            : tone === 'success'
              ? 'bg-[var(--color-surface-raised)] text-[var(--color-success)]'
              : 'bg-[var(--color-surface-raised)] text-[var(--color-ink)]',
      )}
      role="status"
    >
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1">{message}</span>
        <button
          type="button"
          className="shrink-0 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          onClick={() => onDismiss(id)}
          aria-label="Kapat"
        >
          ×
        </button>
      </div>
    </div>
  )
}
