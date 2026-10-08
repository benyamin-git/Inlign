import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerAppShortcuts, type AppShortcuts } from './shortcuts'

function createActions(): AppShortcuts {
  return {
    newNotebook: vi.fn(),
    openSwitcher: vi.fn(),
    exportNotebook: vi.fn(),
    openSettings: vi.fn(),
    openHelp: vi.fn(),
  }
}

interface Modifiers {
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
}

function press(key: string, modifiers: Modifiers = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: modifiers.ctrl ?? false,
    metaKey: modifiers.meta ?? false,
    shiftKey: modifiers.shift ?? false,
    altKey: modifiers.alt ?? false,
    cancelable: true,
  })
  window.dispatchEvent(event)
  return event
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('registerAppShortcuts', () => {
  it('maps Mod+N, Mod+K, Mod+E, Mod+comma and Mod+slash to their actions', () => {
    const actions = createActions()
    const unregister = registerAppShortcuts(actions)

    press('n', { ctrl: true })
    press('k', { meta: true })
    press('e', { ctrl: true })
    press(',', { ctrl: true })
    press('/', { ctrl: true })

    expect(actions.newNotebook).toHaveBeenCalledTimes(1)
    expect(actions.openSwitcher).toHaveBeenCalledTimes(1)
    expect(actions.exportNotebook).toHaveBeenCalledTimes(1)
    expect(actions.openSettings).toHaveBeenCalledTimes(1)
    expect(actions.openHelp).toHaveBeenCalledTimes(1)
    unregister()
  })

  it('accepts meta on macOS for every binding', () => {
    const actions = createActions()
    const unregister = registerAppShortcuts(actions)

    press('n', { meta: true })
    press('k', { meta: true })
    press('e', { meta: true })
    press(',', { meta: true })
    press('/', { meta: true })

    expect(actions.newNotebook).toHaveBeenCalledTimes(1)
    expect(actions.openSwitcher).toHaveBeenCalledTimes(1)
    expect(actions.exportNotebook).toHaveBeenCalledTimes(1)
    expect(actions.openSettings).toHaveBeenCalledTimes(1)
    expect(actions.openHelp).toHaveBeenCalledTimes(1)
    unregister()
  })

  it('prevents the browser default for matched shortcuts', () => {
    const unregister = registerAppShortcuts(createActions())
    expect(press('n', { ctrl: true }).defaultPrevented).toBe(true)
    unregister()
  })

  it('ignores unmodified keys and extra modifiers', () => {
    const actions = createActions()
    const unregister = registerAppShortcuts(actions)

    press('n')
    press('n', { ctrl: true, shift: true })
    press('n', { ctrl: true, alt: true })
    press('x', { ctrl: true })

    expect(actions.newNotebook).not.toHaveBeenCalled()
    unregister()
  })

  it('stops handling keys after unregistration', () => {
    const actions = createActions()
    registerAppShortcuts(actions)()
    press('k', { ctrl: true })
    expect(actions.openSwitcher).not.toHaveBeenCalled()
  })
})
