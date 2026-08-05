import { Button } from '@/components/ui/button'
import {
  BRUSH_PRESETS,
  BRUSH_RADIUS_MAX,
  BRUSH_RADIUS_MIN,
} from '@/lib/paintStroke'
import { useSession } from '@/store/session'

interface ToolOptionsBarProps {
  selectedBubbleId: number | null
  onClearPaint: (bubbleId: number) => void
}

/** Thin strip above canvas — only when paint/restore is active. */
export function ToolOptionsBar({
  selectedBubbleId,
  onClearPaint,
}: ToolOptionsBarProps) {
  const tool = useSession((s) => s.ui.activeTool)
  const brush = useSession((s) => s.brush)
  const setBrushRadius = useSession((s) => s.setBrushRadius)

  if (tool !== 'paint' && tool !== 'restore') return null

  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3">
      <span className="text-[length:var(--text-meta)] uppercase tracking-wide text-[var(--color-ink-muted)]">
        {tool === 'paint' ? 'Boya' : 'Geri al'}
      </span>
      <div className="flex items-center gap-1">
        {BRUSH_PRESETS.map((px) => (
          <Button
            key={px}
            type="button"
            variant={brush.radiusPx === px ? 'default' : 'outline'}
            size="sm"
            className="h-6 min-w-[1.75rem] px-1.5 text-[length:var(--text-meta)] tabular-nums"
            onClick={() => setBrushRadius(px)}
          >
            {px}
          </Button>
        ))}
        <input
          type="number"
          min={BRUSH_RADIUS_MIN}
          max={BRUSH_RADIUS_MAX}
          value={brush.radiusPx}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (!Number.isFinite(v)) return
            setBrushRadius(v)
          }}
          className="h-6 w-12 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-1 text-center text-[length:var(--text-meta)] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
          aria-label="Fırça boyutu px"
        />
      </div>
      {tool === 'paint' && brush.color && (
        <span
          className="h-5 w-5 rounded border border-[var(--color-border)]"
          style={{
            background: `rgb(${brush.color[0]}, ${brush.color[1]}, ${brush.color[2]})`,
          }}
          title="Örneklenen renk"
        />
      )}
      {selectedBubbleId != null && (
        <button
          type="button"
          className="ml-auto text-[length:var(--text-meta)] text-[var(--color-ink-muted)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
          onClick={() => onClearPaint(selectedBubbleId)}
        >
          Bu balonun boyasını sil
        </button>
      )}
    </div>
  )
}
