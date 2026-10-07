import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SwitchProps extends Omit<ComponentPropsWithRef<'button'>, 'onClick' | 'children'> {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  children: ReactNode
}

export function Switch({ checked, onCheckedChange, children, className, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'inline-flex min-h-control-touch items-center gap-3 text-start text-sm text-on-surface',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-app-full border transition-colors',
          checked ? 'border-primary bg-primary' : 'border-outline bg-surface-container-highest',
        )}
      >
        <span
          className={cn(
            'inline-block size-5 rounded-app-full transition-transform',
            checked ? 'translate-x-5 bg-on-primary' : 'translate-x-0.5 bg-outline',
          )}
        />
      </span>
      <span>{children}</span>
    </button>
  )
}
