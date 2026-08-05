import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded px-1.5 py-0.5 text-[length:var(--text-meta)] font-medium uppercase tracking-wide',
  {
    variants: {
      variant: {
        default: 'bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]',
        accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
        warn: 'bg-[color-mix(in_srgb,var(--color-warn)_18%,transparent)] text-[var(--color-warn)]',
        ok: 'bg-[color-mix(in_srgb,var(--color-success)_18%,transparent)] text-[var(--color-success)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}
