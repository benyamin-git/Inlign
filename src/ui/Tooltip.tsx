import { useId } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TooltipProps {
  label: string
  children: ReactNode
}

export function Tooltip({ label, children }: TooltipProps) {
  const id = useId()

  return (
    <span className="group relative inline-flex">
      <span tabIndex={0} aria-describedby={id} className="inline-flex rounded-app-xs outline-none">
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute start-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-app-xs bg-inverse-surface px-2 py-1 text-xs whitespace-nowrap text-inverse-on-surface',
          'invisible opacity-0 transition-opacity',
          'group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100',
        )}
      >
        {label}
      </span>
    </span>
  )
}
