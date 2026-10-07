import type { ReactNode } from 'react'

export interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  children?: ReactNode
}

export function EmptyState({ title, description, icon, children }: EmptyStateProps) {
  return (
    <div className="grid place-items-center gap-2 p-8 text-center">
      {icon ? (
        <div className="text-on-surface-variant" aria-hidden>
          {icon}
        </div>
      ) : null}
      <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
      {description ? (
        <p className="max-w-prose text-sm text-on-surface-variant">{description}</p>
      ) : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  )
}
