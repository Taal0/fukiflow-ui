import { BRUSH_RADIUS_MAX, BRUSH_RADIUS_MIN } from '@/lib/paintStroke'
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

  const setRadius = (raw: number) => {
    if (!Number.isFinite(raw)) return
    setBrushRadius(
      Math.min(BRUSH_RADIUS_MAX, Math.max(BRUSH_RADIUS_MIN, Math.round(raw))),
    )
  }

  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3">
      <span className="text-[length:var(--text-meta)] uppercase tracking-wide text-[var(--color-ink-muted)]">
        {tool === 'paint' ? 'Boya' : 'Geri al'}
      </span>
      <label className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
        <span className="sr-only">Fırça boyutu</span>
        <input
          type="range"
          min={BRUSH_RADIUS_MIN}
          max={BRUSH_RADIUS_MAX}
          step={1}
          value={brush.radiusPx}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="h-1.5 w-28 max-w-full cursor-pointer accent-[var(--color-accent)] sm:w-40"
          aria-label="Fırça boyutu kaydırıcı"
        />
        <input
          type="number"
          min={BRUSH_RADIUS_MIN}
          max={BRUSH_RADIUS_MAX}
          step={1}
          value={brush.radiusPx}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="h-6 w-12 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-1 text-center text-[length:var(--text-meta)] tabular-nums text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
          aria-label="Fırça boyutu px"
        />
        <span className="text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
          px
        </span>
      </label>
      {tool === 'paint' && brush.color && (
        <span
          className="h-5 w-5 shrink-0 rounded border border-[var(--color-border)]"
          style={{
            background: `rgb(${brush.color[0]}, ${brush.color[1]}, ${brush.color[2]})`,
          }}
          title="Örneklenen renk"
        />
      )}
      {selectedBubbleId != null && (
        <button
          type="button"
          className="ml-auto shrink-0 text-[length:var(--text-meta)] text-[var(--color-ink-muted)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
          onClick={() => onClearPaint(selectedBubbleId)}
        >
          Bu balonun boyasını sil
        </button>
      )}
    </div>
  )
}
