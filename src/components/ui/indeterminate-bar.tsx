import { cn } from '@/lib/utils'

/** Thin accent bar — activity without a spinner or pulse. */
export function IndeterminateBar({ className }: { className?: string }) {
  return (
    <div
      role="progressbar"
      aria-hidden
      className={cn(
        'h-0.5 overflow-hidden bg-[var(--color-border)]',
        className,
      )}
    >
      <div className="h-full w-[35%] bg-[var(--color-accent)] motion-safe:animate-[ff-indeterminate_1.1s_ease-in-out_infinite]" />
    </div>
  )
}
