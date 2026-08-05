import { WORKSPACE_SHORTCUTS } from '@/hooks/useWorkspaceKeys'
import { Button } from '@/components/ui/button'

interface ShortcutsHelpProps {
  open: boolean
  onClose: () => void
}

/** Modal listing workspace keyboard shortcuts (source: WORKSPACE_SHORTCUTS). */
export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  if (!open) return null

  const groups = new Map<string, typeof WORKSPACE_SHORTCUTS>()
  for (const row of WORKSPACE_SHORTCUTS) {
    const list = groups.get(row.group) ?? []
    list.push(row)
    groups.set(row.group, list)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Klavye kısayolları"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,36rem)] w-full max-w-md overflow-y-auto rounded-lg bg-[var(--color-surface-raised)] p-5 shadow-lg ring-1 ring-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            Klavye kısayolları
          </h2>
          <kbd className="rounded bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[11px] text-[var(--color-accent)]">
            ?
          </kbd>
        </div>
        <div className="flex flex-col gap-4">
          {[...groups.entries()].map(([group, rows]) => (
            <section key={group}>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
                {group}
              </h3>
              <ul className="flex flex-col gap-1">
                {rows.map((row) => (
                  <li
                    key={`${row.group}-${row.keys}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-[var(--color-ink)]">{row.label}</span>
                    <kbd className="shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-canvas-bg)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-ink-muted)]">
                      {row.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Kapat
          </Button>
        </div>
      </div>
    </div>
  )
}
