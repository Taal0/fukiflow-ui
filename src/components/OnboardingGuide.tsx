import { Button } from '@/components/ui/button'
import { useSession } from '@/store/session'

const STEPS = [
  {
    title: 'AI hazırladı',
    body: 'Soldan bir sayfa seçin. Clean ve dizgi katmanları seed’den geliyor — tarayıcıda anında birleşir.',
  },
  {
    title: 'Letterer düzeltir',
    body: 'Sağda balon metnini, fontunu veya boyutunu değiştirin. Sayfa otomatik yeniden dizilir.',
  },
  {
    title: 'Sonucu alın',
    body: 'Katmanları açıp kapatın, orijinalle karşılaştırın, sayfa PNG veya bölüm zip indirin.',
  },
]

export function OnboardingGuide() {
  const dismissed = useSession((s) => s.guideDismissed)
  const dismiss = useSession((s) => s.dismissGuide)

  if (dismissed) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="max-w-lg rounded-lg bg-[var(--color-surface-raised)] p-6 shadow-lg ring-1 ring-[var(--color-border)]">
        <p
          className="mb-1 text-sm text-[var(--color-accent)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          FukiFlow
        </p>
        <h2 className="mb-4 text-xl text-[var(--color-ink)]">
          Üç adımda demo
        </h2>
        <ol className="mb-6 flex flex-col gap-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-semibold text-[var(--color-accent)]">
                {i + 1}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                  {s.title}
                </h3>
                <p className="text-sm text-[var(--color-ink-muted)]">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex justify-end">
          <Button type="button" onClick={dismiss}>
            Başla
          </Button>
        </div>
      </div>
    </div>
  )
}
