import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders with an accessible name and defaults to type button', () => {
    render(<Button>Compute</Button>)
    expect(screen.getByRole('button', { name: 'Compute' })).toHaveAttribute('type', 'button')
  })

  it('calls onClick when activated', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Compute</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Compute' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('exposes disabled semantics and blocks clicks', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Compute
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Compute' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('is keyboard focusable', () => {
    render(<Button>Compute</Button>)
    const button = screen.getByRole('button', { name: 'Compute' })
    button.focus()
    expect(button).toHaveFocus()
  })

  it('renders every variant and merges extra classes', () => {
    render(
      <>
        <Button variant="filled">Filled</Button>
        <Button variant="tonal">Tonal</Button>
        <Button variant="text" className="w-full">
          Text
        </Button>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Filled' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tonal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Text' })).toHaveClass('w-full')
  })
})
