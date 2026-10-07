import { useId } from 'react'
import type { ComponentPropsWithRef } from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends ComponentPropsWithRef<'input'> {
  label: string
  hint?: string
  error?: string
}

export function Input({ label, hint, error, id, className, ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const description = error ?? hint
  const descriptionId = description ? `${inputId}-description` : undefined

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-on-surface">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={descriptionId}
        className={cn(
          'h-control rounded-app-sm border border-outline bg-surface px-3 text-sm text-on-surface',
          'placeholder:text-on-surface-variant',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-loss',
          className,
        )}
        {...props}
      />
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
