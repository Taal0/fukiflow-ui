import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
  compact?: boolean
  className?: string
  /** Auto-focus when dialog opens. */
  autoFocus?: boolean
}

export function DropZone({
  onFiles,
  disabled,
  compact,
  className,
  autoFocus,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)

  const acceptFiles = (list: FileList | File[] | null) => {
    if (!list || disabled) return
    const files = Array.from(list)
    if (files.length) onFiles(files)
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Dosya yüklemek için tıkla veya sürükle"
      aria-disabled={disabled || undefined}
      autoFocus={autoFocus}
      onClick={() => {
        if (!disabled) inputRef.current?.click()
      }}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        e.stopPropagation()
        dragDepth.current += 1
        e.currentTarget.dataset.dragging = 'true'
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) delete e.currentTarget.dataset.dragging
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        dragDepth.current = 0
        delete e.currentTarget.dataset.dragging
        acceptFiles(e.dataTransfer.files)
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface)] text-center transition-colors outline-none',
        'hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]',
        'data-[dragging=true]:border-[var(--color-accent)] data-[dragging=true]:bg-[var(--color-accent-soft)]',
        'focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
        disabled && 'pointer-events-none opacity-50',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-12',
        className,
      )}
    >
      <Upload
        className={cn(
          'text-[var(--color-ink-muted)]',
          compact ? 'h-6 w-6' : 'h-8 w-8',
        )}
        strokeWidth={1.75}
        aria-hidden
      />
      <div>
        <p className="text-[length:var(--text-ui)] font-medium text-[var(--color-ink)]">
          Dosyaları sürükleyin
        </p>
        <p className="mt-0.5 text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
          veya tıklayarak seçin
        </p>
      </div>
      <p className="text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
        PNG, JPG, WebP · ZIP desteklenir
      </p>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".png,.jpg,.jpeg,.webp,.zip,image/png,image/jpeg,image/webp,application/zip"
        multiple
        disabled={disabled}
        onChange={(e) => {
          acceptFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
