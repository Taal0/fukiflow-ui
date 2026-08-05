import {
  MousePointer2,
  Square,
  Paintbrush,
  Eraser,
} from 'lucide-react'
import type { ActiveTool } from '@/store/session'
import { useSession } from '@/store/session'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const TOOLS: {
  id: ActiveTool
  label: string
  shortcut: string
  icon: typeof MousePointer2
}[] = [
  { id: 'select', label: 'Seç', shortcut: 'V', icon: MousePointer2 },
  { id: 'frame', label: 'Kutu', shortcut: 'M', icon: Square },
  { id: 'paint', label: 'Boya', shortcut: 'B', icon: Paintbrush },
  { id: 'restore', label: 'Geri al fırçası', shortcut: 'R', icon: Eraser },
]

export function ToolRail() {
  const activeTool = useSession((s) => s.ui.activeTool)
  const setActiveTool = useSession((s) => s.setActiveTool)

  return (
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label="Canvas araçları"
        className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-[var(--color-border)] bg-[var(--color-surface-raised)] py-2"
      >
        {TOOLS.map((t) => {
          const Icon = t.icon
          const on = activeTool === t.id
          return (
            <Tooltip key={t.id} label={`${t.label} (${t.shortcut})`} side="right">
              <button
                type="button"
                aria-label={t.label}
                aria-pressed={on}
                onClick={() => setActiveTool(t.id)}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
                  on
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
