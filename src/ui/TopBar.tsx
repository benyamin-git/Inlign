import type { ReactNode } from 'react'

export interface TopBarProps {
  title: string
  children?: ReactNode
}

export function TopBar({ title, children }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant bg-surface pt-safe-top">
      <div className="flex h-topbar items-center gap-2 px-4">
        <h1 className="truncate text-lg font-semibold text-on-surface">{title}</h1>
        {children ? <div className="ms-auto flex items-center gap-1">{children}</div> : null}
      </div>
    </header>
  )
}
