import type { ComponentPropsWithRef } from 'react'
import { cn } from '@/lib/cn'
import { BUTTON_VARIANTS, type ButtonVariant } from './variants'

export interface IconButtonProps extends ComponentPropsWithRef<'button'> {
  label: string
  variant?: ButtonVariant
}

export function IconButton({
  label,
  variant = 'text',
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        'inline-flex size-control items-center justify-center rounded-app-full transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  )
}
