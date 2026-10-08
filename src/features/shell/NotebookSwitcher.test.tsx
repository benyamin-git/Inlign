import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Notebook } from '@/data/models/notebook'
import { I18nProvider } from '@/i18n/I18nProvider'
import { NotebookSwitcher, type NotebookSwitcherProps } from './NotebookSwitcher'

const notebooks: Notebook[] = [
  { id: 'b', title: 'Second', content: '', createdAt: 1, updatedAt: 2 },
  { id: 'a', title: 'First', content: '', createdAt: 1, updatedAt: 1 },
]

function renderSwitcher(overrides: Partial<NotebookSwitcherProps> = {}) {
  const props: NotebookSwitcherProps = {
    open: true,
    notebooks,
    currentId: 'b',
    onClose: vi.fn(),
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  }
  render(
    <I18nProvider>
      <NotebookSwitcher {...props} />
    </I18nProvider>,
  )
  return props
}

describe('NotebookSwitcher', () => {
  it('renders nothing while closed', () => {
    renderSwitcher({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lists notebooks in the given order and marks the current one', () => {
    renderSwitcher()
    const dialog = screen.getByRole('dialog', { name: 'Notebooks' })
    const rows = within(dialog)
      .getAllByText(/^(First|Second)$/)
      .map((title) => title.closest('button'))
    expect(rows.map((row) => row?.textContent)).toEqual([
      expect.stringContaining('Second'),
      expect.stringContaining('First'),
    ])
    expect(within(dialog).getByText('Second').closest('button')).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(within(dialog).getByText('First').closest('button')).not.toHaveAttribute('aria-current')
  })

  it('shows an empty message without notebooks', () => {
    renderSwitcher({ notebooks: [], currentId: null })
    expect(screen.getByText('No notebooks yet')).toBeInTheDocument()
  })

  it('selects a notebook and creates a new one', async () => {
    const props = renderSwitcher()
    await userEvent.click(screen.getByText('First'))
    expect(props.onSelect).toHaveBeenCalledWith('a')

    await userEvent.click(screen.getByRole('button', { name: 'New notebook' }))
    expect(props.onCreate).toHaveBeenCalledTimes(1)
  })

  it('renames a notebook inline', async () => {
    const props = renderSwitcher()
    await userEvent.click(screen.getByRole('button', { name: 'Rename Second' }))

    const input = screen.getByLabelText('Notebook name')
    expect(input).toHaveValue('Second')
    await userEvent.clear(input)
    await userEvent.type(input, 'Renamed')
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }))

    expect(props.onRename).toHaveBeenCalledWith('b', 'Renamed')
    expect(screen.queryByLabelText('Notebook name')).not.toBeInTheDocument()
  })

  it('cancels an inline rename', async () => {
    const props = renderSwitcher()
    await userEvent.click(screen.getByRole('button', { name: 'Rename Second' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel rename' }))

    expect(props.onRename).not.toHaveBeenCalled()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('confirms before deleting', async () => {
    const props = renderSwitcher()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Second' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete notebook?' })
    expect(dialog).toHaveTextContent('Second')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(props.onDelete).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Second' }))
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Delete notebook?' })).getByRole('button', {
        name: 'Delete',
      }),
    )
    expect(props.onDelete).toHaveBeenCalledWith('b')
  })
})
