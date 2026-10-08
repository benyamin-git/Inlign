import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n/I18nProvider'
import { ShellTopBar, type ShellTopBarProps } from './TopBar'

function renderTopBar(overrides: Partial<ShellTopBarProps> = {}) {
  const props: ShellTopBarProps = {
    title: 'Notebook',
    saving: false,
    savedAt: null,
    onTitleChange: vi.fn(),
    onOpenSwitcher: vi.fn(),
    onNewNotebook: vi.fn(),
    onExportNotebook: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenHelp: vi.fn(),
    ...overrides,
  }
  render(
    <I18nProvider>
      <ShellTopBar {...props} />
    </I18nProvider>,
  )
  return props
}

describe('ShellTopBar', () => {
  it('renders the title and the shell actions', () => {
    renderTopBar()
    expect(screen.getByLabelText('Notebook title')).toHaveValue('Notebook')
    expect(screen.getByRole('button', { name: 'Notebooks' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New notebook' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export notebook' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument()
  })

  it('commits an edited title on blur', async () => {
    const props = renderTopBar()
    const input = screen.getByLabelText('Notebook title')

    await userEvent.clear(input)
    await userEvent.type(input, 'Renamed')
    fireEvent.blur(input)

    expect(props.onTitleChange).toHaveBeenCalledWith('Renamed')
  })

  it('commits an edited title on Enter', async () => {
    const props = renderTopBar()
    const input = screen.getByLabelText('Notebook title')

    await userEvent.clear(input)
    await userEvent.type(input, 'Renamed{Enter}')

    expect(props.onTitleChange).toHaveBeenCalledWith('Renamed')
  })

  it('reverts an empty title without renaming', async () => {
    const props = renderTopBar()
    const input = screen.getByLabelText('Notebook title')

    await userEvent.clear(input)
    fireEvent.blur(input)

    expect(props.onTitleChange).not.toHaveBeenCalled()
    expect(input).toHaveValue('Notebook')
  })

  it('disables the title and export when no notebook is open', () => {
    renderTopBar({ disabled: true })
    expect(screen.getByLabelText('Notebook title')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export notebook' })).toBeDisabled()
  })

  it('reports the autosave status', () => {
    const { rerender } = render(
      <I18nProvider>
        <ShellTopBar
          title="Notebook"
          saving
          savedAt={null}
          onTitleChange={() => undefined}
          onOpenSwitcher={() => undefined}
          onNewNotebook={() => undefined}
          onExportNotebook={() => undefined}
          onOpenSettings={() => undefined}
          onOpenHelp={() => undefined}
        />
      </I18nProvider>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Saving…')

    rerender(
      <I18nProvider>
        <ShellTopBar
          title="Notebook"
          saving={false}
          savedAt={123}
          onTitleChange={() => undefined}
          onOpenSwitcher={() => undefined}
          onNewNotebook={() => undefined}
          onExportNotebook={() => undefined}
          onOpenSettings={() => undefined}
          onOpenHelp={() => undefined}
        />
      </I18nProvider>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
  })

  it('calls the action handlers', async () => {
    const props = renderTopBar()
    await userEvent.click(screen.getByRole('button', { name: 'Notebooks' }))
    await userEvent.click(screen.getByRole('button', { name: 'New notebook' }))
    await userEvent.click(screen.getByRole('button', { name: 'Export notebook' }))
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
    await userEvent.click(screen.getByRole('button', { name: 'Help' }))

    expect(props.onOpenSwitcher).toHaveBeenCalledTimes(1)
    expect(props.onNewNotebook).toHaveBeenCalledTimes(1)
    expect(props.onExportNotebook).toHaveBeenCalledTimes(1)
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1)
    expect(props.onOpenHelp).toHaveBeenCalledTimes(1)
  })
})
