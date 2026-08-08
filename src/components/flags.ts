import type { Bubble, BubbleLayout } from '@/api/types'

/** Motor escalate / reason → okunaklı Türkçe etiket (iç detay). */
const REASON_LABELS: Record<string, string> = {
  clean_editor: 'Editör bölgesi',
  multi_lobe: 'Çok loblu',
  no_fit: 'Sığmadı',
  no_text: 'Metin yok',
  empty_mask: 'Boş maske',
  overflow: 'Taşma',
  editor: 'Editör',
}

export function reasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null
  return REASON_LABELS[reason] ?? reason
}

export function statusLabel(status: string | null | undefined): {
  text: string
  variant: 'ok' | 'warn' | 'default'
} {
  switch (status) {
    case 'ok':
      return { text: 'tamam', variant: 'ok' }
    case 'partial':
      return { text: 'kısmi', variant: 'warn' }
    case 'skipped':
      return { text: 'atlandı', variant: 'default' }
    default:
      return { text: status || '—', variant: 'default' }
  }
}

export type FlagCode =
  | 'clean_editor'
  | 'multi_lobe'
  | 'no_fit'
  | 'no_text'
  | 'empty_mask'
  | 'overflow'

export interface BubbleFlag {
  code: FlagCode
  label: string
  hint: string
  action: { label: string; kind: 'paint' | 'frame' | 'text' | 'typeset' }
}

const FLAG_DEFS: Record<FlagCode, Omit<BubbleFlag, 'code'>> = {
  clean_editor: {
    label: 'Zemin dokulu',
    hint: 'Zemin dokulu, otomatik silinemedi. Fırçayla temizleyip isteğe bağlı dizgi deneyebilirsin.',
    action: { label: 'Fırçayla temizle', kind: 'paint' },
  },
  empty_mask: {
    label: 'Boş maske',
    hint: 'Maske boş, balon şekli bozuk.',
    action: { label: 'Fırçayla temizle', kind: 'paint' },
  },
  multi_lobe: {
    label: 'Çok parçalı',
    hint: 'Balon çok parçalı, dizgi durdu.',
    action: { label: 'Çerçeve çiz', kind: 'frame' },
  },
  no_fit: {
    label: 'Sığmadı',
    hint: 'Metin sığmadı.',
    action: { label: 'Oto dizgi', kind: 'typeset' },
  },
  overflow: {
    label: 'Taşma',
    hint: 'Metin balondan taşıyor.',
    action: { label: 'Oto dizgi', kind: 'typeset' },
  },
  no_text: {
    label: 'Metin yok',
    hint: 'Çeviri metni boş.',
    action: { label: 'Metne git', kind: 'text' },
  },
}

const FLAG_CODES: ReadonlySet<string> = new Set([
  'clean_editor',
  'multi_lobe',
  'no_fit',
  'no_text',
  'empty_mask',
  'overflow',
])

function pushFlag(out: BubbleFlag[], code: FlagCode): void {
  if (out.some((f) => f.code === code)) return
  out.push({ code, ...FLAG_DEFS[code] })
}

/** Soft-flag inceleme modeli — clean + typeset escalate + overflow. */
export function bubbleFlags(
  bubble: Bubble,
  layout?: BubbleLayout,
): BubbleFlag[] {
  const out: BubbleFlag[] = []

  if (bubble.clean_status === 'editor') {
    pushFlag(out, 'clean_editor')
  }

  const reason = layout?.reason
  if (reason && FLAG_CODES.has(reason)) {
    pushFlag(out, reason as FlagCode)
  }

  if (layout?.overflow) {
    pushFlag(out, 'overflow')
  }

  return out
}
