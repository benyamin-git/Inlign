import type { ComponentPropsWithRef } from 'react'
import { cn } from '@/lib/cn'
import { BUTTON_VARIANTS, type ButtonVariant } from './variants'

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant
}

export function Button({ variant = 'filled', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-control items-center justify-center gap-2 rounded-app-sm px-4 text-sm font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  )
}
