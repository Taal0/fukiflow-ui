import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-[color,background-color,border-color,filter,opacity,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-surface)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-accent)] text-white hover:brightness-110',
        ghost:
          'bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]',
        outline:
          'border border-[var(--color-border)] bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-muted)]',
        subtle:
          'bg-[var(--color-accent-soft)] text-[var(--color-accent)] hover:brightness-95',
        danger:
          'bg-[var(--color-danger)] text-white hover:brightness-110',
      },
      size: {
        default: 'h-9 px-3',
        sm: 'h-8 px-2.5 text-[length:var(--text-ui)]',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
