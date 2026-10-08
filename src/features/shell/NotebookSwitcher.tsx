import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Notebook } from '@/data/models/notebook'
import { useI18n } from '@/i18n/I18nProvider'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { IconButton } from '@/ui/IconButton'
import { Input } from '@/ui/Input'
import { Sheet } from '@/ui/Sheet'

export interface NotebookSwitcherProps {
  open: boolean
  notebooks: Notebook[]
  currentId: string | null
  onClose: () => void
  onSelect: (id: string) => void
  onCreate: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

export function NotebookSwitcher({
  open,
  notebooks,
  currentId,
  onClose,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: NotebookSwitcherProps) {
  const { t } = useI18n()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [deleting, setDeleting] = useState<Notebook | null>(null)

  const reset = () => {
    setRenamingId(null)
    setDeleting(null)
  }

  const startRename = (notebook: Notebook) => {
    setRenamingId(notebook.id)
    setDraft(notebook.title)
  }

  const commitRename = (id: string) => {
    const title = draft.trim()
    if (title.length > 0) onRename(id, title)
    setRenamingId(null)
  }

  const confirmDelete = () => {
    if (deleting !== null) onDelete(deleting.id)
    setDeleting(null)
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={() => {
          reset()
          onClose()
        }}
        title={t('switcher.title')}
      >
        <div className="flex flex-col gap-1">
          <Button
            variant="tonal"
            className="mb-2 w-full"
            onClick={() => {
              reset()
              onCreate()
            }}
          >
            <Plus aria-hidden size={18} />
            {t('switcher.create')}
          </Button>
          {notebooks.length === 0 ? (
            <p className="py-6 text-center text-sm text-on-surface-variant">
              {t('switcher.empty')}
            </p>
          ) : (
            notebooks.map((notebook) =>
              renamingId === notebook.id ? (
                <div key={notebook.id} className="flex items-end gap-1 py-1">
                  <div className="min-w-0 flex-1">
                    <Input
                      label={t('switcher.renameLabel')}
                      value={draft}
                      autoFocus
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitRename(notebook.id)
                        if (event.key === 'Escape') setRenamingId(null)
                      }}
                    />
                  </div>
                  <IconButton
                    label={t('switcher.saveRename')}
                    onClick={() => commitRename(notebook.id)}
                  >
                    <Check aria-hidden size={18} />
                  </IconButton>
                  <IconButton
                    label={t('switcher.cancelRename')}
                    onClick={() => setRenamingId(null)}
                  >
                    <X aria-hidden size={18} />
                  </IconButton>
                </div>
              ) : (
                <div key={notebook.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-current={notebook.id === currentId ? 'true' : undefined}
                    onClick={() => {
                      reset()
                      onSelect(notebook.id)
                    }}
                    className={cn(
                      'flex min-h-control-touch min-w-0 flex-1 flex-col justify-center rounded-app-sm px-3 text-start',
                      notebook.id === currentId
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'text-on-surface hover:bg-surface-container-high',
                    )}
                  >
                    <span className="flex items-center gap-2 truncate text-sm font-medium">
                      {notebook.id === currentId ? (
                        <Check aria-hidden size={16} className="shrink-0" />
                      ) : null}
                      {notebook.title}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {t('switcher.updatedAt', {
                        date: new Date(notebook.updatedAt).toLocaleString(),
                      })}
                    </span>
                  </button>
                  <IconButton
                    label={t('switcher.rename', { title: notebook.title })}
                    onClick={() => startRename(notebook)}
                  >
                    <Pencil aria-hidden size={16} />
                  </IconButton>
                  <IconButton
                    label={t('switcher.delete', { title: notebook.title })}
                    onClick={() => setDeleting(notebook)}
                  >
                    <Trash2 aria-hidden size={16} />
                  </IconButton>
                </div>
              ),
            )
          )}
        </div>
      </Sheet>
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('switcher.deleteTitle')}
        description={
          deleting === null ? undefined : t('switcher.deleteDescription', { title: deleting.title })
        }
        actions={
          <>
            <Button variant="text" onClick={() => setDeleting(null)}>
              {t('switcher.cancelDelete')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t('switcher.deleteConfirm')}
            </Button>
          </>
        }
      >
        {null}
      </Dialog>
    </>
  )
}
