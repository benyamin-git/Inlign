/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACCENT_PRIMARIES,
  ACCENTS,
  DEFAULT_ACCENT,
  getStoredAccent,
  isAccentId,
  writeStoredAccent,
} from './accents'
import { applyTheme, getStoredTheme, initTheme, resolveTheme, writeStoredTheme } from './theme'
import { ACCENT_SEEDS, renderAccentsCss } from '../../scripts/generate-accents.mjs'

const accentsCss = readFileSync(resolve(process.cwd(), 'src/theme/accents.css'), 'utf8')
const tokensCss = readFileSync(resolve(process.cwd(), 'src/theme/tokens.css'), 'utf8')

function withPrefersDark(matches: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-accent')
  document.documentElement.style.colorScheme = ''
  vi.restoreAllMocks()
})

describe('theme choice storage', () => {
  it('defaults to system when nothing is stored or applied', () => {
    expect(getStoredTheme()).toBe('system')
  })

  it('round-trips a stored choice', () => {
    writeStoredTheme('oled')
    expect(getStoredTheme()).toBe('oled')
  })

  it('ignores an unknown stored value', () => {
    localStorage.setItem('inlign.theme', 'sepia')
    expect(getStoredTheme()).toBe('system')
  })

  it('reads the theme already applied to the document', () => {
    document.documentElement.dataset.theme = 'dark'
    expect(getStoredTheme()).toBe('dark')
  })
})

describe('theme resolution', () => {
  it('follows prefers-color-scheme for system', () => {
    withPrefersDark(true)
    expect(resolveTheme('system')).toBe('dark')
    withPrefersDark(false)
    expect(resolveTheme('system')).toBe('light')
  })

  it('never auto-selects OLED', () => {
    withPrefersDark(true)
    expect(resolveTheme('system')).not.toBe('oled')
  })

  it('applies explicit choices as-is', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('oled')).toBe('oled')
  })
})

describe('applying the theme', () => {
  it('writes data-theme and color-scheme for OLED', () => {
    applyTheme('oled')
    expect(document.documentElement.dataset.theme).toBe('oled')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('writes light color-scheme for light', () => {
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('initTheme applies the stored choice', () => {
    withPrefersDark(true)
    writeStoredTheme('light')
    initTheme()
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})

describe('accent data', () => {
  it('ships the six house accents with blue as default', () => {
    expect(Object.keys(ACCENTS)).toEqual(['blue', 'teal', 'green', 'orange', 'rose', 'violet'])
    expect(DEFAULT_ACCENT).toBe('blue')
  })

  it('validates accent ids', () => {
    expect(isAccentId('rose')).toBe(true)
    expect(isAccentId('rainbow')).toBe(false)
    expect(isAccentId(42)).toBe(false)
  })

  it('keeps the generator seeds in sync with accents.ts', () => {
    expect(ACCENT_SEEDS).toEqual(ACCENTS)
  })

  it('ships the documented primary per accent and theme', () => {
    for (const primaries of Object.values(ACCENT_PRIMARIES)) {
      expect(accentsCss).toContain(`--md-sys-color-primary: ${primaries.light};`)
      expect(accentsCss).toContain(`--md-sys-color-primary: ${primaries.dark};`)
    }
  })
})

describe('accent storage', () => {
  it('reads the accent already applied to the document', () => {
    document.documentElement.dataset.accent = 'teal'
    expect(getStoredAccent()).toBe('teal')
  })

  it('round-trips a stored accent', () => {
    writeStoredAccent('rose')
    expect(getStoredAccent()).toBe('rose')
  })

  it('ignores an unknown stored accent and falls back to the default', () => {
    localStorage.setItem('inlign.accent', 'rainbow')
    expect(getStoredAccent()).toBe(DEFAULT_ACCENT)
  })
})

describe('generated accent palettes', () => {
  it('matches the checked-in accents.css exactly', () => {
    expect(accentsCss).toBe(renderAccentsCss())
  })

  it('covers every accent in all three themes', () => {
    for (const id of Object.keys(ACCENTS)) {
      for (const theme of ['light', 'dark', 'oled']) {
        expect(accentsCss).toContain(`[data-theme='${theme}'][data-accent='${id}']`)
      }
    }
  })

  it('keeps the fixed OLED neutrals in tokens.css', () => {
    expect(tokensCss).toContain('--md-sys-color-background: #000000;')
    expect(tokensCss).toContain('--md-sys-color-outline: #6f6a74;')
    expect(tokensCss).toContain('--md-sys-color-surface-container-highest: #1f1f23;')
  })
})
