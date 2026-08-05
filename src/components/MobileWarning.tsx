import { BrandMark } from '@/components/BrandMark'

export function MobileWarning() {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--color-surface)] p-8 md:hidden">
      <div className="max-w-sm text-center">
        <BrandMark size="lg" className="mb-3 inline-block" />
        <p className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
          Bu demo masaüstü tarayıcı için tasarlandı. Lütfen daha geniş bir
          ekranda açın.
        </p>
      </div>
    </div>
  )
}
