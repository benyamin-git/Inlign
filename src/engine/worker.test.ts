import { describe, expect, it } from 'vitest'
import { handleRequest } from './worker'
import type { SolveSettings } from './types'

const settings: SolveSettings = { angleMode: 'radians', precision: 12, toleranceOverride: null }

describe('handleRequest', () => {
  it('tags the response with the request version', () => {
    const response = handleRequest({ version: 7, text: '3 + 4', settings })
    expect(response.version).toBe(7)
    expect(response.annotations).toHaveLength(1)
    expect(response.annotations[0]?.text).toBe('7')
  })

  it('answers malformed documents without throwing', () => {
    const response = handleRequest({ version: 2, text: 'sin(\n= =', settings })
    expect(response.version).toBe(2)
    expect(response.annotations).toEqual([])
  })
})
