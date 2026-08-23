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

export type FirstRunSource = 'seed' | 'upload'

type StepCopy = {
  title: string
  /** “Nasıl çalışır” dialog — path-agnostic, no overclaim. */
  body: string
  tip: string
  tipSeed?: string
}

export const FIRST_RUN_STEPS: Record<FirstRunStep, StepCopy> = {
  1: {
    title: 'Katalog',
    body: 'Hazır örnek bölümü açabilir veya kendi sayfalarını yükleyebilirsin. Üstten rol seç: çevirmen metni yazar, letterer dizgiyi düzeltir.',
    tip: 'Örnek bölümü aç veya kendi sayfalarını yükle. Çevirmen metni yazar; letterer dizgiyi düzeltir.',
  },
  2: {
    title: 'Yükle',
    body: 'İsteğe bağlı. ZIP veya görselleri bırakınca sistem balonları bulur ve zemini temizlemeyi dener. Çeviri yazmaz. İlk sayfa birkaç saniye sürebilir. Örnek bölümde bu adım yok.',
    tip: 'ZIP veya görselleri bırak. Sistem balonları bulur ve zemini temizlemeyi dener — çeviri yazmaz. İlk sayfa birkaç saniye sürebilir.',
  },
  3: {
    title: 'Çevirmen',
    body: 'Bulunan balonlara Türkçe yaz; okuma sırasını sürükleyerek düzelt. AI’nın kaçırdığı balon, SFX veya serbest metin için kutu çiz. Çeviride AI yok.',
    tip: 'Balonlara Türkçe yaz, sırayı sürükle. Kaçırılan balon veya SFX için kutu çiz. Çeviride AI yok.',
    tipSeed:
      'Örnekte balonlar hazır — metni yaz veya düzelt, sırayı sürükle. Kaçırılan balon veya SFX için kutu çiz. Çeviride AI yok.',
  },
  4: {
    title: 'Letterer',
    body: 'Dizgi taslağını font, çerçeve, satır aralığı ve fırçayla düzelt. Temizlenemeyen dokulu zemin letterer’da kalır. Çeviri yazmak çevirmenin işi; sen yerleştirirsin. PNG veya bölüm zip indir.',
    tip: 'Font, çerçeve ve fırçayla dizgiyi düzelt. Taşan veya dokulu yerler letterer işi — çeviri yazmak değil. İndir ile PNG/zip al.',
    tipSeed:
      'Örnekte dizgi taslağı hazır. Taşan metni, fontu ve dokulu zeminleri düzelt. Çeviri letterer işi değil. İndir ile PNG/zip al.',
  },
}

export const FIRST_RUN_STEP_LIST: FirstRunStep[] = [1, 2, 3, 4]

function tipFor(step: FirstRunStep, source: FirstRunSource): string {
  const entry = FIRST_RUN_STEPS[step]
  if (source === 'seed' && entry.tipSeed) return entry.tipSeed
  return entry.tip
}

/** Dismissible tip strip (first run). */
export function OnboardingTip({
  step,
  source = 'upload',
}: {
  step: FirstRunStep
  source?: FirstRunSource
}) {
  const pending = useSession((s) => isFirstRunPending(s.firstRunDone, step))
  const dismiss = useSession((s) => s.dismissFirstRunStep)

  if (!pending) return null

  return (
    <div className="relative flex shrink-0 items-center justify-center border-b border-[var(--color-border)] bg-[var(--color-accent-soft)] px-16 py-2.5 text-[var(--color-ink)]">
      <p className="max-w-3xl text-center text-[length:var(--text-title)] leading-snug">
        <span className="font-semibold">{step}.</span>
        {' '}
        {tipFor(step, source)}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-3 top-1/2 h-7 -translate-y-1/2"
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
            {FIRST_RUN_STEP_LIST.map((step) => {
              const s = FIRST_RUN_STEPS[step]
              return (
                <li key={step} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-semibold text-[var(--color-accent)]">
                    {step}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                      {s.title}
                    </h3>
                    <p className="text-sm text-[var(--color-ink-muted)]">{s.body}</p>
                  </div>
                </li>
              )
            })}
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
