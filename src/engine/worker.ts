import { solveDocument } from './index'
import type { SolveRequest, SolveResponse } from './types'

export function handleRequest(request: SolveRequest): SolveResponse {
  try {
    return { version: request.version, annotations: solveDocument(request.text, request.settings) }
  } catch {
    return { version: request.version, annotations: [] }
  }
}

if (typeof window === 'undefined' && typeof self !== 'undefined') {
  self.onmessage = (event: MessageEvent<SolveRequest>) => {
    self.postMessage(handleRequest(event.data))
  }
}
