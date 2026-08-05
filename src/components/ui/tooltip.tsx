import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function TooltipProvider({
  children,
  delayDuration = 400,
}: {
  children: ReactNode
  delayDuration?: number
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      {children}
    </TooltipPrimitive.Provider>
  )
}

export function Tooltip({
  children,
  label,
  side = 'right',
}: {
  children: ReactNode
  label: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 rounded-md bg-[var(--color-ink)] px-2 py-1 text-[length:var(--text-meta)] text-[var(--color-surface)] shadow-sm',
          )}
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-[var(--color-ink)]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export type TooltipContentProps = ComponentPropsWithoutRef<
  typeof TooltipPrimitive.Content
>
