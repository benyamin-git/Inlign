import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import { ArrowLeft } from 'lucide-react'
import { docRegistry, type DocId } from '@/docs/registry'
import { useI18n } from '@/i18n/I18nProvider'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'

export interface HelpSheetProps {
  open: boolean
  onClose: () => void
}

const MARKDOWN_CLASSES = cn(
  'text-sm leading-relaxed text-on-surface',
  '[&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold',
  '[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold',
  '[&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold',
  '[&_p]:my-2',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:ps-5',
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:ps-5',
  '[&_li]:my-1',
  '[&_a]:text-primary [&_a]:underline',
  '[&_code]:rounded-app-sm [&_code]:bg-surface-container-high [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs',
  '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-app-md [&_pre]:bg-surface-container-high [&_pre]:p-3',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_strong]:font-semibold',
  '[&_blockquote]:my-2 [&_blockquote]:border-s-2 [&_blockquote]:border-outline-variant [&_blockquote]:ps-3',
)

export function HelpSheet({ open, onClose }: HelpSheetProps) {
  const { t } = useI18n()
  const [selectedId, setSelectedId] = useState<DocId | null>(null)
  const [body, setBody] = useState<string | null>(null)

  const selected =
    selectedId === null ? null : (docRegistry.find((entry) => entry.id === selectedId) ?? null)

  useEffect(() => {
    if (selected === null) return
    let cancelled = false
    void selected
      .body()
      .then((text) => {
        if (!cancelled) setBody(text)
      })
      .catch(() => {
        if (!cancelled) setBody(null)
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  const handleSelect = (id: DocId) => {
    setSelectedId(id)
    setBody(null)
  }

  const handleBack = () => {
    setSelectedId(null)
    setBody(null)
  }

  const handleClose = () => {
    setSelectedId(null)
    setBody(null)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={selected === null ? t('docs.title') : t(selected.titleKey)}
    >
      {selected === null ? (
        <nav aria-label={t('docs.title')}>
          <ul className="flex flex-col gap-2">
            {docRegistry.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(entry.id)}
                  className="flex w-full flex-col gap-1 rounded-app-md border border-outline-variant px-3 py-3 text-start transition-colors hover:bg-surface-container-high focus-visible:bg-surface-container-high"
                >
                  <span className="text-sm font-medium text-on-surface">{t(entry.titleKey)}</span>
                  <span className="text-sm text-on-surface-variant">{t(entry.summaryKey)}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <div className="flex flex-col gap-2">
          <Button variant="text" className="self-start" onClick={handleBack}>
            <ArrowLeft aria-hidden size={18} />
            {t('docs.back')}
          </Button>
          <div className={MARKDOWN_CLASSES}>
            <Markdown>{body ?? ''}</Markdown>
          </div>
        </div>
      )}
    </Sheet>
  )
}
