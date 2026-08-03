/** Motor escalate / reason → okunaklı Türkçe etiket. */
const REASON_LABELS: Record<string, string> = {
  clean_editor: 'Editör bölgesi',
  multi_lobe: 'Çok loblu',
  no_fit: 'Sığmadı',
  no_text: 'Metin yok',
  empty_mask: 'Boş maske',
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
