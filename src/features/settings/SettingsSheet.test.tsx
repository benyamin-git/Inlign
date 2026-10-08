import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildBackup } from '@/data/backup'
import { db } from '@/data/db'
import { createNotebook, listNotebooks } from '@/data/repositories/notebooks'
import { getSettings } from '@/data/repositories/settings'
import { AppShell } from '@/features/shell/AppShell'
import { I18nProvider } from '@/i18n/I18nProvider'
import { MockWorker } from '@/test/mockWorker'
import { SettingsSheet, type SettingsSheetProps } from './SettingsSheet'

function renderSheet(overrides: Partial<SettingsSheetProps> = {}) {
  const props: SettingsSheetProps = {
    open: true,
    onClose: vi.fn(),
    notebook: null,
    onNotebookImported: vi.fn(),
    ...overrides,
  }
  render(
    <I18nProvider>
      <SettingsSheet {...props} />
    </I18nProvider>,
  )
  return props
}

function stubFilePicker(): { input(): HTMLInputElement } {
  const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined)
  return {
    input() {
      const captured = click.mock.instances.at(-1) as HTMLInputElement | undefined
      if (captured === undefined) throw new Error('no file input was opened')
      return captured
    },
  }
}

function pickFile(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change'))
}

beforeEach(async () => {
  await db.notebooks.clear()
  await db.settings.clear()
  document.documentElement.removeAttribute('data-accent')
  MockWorker.reset()
  vi.stubGlobal('Worker', MockWorker)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('SettingsSheet', () => {
  it('renders the stored defaults', async () => {
    renderSheet()

    expect(await screen.findByLabelText('Precision')).toHaveValue('12')
    expect(screen.getByRole('switch', { name: 'Tolerance override' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(screen.getByLabelText('Angle mode')).toHaveValue('radians')
    expect(screen.getByLabelText('Theme')).toHaveValue('system')
    expect(screen.getByRole('radio', { name: 'Blue' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Rose' })).toHaveAttribute('aria-checked', 'false')
  })

  it('persists a precision change', async () => {
    const user = userEvent.setup()
    renderSheet()

    await user.selectOptions(screen.getByLabelText('Precision'), '9')

    await waitFor(async () => {
      expect((await getSettings()).precision).toBe(9)
    })
  })

  it('persists the angle mode', async () => {
    const user = userEvent.setup()
    renderSheet()

    await user.selectOptions(screen.getByLabelText('Angle mode'), 'degrees')

    await waitFor(async () => {
      expect((await getSettings()).angleMode).toBe('degrees')
    })
  })

  it('applies theme and accent immediately and mirrors them for the pre-paint script', async () => {
    const user = userEvent.setup()
    renderSheet()

    await user.selectOptions(screen.getByLabelText('Theme'), 'dark')
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark')
    })
    expect(localStorage.getItem('inlign.theme')).toBe('dark')

    await user.click(screen.getByRole('radio', { name: 'Rose' }))
    await waitFor(() => {
      expect(document.documentElement.dataset.accent).toBe('rose')
    })
    expect(localStorage.getItem('inlign.accent')).toBe('rose')
  })

  it('toggles the tolerance override on, edits it, and turns it off', async () => {
    const user = userEvent.setup()
    renderSheet()

    await user.click(screen.getByRole('switch', { name: 'Tolerance override' }))
    await waitFor(async () => {
      expect((await getSettings()).toleranceOverride).toBe(0.001)
    })

    const input = await screen.findByLabelText('Relative tolerance')
    await user.clear(input)
    await user.type(input, '0.05')
    await user.tab()
    await waitFor(async () => {
      expect((await getSettings()).toleranceOverride).toBe(0.05)
    })

    await user.click(screen.getByRole('switch', { name: 'Tolerance override' }))
    await waitFor(async () => {
      expect((await getSettings()).toleranceOverride).toBeNull()
    })
  })

  it('disables notebook export without an open notebook', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Export notebook' })).toBeDisabled()
  })

  it('imports a notebook and reports it', async () => {
    const user = userEvent.setup()
    const picker = stubFilePicker()
    const props = renderSheet()

    await user.click(screen.getByRole('button', { name: 'Import .inlign' }))
    pickFile(picker.input(), new File(['x = 1'], 'calc.inlign', { type: 'text/plain' }))

    expect(await screen.findByText('Imported “calc”.')).toBeInTheDocument()
    expect(props.onNotebookImported).toHaveBeenCalledTimes(1)
    expect((await listNotebooks()).map((notebook) => notebook.title)).toEqual(['calc'])
  })

  it('restores a backup after confirmation', async () => {
    const user = userEvent.setup()
    await createNotebook('Old', 'old = 1')
    const backup = await buildBackup()
    await db.notebooks.clear()
    await db.settings.clear()
    const picker = stubFilePicker()
    renderSheet()

    await user.click(screen.getByRole('button', { name: 'Restore backup' }))
    const dialog = await screen.findByRole('dialog', { name: 'Restore backup?' })
    await user.click(within(dialog).getByRole('button', { name: 'Restore' }))
    pickFile(
      picker.input(),
      new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' }),
    )

    expect(await screen.findByText('Backup restored.')).toBeInTheDocument()
    expect((await listNotebooks()).map((notebook) => notebook.title)).toEqual(['Old'])
  })

  it('reports a failed restore when the backup does not parse', async () => {
    const user = userEvent.setup()
    const picker = stubFilePicker()
    renderSheet()

    await user.click(screen.getByRole('button', { name: 'Restore backup' }))
    const dialog = await screen.findByRole('dialog', { name: 'Restore backup?' })
    await user.click(within(dialog).getByRole('button', { name: 'Restore' }))
    pickFile(picker.input(), new File(['not json'], 'backup.json', { type: 'application/json' }))

    expect(
      await screen.findByText('Something went wrong. Nothing was changed.'),
    ).toBeInTheDocument()
    expect(await listNotebooks()).toHaveLength(0)
  })
})

describe('settings integration', () => {
  it('re-solves the editor when precision changes', async () => {
    const user = userEvent.setup()
    await createNotebook('Notes', 'x = 1')
    render(
      <I18nProvider>
        <AppShell settingsSheet={(state) => <SettingsSheet {...state} />} />
      </I18nProvider>,
    )
    await screen.findByDisplayValue('Notes')
    const worker = MockWorker.instances[0]
    if (worker === undefined) throw new Error('worker was not created')

    await waitFor(
      () => {
        expect(worker.postMessage).toHaveBeenCalledTimes(1)
      },
      { timeout: 2000 },
    )

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.selectOptions(await screen.findByLabelText('Precision'), '8')

    await waitFor(() => {
      expect(worker.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({ precision: 8 }),
        }),
      )
    })
  })
})
