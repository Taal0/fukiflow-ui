import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  isFirstRunPending,
  type FirstRunStep,
  useSession,
} from '@/store/session'

export const FIRST_RUN_STEPS: {
  step: FirstRunStep
  title: string
  body: string
  tip: string
}[] = [
  {
    step: 1,
    title: 'Katalog',
    body: 'Örnek bölümü açabilir veya kendi manganı yükleyebilirsin.',
    tip: 'Örnek bölümü açabilir veya kendi manganı yükleyebilirsin.',
  },
  {
    step: 2,
    title: 'Yükle',
    body: 'ZIP veya sayfa görsellerini sürükle. AI balonları bulup temizler — ilk sayfa birkaç saniye, sonrakiler daha hızlı.',
    tip: 'ZIP veya görselleri sürükle — AI balonları bulup temizler (sayfa başına birkaç saniye).',
  },
  {
    step: 3,
    title: 'Çevirmen kutusu',
    body: 'Eksik balon veya SFX için kutu çiz, Türkçe metni yaz. Bubble kutuları otomatik doğrulanır; SFX/Other doğrudan onaylanır.',
    tip: 'Balon/SFX kutusu çiz, Türkçe metni yaz — sistem otomatik doğrulayıp onaylar.',
  },
  {
    step: 4,
    title: 'Letterer düzeltir',
    body: 'Balonu seç, metni veya fontu düzelt — sayfa otomatik yeniden dizilir. Katmanları karşılaştır, PNG veya bölüm zip indir.',
    tip: 'Balonu seç, metni/fontu düzelt — sayfa otomatik yeniden dizilir. İndir ile PNG/zip al.',
  },
]

/** Dismissible tip strip (first run). */
export function OnboardingTip({ step }: { step: FirstRunStep }) {
  const pending = useSession((s) => isFirstRunPending(s.firstRunDone, step))
  const dismiss = useSession((s) => s.dismissFirstRunStep)
  const entry = FIRST_RUN_STEPS.find((s) => s.step === step)

  if (!pending || !entry) return null

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-accent-soft)] px-4 py-1.5 text-[length:var(--text-ui)] text-[var(--color-ink)]">
      <span className="min-w-0 flex-1 truncate">
        <strong className="font-semibold">{entry.step}/4</strong>
        {' — '}
        {entry.tip}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 shrink-0"
        onClick={() => dismiss(step)}
      >
        Anladım
      </Button>
    </div>
  )
}

interface OnboardingGuideProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Four-step guide — opened from “Nasıl çalışır”. */
export function OnboardingGuide({ open, onOpenChange }: OnboardingGuideProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Dört adımda demo</DialogTitle>
        <DialogDescription asChild>
          <ol className="mt-3 flex flex-col gap-4">
            {FIRST_RUN_STEPS.map((s) => (
              <li key={s.step} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-semibold text-[var(--color-accent)]">
                  {s.step}
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
