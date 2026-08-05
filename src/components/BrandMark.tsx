import { cn } from '@/lib/utils'

interface BrandMarkProps {
  className?: string
  /** Compact mark for tight chrome; default is toolbar size. */
  size?: 'sm' | 'md' | 'lg'
}

const SIZE: Record<NonNullable<BrandMarkProps['size']>, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
}

/** FukiFlow wordmark — Syne, accent ink, tight tracking. */
export function BrandMark({ className, size = 'md' }: BrandMarkProps) {
  return (
    <span
      className={cn(
        'shrink-0 font-extrabold leading-none tracking-[-0.04em] text-[var(--color-accent)]',
        SIZE[size],
        className,
      )}
      style={{ fontFamily: 'var(--font-display)' }}
    >
      FukiFlow
    </span>
  )
}
