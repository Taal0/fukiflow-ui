import type { Chapter } from '@/api/types'
import { ChapterCard } from './ChapterCard'

interface ChapterGridProps {
  chapters: Chapter[]
  onOpen: (slug: string) => void
  onDelete?: (chapter: Chapter) => void
}

export function ChapterGrid({ chapters, onOpen, onDelete }: ChapterGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
      {chapters.map((ch) => (
        <ChapterCard
          key={ch.id}
          chapter={ch}
          onOpen={onOpen}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
