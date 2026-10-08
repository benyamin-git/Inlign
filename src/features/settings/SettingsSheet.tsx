import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, DatabaseBackup, FileDown, FileUp, RotateCcw } from 'lucide-react'
import type { Notebook } from '@/data/models/notebook'
import { DEFAULT_SETTINGS, type Settings } from '@/data/models/settings'
import { readSettings, updateSettings } from '@/data/repositories/settings'
import type { TranslationKey } from '@/i18n/types'
import { useI18n } from '@/i18n/I18nProvider'
import { cn } from '@/lib/cn'
import {
  ACCENT_PRIMARIES,
  ACCENTS,
  applyAccent,
  writeStoredAccent,
  type AccentId,
} from '@/theme/accents'
import { applyTheme, writeStoredTheme } from '@/theme/theme'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { Input } from '@/ui/Input'
import { Select } from '@/ui/Select'
import { Sheet } from '@/ui/Sheet'
import { Switch } from '@/ui/Switch'
import {
  exportBackupFile,
  exportNotebookFile,
  importNotebookFile,
  restoreBackupFile,
} from './dataActions'

export interface SettingsSheetProps {
  open: boolean
  onClose: () => void
  notebook?: Notebook | null
  onNotebookImported?: (notebook: Notebook) => void
}

interface Status {
  kind: 'success' | 'error'
  text: string
}

const PRECISIONS = [8, 9, 10, 11, 12, 13, 14, 15]
const DEFAULT_TOLERANCE = 0.001
const ACCENT_IDS = Object.keys(ACCENTS) as AccentId[]

const ACCENT_LABEL_KEYS: Record<AccentId, TranslationKey> = {
  blue: 'settings.accentBlue',
  teal: 'settings.accentTeal',
  green: 'settings.accentGreen',
  orange: 'settings.accentOrange',
  rose: 'settings.accentRose',
  violet: 'settings.accentViolet',
}

export function SettingsSheet({
  open,
  onClose,
  notebook = null,
  onNotebookImported,
}: SettingsSheetProps) {
  const { t } = useI18n()
  const settings = useLiveQuery(() => readSettings(), [], DEFAULT_SETTINGS)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)

  const patch = async (values: Partial<Omit<Settings, 'id'>>) => {
    try {
      const next = await updateSettings(values)
      if (values.theme !== undefined) {
        writeStoredTheme(next.theme)
        applyTheme(next.theme)
      }
      if (values.accent !== undefined) {
        writeStoredAccent(next.accent)
        applyAccent(next.accent)
      }
    } catch {
      setStatus({ kind: 'error', text: t('settings.actionFailed') })
    }
  }

  const handleExportNotebook = async () => {
    if (notebook === null) return
    try {
      await exportNotebookFile(notebook)
      setStatus({ kind: 'success', text: t('settings.exportNotebookDone') })
    } catch {
      setStatus({ kind: 'error', text: t('settings.actionFailed') })
    }
  }

  const handleImportNotebook = async () => {
    try {
      const imported = await importNotebookFile()
      if (imported === null) return
      onNotebookImported?.(imported)
      setStatus({
        kind: 'success',
        text: t('settings.importNotebookDone', { title: imported.title }),
      })
    } catch {
      setStatus({ kind: 'error', text: t('settings.actionFailed') })
    }
  }

  const handleExportBackup = async () => {
    try {
      await exportBackupFile()
      setStatus({ kind: 'success', text: t('settings.exportBackupDone') })
    } catch {
      setStatus({ kind: 'error', text: t('settings.actionFailed') })
    }
  }

  const handleRestore = async () => {
    setRestoreOpen(false)
    try {
      const restored = await restoreBackupFile()
      if (!restored) return
      const next = await readSettings()
      writeStoredTheme(next.theme)
      applyTheme(next.theme)
      writeStoredAccent(next.accent)
      applyAccent(next.accent)
      setStatus({ kind: 'success', text: t('settings.restoreBackupDone') })
    } catch {
      setStatus({ kind: 'error', text: t('settings.actionFailed') })
    }
  }

  const handleClose = () => {
    setStatus(null)
    setRestoreOpen(false)
    onClose()
  }

  const commitTolerance = (input: HTMLInputElement) => {
    const value = Number(input.value)
    if (!Number.isFinite(value) || value < 0) {
      input.value = String(settings.toleranceOverride ?? '')
      return
    }
    void patch({ toleranceOverride: value })
  }

  return (
    <>
      <Sheet open={open} onClose={handleClose} title={t('settings.title')}>
        <div className="flex flex-col gap-4">
          <Select
            label={t('settings.precision')}
            hint={t('settings.precisionHint')}
            value={String(settings.precision)}
            onChange={(event) => {
              void patch({ precision: Number(event.target.value) })
            }}
          >
            {PRECISIONS.map((precision) => (
              <option key={precision} value={precision}>
                {precision}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-2">
            <Switch
              checked={settings.toleranceOverride !== null}
              onCheckedChange={(checked) => {
                void patch({ toleranceOverride: checked ? DEFAULT_TOLERANCE : null })
              }}
            >
              {t('settings.tolerance')}
            </Switch>
            <p className="text-sm text-on-surface-variant">{t('settings.toleranceHint')}</p>
            {settings.toleranceOverride !== null ? (
              <Input
                label={t('settings.toleranceValue')}
                type="number"
                min="0"
                step="any"
                defaultValue={settings.toleranceOverride}
                onBlur={(event) => commitTolerance(event.currentTarget)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
              />
            ) : null}
          </div>
          <Select
            label={t('settings.angleMode')}
            value={settings.angleMode}
            onChange={(event) => {
              void patch({ angleMode: event.target.value === 'degrees' ? 'degrees' : 'radians' })
            }}
          >
            <option value="radians">{t('settings.angleRadians')}</option>
            <option value="degrees">{t('settings.angleDegrees')}</option>
          </Select>
          <Select
            label={t('settings.theme')}
            value={settings.theme}
            onChange={(event) => {
              const value = event.target.value
              if (value === 'light' || value === 'dark' || value === 'oled') {
                void patch({ theme: value })
              } else {
                void patch({ theme: 'system' })
              }
            }}
          >
            <option value="system">{t('settings.themeSystem')}</option>
            <option value="light">{t('settings.themeLight')}</option>
            <option value="dark">{t('settings.themeDark')}</option>
            <option value="oled">{t('settings.themeOled')}</option>
          </Select>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-on-surface">{t('settings.accent')}</span>
            <div
              role="radiogroup"
              aria-label={t('settings.accent')}
              className="flex flex-wrap gap-2"
            >
              {ACCENT_IDS.map((id) => {
                const selected = settings.accent === id
                const primary = ACCENT_PRIMARIES[id]
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      void patch({ accent: id })
                    }}
                    className={cn(
                      'flex min-h-control-touch items-center gap-2 rounded-app-full border px-3 text-sm',
                      selected
                        ? 'border-primary bg-secondary-container text-on-secondary-container'
                        : 'border-outline text-on-surface hover:bg-surface-container-high',
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-4 shrink-0 rounded-app-full"
                      style={{ backgroundColor: primary.light }}
                    />
                    {t(ACCENT_LABEL_KEYS[id])}
                    {selected ? <Check aria-hidden size={14} /> : null}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-on-surface">{t('settings.data')}</h3>
            <p className="text-sm text-on-surface-variant">{t('settings.dataHint')}</p>
            <Button
              variant="tonal"
              disabled={notebook === null}
              onClick={() => {
                void handleExportNotebook()
              }}
            >
              <FileDown aria-hidden size={18} />
              {t('settings.exportNotebook')}
            </Button>
            <Button
              variant="tonal"
              onClick={() => {
                void handleImportNotebook()
              }}
            >
              <FileUp aria-hidden size={18} />
              {t('settings.importNotebook')}
            </Button>
            <Button
              variant="tonal"
              onClick={() => {
                void handleExportBackup()
              }}
            >
              <DatabaseBackup aria-hidden size={18} />
              {t('settings.exportBackup')}
            </Button>
            <Button variant="destructive" onClick={() => setRestoreOpen(true)}>
              <RotateCcw aria-hidden size={18} />
              {t('settings.restoreBackup')}
            </Button>
            {status !== null ? (
              <p
                role="status"
                className={cn(
                  'rounded-app-sm px-3 py-2 text-sm',
                  status.kind === 'error' ? 'bg-loss/10 text-loss' : 'bg-profit/10 text-profit',
                )}
              >
                {status.text}
              </p>
            ) : null}
          </div>
        </div>
      </Sheet>
      <Dialog
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        title={t('settings.restoreBackupTitle')}
        description={t('settings.restoreBackupDescription')}
        actions={
          <>
            <Button variant="text" onClick={() => setRestoreOpen(false)}>
              {t('settings.restoreBackupCancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void handleRestore()
              }}
            >
              {t('settings.restoreBackupConfirm')}
            </Button>
          </>
        }
      >
        {null}
      </Dialog>
    </>
  )
}
