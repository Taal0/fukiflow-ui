import { Link } from 'react-router-dom'
import { Plus, Sun, Moon, Monitor } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import {
  type ThemePreference,
  type WorkspaceRole,
  useSession,
} from '@/store/session'
import { cn } from '@/lib/utils'

const THEME_OPTIONS: {
  id: ThemePreference
  label: string
  Icon: typeof Sun
}[] = [
  { id: 'light', label: 'Açık', Icon: Sun },
  { id: 'dark', label: 'Koyu', Icon: Moon },
  { id: 'system', label: 'Sistem', Icon: Monitor },
]

const ROLE_OPTIONS: { id: WorkspaceRole; label: string }[] = [
  { id: 'letterer', label: 'Letterer' },
  { id: 'translator', label: 'Çevirmen' },
]

interface CatalogHeaderProps {
  onUpload: () => void
}

export function CatalogHeader({ onUpload }: CatalogHeaderProps) {
  const theme = useSession((s) => s.ui.theme)
  const setTheme = useSession((s) => s.setTheme)
  const workspaceRole = useSession((s) => s.ui.workspaceRole)
  const setWorkspaceRole = useSession((s) => s.setWorkspaceRole)

  return (
    <header className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]">
          <BrandMark size="md" />
        </Link>
        <h1 className="text-[length:var(--text-title)] font-semibold text-[var(--color-ink)]">
          Projeler
        </h1>

        <div
          role="group"
          aria-label="Rol"
          className="ml-2 hidden items-center rounded-md border border-[var(--color-border)] p-0.5 sm:flex"
        >
          {ROLE_OPTIONS.map(({ id, label }) => {
            const on = workspaceRole === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => setWorkspaceRole(id)}
                className={cn(
                  'rounded px-2 py-1 text-[length:var(--text-meta)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
                  on
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div
            role="group"
            aria-label="Tema"
            className="hidden items-center gap-0.5 sm:flex"
          >
            {THEME_OPTIONS.map(({ id, label, Icon }) => {
              const on = theme === id
              return (
                <button
                  key={id}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={on}
                  onClick={() => setTheme(id)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
                    on
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]',
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </button>
              )
            })}
          </div>
          <Button type="button" size="sm" onClick={onUpload}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Yükle
          </Button>
        </div>
      </div>
    </header>
  )
}
