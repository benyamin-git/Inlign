export type AccentId = 'blue' | 'teal' | 'green' | 'orange' | 'rose' | 'violet'

export const ACCENTS: Record<AccentId, { hue: number; chroma: number }> = {
  blue: { hue: 255, chroma: 0.21 },
  teal: { hue: 195, chroma: 0.16 },
  green: { hue: 145, chroma: 0.19 },
  orange: { hue: 45, chroma: 0.21 },
  rose: { hue: 15, chroma: 0.21 },
  violet: { hue: 300, chroma: 0.2 },
}

export const DEFAULT_ACCENT: AccentId = 'blue'

// The documented primaries from the design skill's house style, per theme.
// scripts/generate-accents.mjs must derive exactly these; theme.test.ts fails
// if the generated palette drifts from them.
export const ACCENT_PRIMARIES: Record<AccentId, { light: string; dark: string }> = {
  blue: { light: '#35639c', dark: '#7daeec' },
  teal: { light: '#127070', dark: '#69bbba' },
  green: { light: '#3c703f', dark: '#4bc957' },
  orange: { light: '#924c2b', dark: '#e29572' },
  rose: { light: '#94464e', dark: '#e58f95' },
  violet: { light: '#7638c0', dark: '#b49ce1' },
}

export const ACCENT_STORAGE_KEY = 'inlign.accent'

const ACCENT_IDS = Object.keys(ACCENTS) as AccentId[]

export function isAccentId(value: unknown): value is AccentId {
  return typeof value === 'string' && (ACCENT_IDS as readonly string[]).includes(value)
}

export function getStoredAccent(): AccentId {
  try {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY)
    if (isAccentId(stored)) return stored
  } catch {
    // storage unavailable
  }
  const applied = document.documentElement.dataset.accent
  if (isAccentId(applied)) return applied
  return DEFAULT_ACCENT
}

export function writeStoredAccent(accent: AccentId): void {
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, accent)
  } catch {
    // storage unavailable
  }
}

export function applyAccent(accent: AccentId): void {
  document.documentElement.dataset.accent = accent
}
