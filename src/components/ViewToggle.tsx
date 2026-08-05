import type { ViewMode } from '@/api/types'
import { Segmented } from '@/components/ui/segmented'

const MODES: { value: ViewMode; label: string }[] = [
  { value: 'composed', label: 'Sonuç' },
  { value: 'original', label: 'Orijinal' },
  { value: 'split', label: 'Yan yana' },
]

interface ViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <Segmented
      ariaLabel="Görünüm"
      value={value}
      onChange={onChange}
      options={MODES}
    />
  )
}
