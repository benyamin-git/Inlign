export interface AppShortcuts {
  newNotebook(): void
  openSwitcher(): void
  exportNotebook(): void
  openSettings(): void
}

interface ShortcutBinding {
  key: string
  run(actions: AppShortcuts): void
}

const SHORTCUTS: readonly ShortcutBinding[] = [
  { key: 'n', run: (actions) => actions.newNotebook() },
  { key: 'k', run: (actions) => actions.openSwitcher() },
  { key: 'e', run: (actions) => actions.exportNotebook() },
  { key: ',', run: (actions) => actions.openSettings() },
]

export function registerAppShortcuts(actions: AppShortcuts): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (!event.metaKey && !event.ctrlKey) return
    if (event.altKey || event.shiftKey) return
    const binding = SHORTCUTS.find((candidate) => candidate.key === event.key.toLowerCase())
    if (binding === undefined) return
    event.preventDefault()
    binding.run(actions)
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}
