import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

describe('Dialog', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <Dialog open={false} onClose={() => undefined} title="Delete notebook">
        <p>Body</p>
      </Dialog>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a labelled modal dialog with a description', () => {
    render(
      <Dialog
        open
        onClose={() => undefined}
        title="Delete notebook"
        description="This cannot be undone"
      >
        <p>Body</p>
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Delete notebook' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('This cannot be undone')
  })

  it('focuses the dialog when opened', () => {
    render(
      <Dialog open onClose={() => undefined} title="Delete notebook">
        <p>Body</p>
      </Dialog>,
    )
    expect(screen.getByRole('dialog', { name: 'Delete notebook' })).toHaveFocus()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="Delete notebook">
        <p>Body</p>
      </Dialog>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('groups its actions', () => {
    render(
      <Dialog
        open
        onClose={() => undefined}
        title="Delete notebook"
        actions={<button>Delete</button>}
      >
        <p>Body</p>
      </Dialog>,
    )
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})
