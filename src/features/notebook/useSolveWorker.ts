import { useCallback, useEffect, useRef, useState } from 'react'
import type { Annotation, SolveRequest, SolveResponse, SolveSettings } from '@/engine/types'
import { SOLVE_DEBOUNCE_MS } from './constants'

export interface SolveWorker {
  annotations: Annotation[]
  requestSolve(text: string): void
}

export function useSolveWorker(settings: SolveSettings): SolveWorker {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const workerRef = useRef<Worker | null>(null)
  const versionRef = useRef(0)
  const latestVersionRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const textRef = useRef<string | null>(null)
  const settingsRef = useRef(settings)

  const flush = useCallback(() => {
    const worker = workerRef.current
    const text = textRef.current
    if (worker === null || text === null) return
    versionRef.current += 1
    latestVersionRef.current = versionRef.current
    const request: SolveRequest = {
      version: versionRef.current,
      text,
      settings: settingsRef.current,
    }
    worker.postMessage(request)
  }, [])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    const worker = new Worker(new URL('../../engine/worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (event: MessageEvent<SolveResponse>) => {
      if (event.data.version !== latestVersionRef.current) return
      setAnnotations(event.data.annotations)
    }
    workerRef.current = worker
    return () => {
      worker.terminate()
      workerRef.current = null
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  const requestSolve = useCallback(
    (text: string) => {
      textRef.current = text
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        flush()
      }, SOLVE_DEBOUNCE_MS)
    },
    [flush],
  )

  useEffect(() => {
    if (textRef.current === null || timerRef.current !== null) return
    flush()
  }, [settings.angleMode, settings.precision, settings.toleranceOverride, flush])

  return { annotations, requestSolve }
}
