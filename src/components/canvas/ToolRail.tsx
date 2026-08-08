import { useEffect, useState } from 'react'
import {
  MousePointer2,
  Square,
  Paintbrush,
  Eraser,
  SquareDashed,
  MessageSquare,
  Zap,
  TextCursorInput,
} from 'lucide-react'
import type { RegionKind } from '@/api/types'
import type { ActiveTool } from '@/store/session'
import { useSession } from '@/store/session'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const REGION_KINDS: {
  id: RegionKind
  label: string
  hint: string
  icon: typeof MessageSquare
}[] = [
  {
    id: 'bubble',
    label: 'Bubble',
    hint: 'Konuşma balonu — YOLO doğrulama',
    icon: MessageSquare,
  },
  {
    id: 'sfx',
    label: 'SFX',
    hint: 'Ses efekti — doğrulama yok',
    icon: Zap,
  },
  {
    id: 'other',
    label: 'Other',
    hint: 'Diğer metin — doğrulama yok',
    icon: TextCursorInput,
  },
]

const ALL_TOOLS: {
  id: ActiveTool
  label: string
  shortcut: string
  icon: typeof MousePointer2
}[] = [
  { id: 'select', label: 'Seç', shortcut: 'V', icon: MousePointer2 },
  { id: 'frame', label: 'Kutu', shortcut: 'M', icon: Square },
  { id: 'paint', label: 'Boya', shortcut: 'B', icon: Paintbrush },
  { id: 'restore', label: 'Geri al fırçası', shortcut: 'E', icon: Eraser },
  { id: 'region', label: 'Metin kutusu', shortcut: 'R', icon: SquareDashed },
]

interface ToolRailProps {
  /** Subset of tools to show (default: letterer set). */
  tools?: ActiveTool[]
}

const LETTERER_TOOLS: ActiveTool[] = ['select', 'frame', 'paint', 'restore']

/** Activate region tool and open the kind picker (no kind until user picks). */
export function requestRegionKindPick() {
  useSession.getState().setActiveTool('region')
  useSession.getState().setRegionKind(null)
}

export function ToolRail({ tools = LETTERER_TOOLS }: ToolRailProps) {
  const activeTool = useSession((s) => s.ui.activeTool)
  const regionKind = useSession((s) => s.ui.regionKind)
  const setActiveTool = useSession((s) => s.setActiveTool)
  const setRegionKind = useSession((s) => s.setRegionKind)
  const [regionMenuOpen, setRegionMenuOpen] = useState(false)
  const visible = ALL_TOOLS.filter((t) => tools.includes(t.id))

  // R / empty-state: region tool armed without a kind → open picker.
  useEffect(() => {
    if (activeTool === 'region' && regionKind == null) {
      setRegionMenuOpen(true)
    }
  }, [activeTool, regionKind])

  const regionKindMeta = REGION_KINDS.find((k) => k.id === regionKind)
  const RegionIcon = regionKindMeta?.icon ?? SquareDashed

  return (
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label="Canvas araçları"
        className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-[var(--color-border)] bg-[var(--color-surface-raised)] py-2"
      >
        {visible.map((t) => {
          if (t.id === 'region') {
            const on = activeTool === 'region' && regionKind != null
            return (
              <DropdownMenu
                key={t.id}
                open={regionMenuOpen}
                onOpenChange={(open) => {
                  setRegionMenuOpen(open)
                  if (!open && useSession.getState().ui.regionKind == null) {
                    setActiveTool('select')
                  }
                }}
              >
                <Tooltip
                  label={
                    regionKindMeta
                      ? `${regionKindMeta.label} çiz (${t.shortcut})`
                      : `${t.label} (${t.shortcut})`
                  }
                  side="right"
                >
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={t.label}
                      aria-pressed={on}
                      aria-haspopup="menu"
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
                        on
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]',
                      )}
                    >
                      <RegionIcon className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </DropdownMenuTrigger>
                </Tooltip>
                <DropdownMenuContent side="right" align="start" className="min-w-[12rem]">
                  {REGION_KINDS.map((k) => {
                    const Icon = k.icon
                    const selected =
                      regionKind === k.id && activeTool === 'region'
                    return (
                      <DropdownMenuItem
                        key={k.id}
                        onSelect={() => {
                          setRegionKind(k.id)
                          setRegionMenuOpen(false)
                        }}
                        className={cn(
                          'items-start gap-2',
                          selected && 'bg-[var(--color-accent-soft)]',
                        )}
                      >
                        <Icon
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70"
                          aria-hidden
                        />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span>{k.label}</span>
                          <span className="text-[length:var(--text-meta)] font-normal text-[var(--color-ink-muted)]">
                            {k.hint}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }

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
