import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
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

/** Dismissible tip strip under the toolbar (first run). */
export function OnboardingTip() {
  const dismissed = useSession((s) => s.guideDismissed)
  const dismiss = useSession((s) => s.dismissGuide)

  if (dismissed) return null

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-accent-soft)] px-4 py-1.5 text-[length:var(--text-ui)] text-[var(--color-ink)]">
      <span className="min-w-0 flex-1 truncate">
        <strong className="font-semibold">İpucu:</strong> Soldan sayfa seçin,
        canvas’ta düzeltin, sağdan balon düzenleyin — İndir ile dışa aktarın.
      </span>
      <Button type="button" variant="ghost" size="sm" className="h-6 shrink-0" onClick={dismiss}>
        Anladım
      </Button>
    </div>
  )
}

interface OnboardingGuideProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Full three-step guide — opened from kebab “Nasıl çalışır”. */
export function OnboardingGuide({ open, onOpenChange }: OnboardingGuideProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Üç adımda demo</DialogTitle>
        <DialogDescription asChild>
          <ol className="mt-3 flex flex-col gap-4">
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
        </DialogDescription>
        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Kapat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
