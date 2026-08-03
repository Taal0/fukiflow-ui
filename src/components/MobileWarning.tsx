export function MobileWarning() {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--color-surface)] p-8 md:hidden">
      <div className="max-w-sm text-center">
        <p
          className="mb-2 text-2xl text-[var(--color-accent)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          FukiFlow
        </p>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Bu demo masaüstü tarayıcı için tasarlandı. Lütfen daha geniş bir
          ekranda açın.
        </p>
      </div>
    </div>
  )
}
