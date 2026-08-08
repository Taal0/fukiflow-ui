import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal

export function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[10rem] overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-1 shadow-md',
          'data-[state=open]:animate-[ff-rise-in_var(--duration-fast)_var(--ease-out-soft)]',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

export function DropdownMenuItem({
  className,
  inset,
  danger,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  danger?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-[length:var(--text-ui)] outline-none transition-colors duration-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-[var(--color-surface-muted)]',
        danger
          ? 'text-[var(--color-danger)]'
          : 'text-[var(--color-ink)]',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('my-1 h-px bg-[var(--color-border)]', className)}
      {...props}
    />
  )
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        'px-2 py-1.5 text-[length:var(--text-meta)] font-semibold text-[var(--color-ink-muted)]',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuRadioGroup(
  props: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioGroup>,
) {
  return <DropdownMenuPrimitive.RadioGroup {...props} />
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> & {
  children?: ReactNode
}) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-[length:var(--text-ui)] text-[var(--color-ink)] outline-none transition-colors duration-100',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-[var(--color-surface-muted)]',
        'data-[state=checked]:text-[var(--color-ink)]',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="h-3.5 w-3.5 text-[var(--color-accent)]" strokeWidth={2.5} aria-hidden />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}
