import { Skeleton } from '@/components/ui/skeleton'

export function PanelPlaceholder({
  width,
  title,
  rows = 6,
}: {
  width: number
  title: string
  rows?: number
}) {
  return (
    <aside
      style={{ width }}
      className="flex h-full shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]"
      aria-hidden
    >
      <div className="border-b border-[var(--color-border)] px-3 py-2">
        <h2 className="text-[length:var(--text-ui)] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          {title}
        </h2>
        <Skeleton className="mt-1.5 h-2.5 w-24" />
      </div>
      <div className="flex flex-col gap-1 p-1.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex h-10 items-center gap-2 rounded-md px-2">
            <Skeleton className="h-5 w-5 shrink-0 rounded" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Skeleton className="h-2.5 w-[88%]" />
              <Skeleton className="h-2 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
