import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({
  className,
  children,
  ...props
}: DialogPrimitive.DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-[ff-fade-in_var(--duration-normal)_var(--ease-out-soft)] data-[state=closed]:animate-[ff-fade-out_150ms_ease-in]" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 max-h-[min(90vh,36rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-[var(--color-surface-raised)] p-5 shadow-lg ring-1 ring-[var(--color-border)] focus:outline-none',
          'data-[state=open]:animate-[ff-dialog-in_var(--duration-slow)_var(--ease-out-soft)]',
          'data-[state=closed]:animate-[ff-dialog-out_150ms_ease-in]',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogTitle({
  className,
  ...props
}: DialogPrimitive.DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      className={cn(
        'text-[length:var(--text-title)] font-semibold text-[var(--color-ink)]',
        className,
      )}
      {...props}
    />
  )
}

export function DialogDescription({
  className,
  ...props
}: DialogPrimitive.DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      className={cn(
        'mt-1 text-[length:var(--text-ui)] text-[var(--color-ink-muted)]',
        className,
      )}
      {...props}
    />
  )
}

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  /** Require typing this exact string before confirm enables. */
  confirmText?: string
  typedValue?: string
  onTypedValueChange?: (v: string) => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  tone = 'default',
  confirmText,
  typedValue = '',
  onTypedValueChange,
  onConfirm,
}: ConfirmDialogProps) {
  const needsType = Boolean(confirmText)
  const canConfirm = !needsType || typedValue === confirmText

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription asChild={typeof description !== 'string'}>
          {typeof description === 'string' ? (
            description
          ) : (
            <div>{description}</div>
          )}
        </DialogDescription>
        {needsType && (
          <div className="mt-3">
            <label className="mb-1 block text-[length:var(--text-meta)] text-[var(--color-ink-muted)]">
              Onay için yazın: <span className="font-mono">{confirmText}</span>
            </label>
            <input
              value={typedValue}
              onChange={(e) => onTypedValueChange?.(e.target.value)}
              className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[length:var(--text-ui)] text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
              autoComplete="off"
            />
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'danger' : 'default'}
            size="sm"
            disabled={!canConfirm}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
