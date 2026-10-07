import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IconButton } from './IconButton'

describe('IconButton', () => {
  it('exposes its aria-label as the accessible name', () => {
    render(
      <IconButton label="Close">
        <svg data-testid="icon" />
      </IconButton>,
    )
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('renders the icon and stays keyboard focusable', () => {
    render(
      <IconButton label="Close">
        <svg data-testid="icon" />
      </IconButton>,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Close' })
    button.focus()
    expect(button).toHaveFocus()
  })

  it('activates on click', async () => {
    const onClick = vi.fn()
    render(
      <IconButton label="Close" onClick={onClick}>
        <svg />
      </IconButton>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
