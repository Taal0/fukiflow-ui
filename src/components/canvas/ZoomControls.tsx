import { Button } from '@/components/ui/button'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'
import { useSession } from '@/store/session'

export function ZoomControls() {
  const zoomPercent = useSession((s) => s.ui.zoomPercent)
  const requestZoom = useSession((s) => s.requestZoom)

  return (
    <TooltipProvider delayDuration={300}>
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-md bg-[var(--color-surface-raised)]/95 p-1 shadow-sm ring-1 ring-[var(--color-border)]">
        <Tooltip label="Sığdır" side="top">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[length:var(--text-meta)]"
            onClick={() => requestZoom('fit')}
          >
            Sığdır
          </Button>
        </Tooltip>
        <Tooltip label="%100" side="top">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[length:var(--text-meta)]"
            onClick={() => requestZoom('100')}
          >
            %100
          </Button>
        </Tooltip>
        <span className="min-w-[3rem] px-1 text-center text-[length:var(--text-meta)] tabular-nums text-[var(--color-ink-muted)]">
          {zoomPercent}%
        </span>
      </div>
    </TooltipProvider>
  )
}
