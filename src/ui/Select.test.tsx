import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Select } from './Select'

describe('Select', () => {
  it('associates its label and renders its options', () => {
    render(
      <Select label="Angle mode" defaultValue="radians">
        <option value="radians">Radians</option>
        <option value="degrees">Degrees</option>
      </Select>,
    )
    const select = screen.getByLabelText('Angle mode')
    expect(select).toBeInstanceOf(HTMLSelectElement)
    expect(screen.getByRole('option', { name: 'Degrees' })).toBeInTheDocument()
  })

  it('changes selection', async () => {
    render(
      <Select label="Angle mode" defaultValue="radians">
        <option value="radians">Radians</option>
        <option value="degrees">Degrees</option>
      </Select>,
    )
    const select = screen.getByLabelText('Angle mode')
    await userEvent.selectOptions(select, 'degrees')
    expect(select).toHaveValue('degrees')
  })

  it('shows errors with aria-invalid', () => {
    render(
      <Select label="Angle mode" error="Pick one">
        <option value="radians">Radians</option>
      </Select>,
    )
    expect(screen.getByLabelText('Angle mode')).toHaveAttribute('aria-invalid', 'true')
  })
})
