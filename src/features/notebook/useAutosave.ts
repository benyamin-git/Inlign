import { useCallback, useEffect, useRef, useState } from 'react'
import { getNotebook, updateContent } from '@/data/repositories/notebooks'

export const AUTOSAVE_DEBOUNCE_MS = 400

export interface AutosaveState {
  saving: boolean
  savedAt: number | null
}

interface PendingWrite {
  id: string
  content: string
}

function signatureOf(id: string, content: string): string {
  return `${id}\u0000${content}`
}

export function useAutosave(notebookId: string | null, content: string): AutosaveState {
  const [savedSignature, setSavedSignature] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const pendingRef = useRef<PendingWrite | null>(null)
  const writeRef = useRef(0)

  const signature = notebookId === null ? null : signatureOf(notebookId, content)
  const saving = signature !== null && signature !== savedSignature

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const pending = pendingRef.current
    pendingRef.current = null
    if (pending === null) return
    const write = writeRef.current + 1
    writeRef.current = write
    const pendingSignature = signatureOf(pending.id, pending.content)
    void (async () => {
      try {
        const existing = await getNotebook(pending.id)
        if (existing !== undefined && existing.content !== pending.content) {
          await updateContent(pending.id, pending.content)
          if (writeRef.current === write) setSavedAt(Date.now())
        }
      } catch {
        // A failed write stays quiet; the next edit schedules another attempt.
      } finally {
        if (writeRef.current === write) setSavedSignature(pendingSignature)
      }
    })()
  }, [])

  useEffect(() => {
    if (notebookId === null) {
      pendingRef.current = null
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }
    const pending = pendingRef.current
    if (pending !== null && pending.id !== notebookId) flush()
    pendingRef.current = { id: notebookId, content }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(flush, AUTOSAVE_DEBOUNCE_MS)
  }, [notebookId, content, flush])

  useEffect(() => {
    const onFlush = () => flush()
    window.addEventListener('blur', onFlush)
    window.addEventListener('beforeunload', onFlush)
    return () => {
      window.removeEventListener('blur', onFlush)
      window.removeEventListener('beforeunload', onFlush)
      flush()
    }
  }, [flush])

  return { saving, savedAt }
}
