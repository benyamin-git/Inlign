import { describe, expect, it } from 'vitest'
import { en } from '@/i18n/en'
import { translate } from '@/i18n/translate'
import { docRegistry } from './registry'

describe('docRegistry', () => {
  it('lists each documentation page once', () => {
    const ids = docRegistry.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(
      ['checking', 'data', 'engine-limits', 'getting-started', 'syntax'].sort(),
    )
  })

  it('resolves every title and summary through the English dictionary', () => {
    for (const entry of docRegistry) {
      expect(translate(en, entry.titleKey)).not.toBe(entry.titleKey)
      expect(translate(en, entry.summaryKey)).not.toBe(entry.summaryKey)
    }
  })

  it('loads a Markdown body with a heading for every entry', async () => {
    for (const entry of docRegistry) {
      await expect(entry.body()).resolves.toMatch(/^#{1,6}\s+\S/m)
    }
  })
})
