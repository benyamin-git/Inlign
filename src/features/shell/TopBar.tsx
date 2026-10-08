import { CircleQuestionMark, Download, PanelLeft, Plus, Settings } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import { IconButton } from '@/ui/IconButton'

export interface ShellTopBarProps {
  title: string
  saving: boolean
  savedAt: number | null
  disabled?: boolean
  onTitleChange: (title: string) => void
  onOpenSwitcher: () => void
  onNewNotebook: () => void
  onExportNotebook: () => void
  onOpenSettings: () => void
  onOpenHelp: () => void
}

export function ShellTopBar({
  title,
  saving,
  savedAt,
  disabled = false,
  onTitleChange,
  onOpenSwitcher,
  onNewNotebook,
  onExportNotebook,
  onOpenSettings,
  onOpenHelp,
}: ShellTopBarProps) {
  const { t } = useI18n()

  const commit = (input: HTMLInputElement) => {
    const next = input.value.trim()
    if (next.length === 0 || next === title) {
      input.value = title
      return
    }
    onTitleChange(next)
  }

  const status = saving ? t('shell.saving') : savedAt !== null ? t('shell.saved') : ''

  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant bg-surface pt-safe-top">
      <div className="flex h-topbar items-center gap-1 px-2 sm:px-4">
        <IconButton label={t('shell.openSwitcher')} onClick={onOpenSwitcher}>
          <PanelLeft aria-hidden size={20} />
        </IconButton>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            key={title}
            aria-label={t('shell.titleLabel')}
            defaultValue={title}
            disabled={disabled}
            onBlur={(event) => commit(event.currentTarget)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
            className="min-w-0 flex-1 rounded-app-sm bg-transparent px-2 py-1 text-lg font-semibold text-on-surface disabled:opacity-50 focus-visible:bg-surface-container-high"
          />
          <span
            role="status"
            aria-live="polite"
            className="hidden shrink-0 pe-1 text-xs text-on-surface-variant sm:inline"
          >
            {status}
          </span>
        </div>
        <IconButton label={t('shell.newNotebook')} onClick={onNewNotebook}>
          <Plus aria-hidden size={20} />
        </IconButton>
        <IconButton
          label={t('shell.exportNotebook')}
          onClick={onExportNotebook}
          disabled={disabled}
        >
          <Download aria-hidden size={20} />
        </IconButton>
        <IconButton label={t('shell.openSettings')} onClick={onOpenSettings}>
          <Settings aria-hidden size={20} />
        </IconButton>
        <IconButton label={t('shell.openHelp')} onClick={onOpenHelp}>
          <CircleQuestionMark aria-hidden size={20} />
        </IconButton>
      </div>
    </header>
  )
}
