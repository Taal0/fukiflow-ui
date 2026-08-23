import { IndeterminateBar } from '@/components/ui/indeterminate-bar'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function CanvasPlaceholder({
  previewUrl,
  aspect = 2 / 3,
  showBar = true,
  className,
}: {
  previewUrl?: string | null
  aspect?: number
  showBar?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-canvas-bg)]',
        className,
      )}
    >
      {showBar && (
        <IndeterminateBar className="absolute inset-x-0 top-0 z-10" />
      )}
      <div
        className="relative max-h-[88%] max-w-[min(92%,28rem)] overflow-hidden rounded-sm bg-[var(--color-surface-muted)] shadow-sm ring-1 ring-[var(--color-border)]"
        style={{ aspectRatio: String(aspect), width: '100%' }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="h-full w-full object-contain opacity-80"
          />
        ) : (
          <Skeleton className="h-full w-full rounded-none" />
        )}
      </div>
    </div>
  )
}
