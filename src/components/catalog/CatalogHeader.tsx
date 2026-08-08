import { Link } from 'react-router-dom'
import { Plus, Sun, Moon, Monitor } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { RoleSwitch } from '@/components/RoleSwitch'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import {
  type ThemePreference,
  useSession,
} from '@/store/session'

interface CatalogHeaderProps {
  onUpload: () => void
}

export function CatalogHeader({ onUpload }: CatalogHeaderProps) {
  const theme = useSession((s) => s.ui.theme)
  const setTheme = useSession((s) => s.setTheme)
  const workspaceRole = useSession((s) => s.ui.workspaceRole)

  return (
    <header className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] transition-colors duration-200">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]">
          <BrandMark size="md" />
        </Link>
        <h1 className="text-[length:var(--text-title)] font-semibold text-[var(--color-ink)]">
          Projeler
        </h1>

        <RoleSwitch
          value={workspaceRole}
          size="md"
          className="ml-2 hidden sm:inline-flex"
        />

        <div className="ml-auto flex items-center gap-2">
          <Segmented
            ariaLabel="Tema"
            value={theme}
            onChange={setTheme}
            size="md"
            className="hidden sm:inline-flex [&_button]:min-w-7 [&_button]:px-1.5"
            options={[
              {
                value: 'light' as ThemePreference,
                title: 'Açık',
                ariaLabel: 'Açık',
                label: (
                  <Sun className="mx-auto h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                ),
              },
              {
                value: 'dark' as ThemePreference,
                title: 'Koyu',
                ariaLabel: 'Koyu',
                label: (
                  <Moon className="mx-auto h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                ),
              },
              {
                value: 'system' as ThemePreference,
                title: 'Sistem',
                ariaLabel: 'Sistem',
                label: (
                  <Monitor className="mx-auto h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                ),
              },
            ]}
          />
          <Button type="button" size="sm" onClick={onUpload}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Yükle
          </Button>
        </div>
      </div>
    </header>
  )
}
