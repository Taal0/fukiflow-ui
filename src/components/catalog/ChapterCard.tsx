import { MoreHorizontal, Trash2 } from 'lucide-react'
import type { Chapter } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatRelativeTr } from '@/lib/relativeTime'
import { cn } from '@/lib/utils'

interface ChapterCardProps {
  chapter: Chapter
  onOpen: (slug: string) => void
  onDelete?: (chapter: Chapter) => void
}

export function ChapterCard({ chapter, onOpen, onDelete }: ChapterCardProps) {
  const processing = (chapter.processing_count ?? 0) > 0
  const hasError = (chapter.error_count ?? 0) > 0
  const bubbleCount = chapter.bubble_count ?? 0
  const doneCount = chapter.done_count ?? 0
  const progress = bubbleCount > 0 ? doneCount / bubbleCount : 0
  const canDelete = Boolean(onDelete)
  const relative = formatRelativeTr(chapter.created_at)

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] transition-[border-color,box-shadow,background-color] duration-200 ease-out',
        'hover:bg-[var(--color-surface-raised)] focus-within:ring-2 focus-within:ring-[var(--color-focus)]',
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(chapter.slug)}
        className="flex flex-1 flex-col text-left outline-none"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-[var(--color-surface-muted)]">
          {processing ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 animate-pulse">
              <span className="text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
                İşleniyor…
              </span>
            </div>
          ) : chapter.cover_url ? (
            <img
              src={chapter.cover_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
              Kapak yok
            </div>
          )}
          {hasError && (
            <Badge
              variant="warn"
              className="absolute left-1.5 top-1.5 normal-case tracking-normal text-[var(--color-danger)]"
            >
              Hata
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-1 p-2.5">
          <h3 className="truncate text-[length:var(--text-ui)] font-semibold text-[var(--color-ink)]">
            {chapter.title}
          </h3>
          <p className="text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
            {chapter.page_count} sayfa
          </p>
          {bubbleCount > 0 && !processing && (
            <div
              className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]"
              title={`${doneCount}/${bubbleCount}`}
            >
              <div
                className="h-full bg-[var(--color-success)]"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}
          {relative && (
            <p className="text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
              {relative}
            </p>
          )}
        </div>
      </button>

      {canDelete && (
        <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 bg-[var(--color-surface-raised)]/90"
                aria-label="Chapter menüsü"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                danger
                onSelect={() => onDelete?.(chapter)}
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                Sil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </article>
  )
}
