import { Switch } from '@/components/ui/switch'

interface LayerRowProps {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

export function LayerRow({
  label,
  checked,
  onCheckedChange,
  disabled,
}: LayerRowProps) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-ink-muted)]">
      <span>{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </label>
  )
}
