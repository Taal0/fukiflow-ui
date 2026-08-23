import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  actionDisabled?: boolean
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionDisabled,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col items-center justify-center gap-2 px-6 py-8 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-1 text-[var(--color-ink-muted)]" aria-hidden>
          {icon}
        </div>
      )}
      <h3 className="text-[length:var(--text-title)] font-semibold text-[var(--color-ink)]">
        {title}
      </h3>
      {description && (
        <p className="max-w-xs text-[length:var(--text-ui)] text-[var(--color-ink-muted)]">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button
          type="button"
          size="sm"
          className="mt-2"
          onClick={onAction}
          disabled={actionDisabled}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
