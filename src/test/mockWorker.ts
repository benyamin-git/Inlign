import { vi } from 'vitest'
import type { SolveResponse } from '@/engine/types'

export class MockWorker {
  static instances: MockWorker[] = []

  readonly url: unknown
  readonly options: unknown
  onmessage: ((event: MessageEvent<SolveResponse>) => void) | null = null
  readonly postMessage = vi.fn()
  readonly terminate = vi.fn()

  constructor(url: unknown, options?: unknown) {
    this.url = url
    this.options = options
    MockWorker.instances.push(this)
  }

  emit(response: SolveResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<SolveResponse>)
  }

  static reset(): void {
    MockWorker.instances = []
  }
}
