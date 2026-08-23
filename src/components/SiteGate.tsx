import { useState, type FormEvent, type ReactNode } from 'react'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'ff-site-unlocked'
const PIN = '143967'

function readUnlocked(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function SiteGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(readUnlocked)
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  if (unlocked) return children

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (value.trim() === PIN) {
      try {
        localStorage.setItem(STORAGE_KEY, '1')
      } catch {
        /* private mode — session-only unlock */
      }
      setUnlocked(true)
      return
    }
    setError(true)
  }

  return (
    <div className="flex h-full items-center justify-center bg-[var(--color-surface)] p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-xs rounded-lg bg-[var(--color-surface-raised)] p-5 shadow-lg ring-1 ring-[var(--color-border)]"
      >
        <BrandMark size="lg" className="mb-3 block" />
        <p className="text-[length:var(--text-ui)] text-[var(--color-ink-muted)]">
          Demo erişimi için şifre
        </p>
        <label className="sr-only" htmlFor="site-gate-pin">
          Şifre
        </label>
        <input
          id="site-gate-pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError(false)
          }}
          className="mt-3 h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[length:var(--text-ui)] text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
        />
        {error && (
          <p className="mt-2 text-[length:var(--text-meta)] text-[var(--color-danger)]">
            Şifre yanlış
          </p>
        )}
        <Button type="submit" size="sm" className="mt-4 w-full">
          Giriş
        </Button>
      </form>
    </div>
  )
}
