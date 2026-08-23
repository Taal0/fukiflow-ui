import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative overflow-hidden rounded-md bg-[var(--color-surface-muted)]',
        'after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--color-surface-raised)_65%,transparent)] after:to-transparent',
        'motion-safe:after:animate-[ff-shimmer_1.2s_ease-in-out_infinite]',
        className,
      )}
    />
  )
}
