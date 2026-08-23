import { Skeleton } from '@/components/ui/skeleton'

export function CatalogSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4"
      aria-busy
      aria-label="Projeler yükleniyor"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]"
        >
          <Skeleton className="aspect-[2/3] w-full rounded-none" />
          <div className="flex flex-col gap-1.5 p-2.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="mt-0.5 h-1 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
