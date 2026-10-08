import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { notebookToFile } from '@/data/backup'
import type { Notebook } from '@/data/models/notebook'
import { DEFAULT_SETTINGS } from '@/data/models/settings'
import {
  createNotebook,
  deleteNotebook,
  listNotebooks,
  renameNotebook,
} from '@/data/repositories/notebooks'
import { readSettings } from '@/data/repositories/settings'
import { NotebookEditor } from '@/features/notebook/NotebookEditor'
import { useAutosave } from '@/features/notebook/useAutosave'
import { useI18n } from '@/i18n/I18nProvider'
import { Button } from '@/ui/Button'
import { EmptyState } from '@/ui/EmptyState'
import { NotebookSwitcher } from './NotebookSwitcher'
import { registerAppShortcuts } from './shortcuts'
import { ShellTopBar } from './TopBar'

export interface SettingsSheetState {
  open: boolean
  onClose: () => void
  notebook: Notebook | null
  onNotebookImported: (notebook: Notebook) => void
}

export interface AppShellProps {
  settingsSheet?: (state: SettingsSheetState) => ReactNode
}

interface ContentDraft {
  id: string | null
  content: string
}

function downloadNotebookFile(notebook: Notebook): void {
  const { filename, text } = notebookToFile(notebook)
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function AppShell({ settingsSheet }: AppShellProps) {
  const { t } = useI18n()
  const notebooks = useLiveQuery(() => listNotebooks(), [])
  const settings = useLiveQuery(() => readSettings(), [], DEFAULT_SETTINGS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ContentDraft>({ id: null, content: '' })
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const selected =
    selectedId === null ? undefined : notebooks?.find((notebook) => notebook.id === selectedId)
  const current = selected ?? notebooks?.[0] ?? null
  const content =
    current !== null && draft.id === current.id ? draft.content : (current?.content ?? '')
  const { saving, savedAt } = useAutosave(current?.id ?? null, content)

  const handleNew = useCallback(async () => {
    const notebook = await createNotebook()
    setSelectedId(notebook.id)
    setSwitcherOpen(false)
  }, [])

  const handleExport = useCallback(() => {
    if (current === null) return
    downloadNotebookFile(current)
  }, [current])

  const handleChange = useCallback(
    (value: string) => {
      if (current === null) return
      setDraft({ id: current.id, content: value })
    },
    [current],
  )

  useEffect(
    () =>
      registerAppShortcuts({
        newNotebook: () => {
          void handleNew()
        },
        openSwitcher: () => setSwitcherOpen(true),
        exportNotebook: handleExport,
        openSettings: () => setSettingsOpen(true),
      }),
    [handleNew, handleExport],
  )

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ShellTopBar
        title={current?.title ?? ''}
        disabled={current === null}
        saving={saving}
        savedAt={savedAt}
        onTitleChange={(title) => {
          if (current !== null) void renameNotebook(current.id, title)
        }}
        onOpenSwitcher={() => setSwitcherOpen(true)}
        onNewNotebook={() => {
          void handleNew()
        }}
        onExportNotebook={handleExport}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <main className="min-h-0 flex-1">
        {current === null ? (
          <EmptyState title={t('empty.title')} description={t('empty.description')}>
            <Button
              onClick={() => {
                void handleNew()
              }}
            >
              {t('shell.newNotebook')}
            </Button>
          </EmptyState>
        ) : (
          <NotebookEditor
            key={current.id}
            value={content}
            settings={settings}
            onChange={handleChange}
          />
        )}
      </main>
      <NotebookSwitcher
        open={switcherOpen}
        notebooks={notebooks ?? []}
        currentId={current?.id ?? null}
        onClose={() => setSwitcherOpen(false)}
        onSelect={(id) => {
          setSelectedId(id)
          setSwitcherOpen(false)
        }}
        onCreate={() => {
          void handleNew()
        }}
        onRename={(id, title) => {
          void renameNotebook(id, title)
        }}
        onDelete={(id) => {
          void deleteNotebook(id)
        }}
      />
      {settingsSheet?.({
        open: settingsOpen,
        onClose: () => setSettingsOpen(false),
        notebook: current,
        onNotebookImported: (notebook) => setSelectedId(notebook.id),
      })}
    </div>
  )
}
