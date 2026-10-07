import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './IconButton'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-scrim/40" aria-hidden onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col overflow-y-auto rounded-t-app-lg bg-surface-container outline-none',
          'sm:inset-x-auto sm:inset-y-4 sm:end-4 sm:w-96 sm:rounded-app-lg',
        )}
      >
        <div className="flex items-center justify-between gap-2 p-4 pb-0">
          <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X aria-hidden size={20} />
          </IconButton>
        </div>
        <div className="p-4 pb-safe-bottom">{children}</div>
      </div>
    </div>
  )
}
