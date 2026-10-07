export type ThemeChoice = 'system' | 'light' | 'dark' | 'oled'

export type ResolvedTheme = 'light' | 'dark' | 'oled'

export const THEME_STORAGE_KEY = 'inlign.theme'

const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark', 'oled']

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === 'string' && (THEME_CHOICES as readonly string[]).includes(value)
}

export function getStoredTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemeChoice(stored)) return stored
  } catch {
    // storage unavailable
  }
  const applied = document.documentElement.dataset.theme
  if (applied === 'light' || applied === 'dark' || applied === 'oled') return applied
  return 'system'
}

export function writeStoredTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    // storage unavailable
  }
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === 'system') {
    // OLED is never auto-selected; it is opt-in.
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return choice
}

export function applyTheme(choice: ThemeChoice): void {
  const resolved = resolveTheme(choice)
  const root = document.documentElement
  root.dataset.theme = resolved
  root.style.colorScheme = resolved === 'light' ? 'light' : 'dark'
}

export function initTheme(): void {
  applyTheme(getStoredTheme())
}
