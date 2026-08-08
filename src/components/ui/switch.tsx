import * as SwitchPrimitive from '@radix-ui/react-switch'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Switch({
  className,
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent',
        'bg-[var(--color-surface-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
        'data-[state=checked]:bg-[var(--color-accent)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow-sm',
          'transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'data-[state=checked]:translate-x-[18px]',
        )}
      />
    </SwitchPrimitive.Root>
  )
}
