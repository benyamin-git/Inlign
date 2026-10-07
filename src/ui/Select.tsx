import { useId } from 'react'
import type { ComponentPropsWithRef } from 'react'
import { cn } from '@/lib/cn'

export interface SelectProps extends ComponentPropsWithRef<'select'> {
  label: string
  hint?: string
  error?: string
}

export function Select({ label, hint, error, id, className, children, ...props }: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const description = error ?? hint
  const descriptionId = description ? `${selectId}-description` : undefined

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-medium text-on-surface">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={descriptionId}
        className={cn(
          'h-control rounded-app-sm border border-outline bg-surface px-3 text-sm text-on-surface',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-loss',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {description ? (
        <p
          id={descriptionId}
          className={cn('text-sm', error ? 'text-loss' : 'text-on-surface-variant')}
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}
