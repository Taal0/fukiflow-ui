import { WORKSPACE_SHORTCUTS } from '@/hooks/useWorkspaceKeys'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

interface ShortcutsHelpProps {
  open: boolean
  onClose: () => void
  shortcuts?: ReadonlyArray<{ keys: string; label: string; group: string }>
}

export function ShortcutsHelp({
  open,
  onClose,
  shortcuts = WORKSPACE_SHORTCUTS,
}: ShortcutsHelpProps) {
  const groups = new Map<
    string,
    { keys: string; label: string; group: string }[]
  >()
  for (const row of shortcuts) {
    const list = groups.get(row.group) ?? []
    list.push(row)
    groups.set(row.group, list)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <DialogTitle>Klavye kısayolları</DialogTitle>
          <kbd className="rounded bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[length:var(--text-meta)] text-[var(--color-accent)]">
            ?
          </kbd>
        </div>
        <div className="flex flex-col gap-4">
          {[...groups.entries()].map(([group, rows]) => (
            <section key={group}>
              <h3 className="mb-1.5 text-[length:var(--text-meta)] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
                {group}
              </h3>
              <ul className="flex flex-col gap-1">
                {rows.map((row) => (
                  <li
                    key={`${row.group}-${row.keys}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-[var(--color-ink)]">{row.label}</span>
                    <kbd className="shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-canvas-bg)] px-1.5 py-0.5 font-mono text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
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
      </DialogContent>
    </Dialog>
  )
}
