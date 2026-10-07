import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Sheet } from './Sheet'

describe('Sheet', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <Sheet open={false} onClose={() => undefined} title="Settings">
        <p>Body</p>
      </Sheet>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a labelled modal dialog', () => {
    render(
      <Sheet open onClose={() => undefined} title="Settings">
        <p>Body</p>
      </Sheet>,
    )
    expect(screen.getByRole('dialog', { name: 'Settings' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Body')).toBeInTheDocument()
  })

  it('focuses the panel when opened', () => {
    render(
      <Sheet open onClose={() => undefined} title="Settings">
        <p>Body</p>
      </Sheet>,
    )
    expect(screen.getByRole('dialog', { name: 'Settings' })).toHaveFocus()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Settings">
        <p>Body</p>
      </Sheet>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('offers a labelled close control', async () => {
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Settings">
        <p>Body</p>
      </Sheet>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
