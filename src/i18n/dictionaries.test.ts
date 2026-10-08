import { describe, expect, it } from 'vitest'
import { en } from './en'
import { translate } from './translate'
import type { Dictionary } from './types'

function collectEntries(node: Dictionary, prefix: string): Array<[string, string]> {
  const entries: Array<[string, string]> = []
  for (const [key, value] of Object.entries(node)) {
    const path = prefix.length > 0 ? `${prefix}.${key}` : key
    if (typeof value === 'string') entries.push([path, value])
    else entries.push(...collectEntries(value, path))
  }
  return entries
}

describe('English dictionary', () => {
  it('resolves every documented key to its value', () => {
    const entries = collectEntries(en, '')
    expect(entries.length).toBeGreaterThan(0)
    for (const [key, value] of entries) {
      expect(translate(en, key)).toBe(value)
    }
  })

  it('names the app', () => {
    expect(translate(en, 'app.name')).toBe('Inlign')
  })
})
