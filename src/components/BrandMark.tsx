import { cn } from '@/lib/utils'

interface BrandMarkProps {
  className?: string
  /** Compact mark for tight chrome; default is toolbar size. */
  size?: 'sm' | 'md' | 'lg'
}

const WORD: Record<NonNullable<BrandMarkProps['size']>, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
}

const FUKI: Record<NonNullable<BrandMarkProps['size']>, string> = {
  sm: 'text-[length:var(--text-meta)]',
  md: 'text-[length:var(--text-ui)]',
  lg: 'text-[length:var(--text-title)]',
}

/** FukiFlow wordmark — M PLUS 1 + 吹き whisper. */
export function BrandMark({ className, size = 'md' }: BrandMarkProps) {
  return (
    <span
      role="img"
      aria-label="FukiFlow"
      className={cn('inline-flex shrink-0 items-baseline gap-1.5 leading-none', className)}
    >
      <span
        className={cn(
          'font-extrabold tracking-[-0.02em] text-[var(--color-accent)]',
          WORD[size],
        )}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        FukiFlow
      </span>
      <span
        aria-hidden
        className={cn(
          'font-semibold tracking-[0.04em] text-[var(--color-ink-muted)]',
          FUKI[size],
        )}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        吹き
      </span>
    </span>
  )
}
