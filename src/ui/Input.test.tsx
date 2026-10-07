import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Input } from './Input'

describe('Input', () => {
  it('associates its always-visible label', () => {
    render(<Input label="Tolerance" />)
    expect(screen.getByLabelText('Tolerance')).toBeInstanceOf(HTMLInputElement)
  })

  it('describes the input with a hint', () => {
    render(<Input label="Tolerance" hint="Applies to every claim" />)
    const input = screen.getByLabelText('Tolerance')
    const hint = screen.getByText('Applies to every claim')
    expect(input).toHaveAttribute('aria-describedby', hint.id)
  })

  it('marks errors with aria-invalid and describes them', () => {
    render(<Input label="Tolerance" error="Must be a number" />)
    const input = screen.getByLabelText('Tolerance')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Must be a number')).toHaveAttribute(
      'id',
      input.getAttribute('aria-describedby'),
    )
  })

  it('accepts typing and is keyboard focusable', async () => {
    render(<Input label="Tolerance" />)
    const input = screen.getByLabelText('Tolerance')
    await userEvent.type(input, '0.01')
    expect(input).toHaveValue('0.01')
    expect(input).toHaveFocus()
  })
})
