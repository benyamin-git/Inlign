import { EditorView } from '@codemirror/view'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/data/db'
import { createNotebook, getNotebook, listNotebooks } from '@/data/repositories/notebooks'
import { I18nProvider } from '@/i18n/I18nProvider'
import { MockWorker } from '@/test/mockWorker'
import {
  AppShell,
  type AppShellProps,
  type HelpSheetState,
  type SettingsSheetState,
} from './AppShell'

function renderShell(props: AppShellProps = {}) {
  return render(
    <I18nProvider>
      <AppShell {...props} />
    </I18nProvider>,
  )
}

async function bumpUpdatedAt(id: string): Promise<void> {
  await db.notebooks.update(id, { updatedAt: Date.now() + 10_000 })
}

beforeEach(async () => {
  await db.notebooks.clear()
  await db.settings.clear()
  MockWorker.reset()
  vi.stubGlobal('Worker', MockWorker)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('AppShell', () => {
  it('opens the most recently updated notebook in the editor', async () => {
    await createNotebook('Older', 'older = 1')
    const newer = await createNotebook('Newer', 'newer = 2')
    await bumpUpdatedAt(newer.id)

    renderShell()

    expect(await screen.findByDisplayValue('Newer')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Notebook editor' })).toHaveTextContent('newer = 2')
  })

  it('creates a notebook from the top bar and selects it', async () => {
    const user = userEvent.setup()
    await createNotebook('Only', 'x = 1')
    renderShell()
    await screen.findByDisplayValue('Only')

    await user.click(screen.getByRole('button', { name: 'New notebook' }))

    await waitFor(async () => {
      expect(await listNotebooks()).toHaveLength(2)
    })
    expect(await screen.findByDisplayValue('Untitled')).toBeInTheDocument()
  })

  it('renames the current notebook from the title input', async () => {
    const user = userEvent.setup()
    const notebook = await createNotebook('Original', 'x = 1')
    renderShell()
    const input = await screen.findByDisplayValue('Original')

    await user.clear(input)
    await user.type(input, 'Renamed')
    await user.tab()

    await waitFor(async () => {
      expect((await getNotebook(notebook.id))?.title).toBe('Renamed')
    })
  })

  it('switches notebooks through the switcher sheet', async () => {
    const user = userEvent.setup()
    await createNotebook('First', 'first = 1')
    const second = await createNotebook('Second', 'second = 2')
    await bumpUpdatedAt(second.id)
    renderShell()
    await screen.findByDisplayValue('Second')

    await user.click(screen.getByRole('button', { name: 'Notebooks' }))
    const sheet = await screen.findByRole('dialog', { name: 'Notebooks' })
    await user.click(within(sheet).getByText('First'))

    await waitFor(() => {
      expect(screen.getByLabelText('Notebook title')).toHaveValue('First')
    })
    expect(screen.getByRole('textbox', { name: 'Notebook editor' })).toHaveTextContent('first = 1')
  })

  it('deletes a notebook after confirming, falling back to the next one', async () => {
    const user = userEvent.setup()
    await createNotebook('Keep', 'keep = 1')
    const doomed = await createNotebook('Doomed', 'doomed = 1')
    await bumpUpdatedAt(doomed.id)
    renderShell()
    await screen.findByDisplayValue('Doomed')

    await user.click(screen.getByRole('button', { name: 'Notebooks' }))
    await user.click(await screen.findByRole('button', { name: 'Delete Doomed' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete notebook?' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(await listNotebooks()).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Delete Doomed' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Delete notebook?' })).getByRole('button', {
        name: 'Delete',
      }),
    )

    await waitFor(async () => {
      expect(await listNotebooks()).toHaveLength(1)
    })
    await waitFor(() => {
      expect(screen.getByLabelText('Notebook title')).toHaveValue('Keep')
    })
  })

  it('shows the empty state after deleting the last notebook', async () => {
    const user = userEvent.setup()
    await createNotebook('Only', 'x = 1')
    renderShell()
    await screen.findByDisplayValue('Only')

    await user.click(screen.getByRole('button', { name: 'Notebooks' }))
    await user.click(await screen.findByRole('button', { name: 'Delete Only' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Delete notebook?' })).getByRole('button', {
        name: 'Delete',
      }),
    )

    expect(await screen.findByText('No notebook open')).toBeInTheDocument()
    expect(
      within(screen.getByRole('main')).getByRole('button', { name: 'New notebook' }),
    ).toBeInTheDocument()
  })

  it('opens the settings sheet through the action and the shortcut', async () => {
    const user = userEvent.setup()
    await createNotebook('Only', 'x = 1')
    const settingsSheet = vi.fn((state: SettingsSheetState) =>
      state.open ? (
        <button type="button" onClick={state.onClose}>
          close-settings
        </button>
      ) : null,
    )
    renderShell({ settingsSheet })
    await screen.findByDisplayValue('Only')

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(await screen.findByRole('button', { name: 'close-settings' }))
    await waitFor(() => {
      expect(settingsSheet).toHaveBeenCalledWith(expect.objectContaining({ open: false }))
    })

    fireEvent.keyDown(window, { key: ',', ctrlKey: true })
    expect(await screen.findByRole('button', { name: 'close-settings' })).toBeInTheDocument()
  })

  it('opens the help sheet through the action and the shortcut', async () => {
    const user = userEvent.setup()
    await createNotebook('Only', 'x = 1')
    const helpSheet = vi.fn((state: HelpSheetState) =>
      state.open ? (
        <button type="button" onClick={state.onClose}>
          close-help
        </button>
      ) : null,
    )
    renderShell({ helpSheet })
    await screen.findByDisplayValue('Only')

    await user.click(screen.getByRole('button', { name: 'Help' }))
    await user.click(await screen.findByRole('button', { name: 'close-help' }))
    await waitFor(() => {
      expect(helpSheet).toHaveBeenCalledWith(expect.objectContaining({ open: false }))
    })

    fireEvent.keyDown(window, { key: '/', ctrlKey: true })
    expect(await screen.findByRole('button', { name: 'close-help' })).toBeInTheDocument()
  })

  it('opens the switcher through Mod+K', async () => {
    await createNotebook('Only', 'x = 1')
    renderShell()
    await screen.findByDisplayValue('Only')

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(await screen.findByRole('dialog', { name: 'Notebooks' })).toBeInTheDocument()
  })

  it('exports the current notebook as an .inlign download', async () => {
    const user = userEvent.setup()
    await createNotebook('Ball drop', 'h = 20')
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:notebook')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    renderShell()
    await screen.findByDisplayValue('Ball drop')

    await user.click(screen.getByRole('button', { name: 'Export notebook' }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(await blob.text()).toBe('h = 20')
    const anchor = click.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe('Ball drop.inlign')
  })

  it('autosaves editor changes after the debounce', async () => {
    const notebook = await createNotebook('Notes', 'x = 1')
    renderShell()
    await screen.findByDisplayValue('Notes')

    const content = screen.getByRole('textbox', { name: 'Notebook editor' })
    const view = EditorView.findFromDOM(content)
    if (view === null) throw new Error('editor view missing')
    act(() => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'x = 2' } })
    })

    await waitFor(
      async () => {
        expect((await getNotebook(notebook.id))?.content).toBe('x = 2')
      },
      { timeout: 3000 },
    )
  })
})
