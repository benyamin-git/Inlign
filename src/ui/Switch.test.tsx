import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from './Switch'

describe('Switch', () => {
  it('exposes switch semantics with the visible label as its name', () => {
    render(
      <Switch checked={false} onCheckedChange={() => undefined}>
        Degrees
      </Switch>,
    )
    const control = screen.getByRole('switch', { name: 'Degrees' })
    expect(control).toHaveAttribute('aria-checked', 'false')
  })

  it('reports the checked state', () => {
    render(
      <Switch checked onCheckedChange={() => undefined}>
        Degrees
      </Switch>,
    )
    expect(screen.getByRole('switch', { name: 'Degrees' })).toHaveAttribute('aria-checked', 'true')
  })

  it('toggles on click', async () => {
    const onCheckedChange = vi.fn()
    render(
      <Switch checked={false} onCheckedChange={onCheckedChange}>
        Degrees
      </Switch>,
    )
    await userEvent.click(screen.getByRole('switch', { name: 'Degrees' }))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('toggles from the keyboard', async () => {
    const onCheckedChange = vi.fn()
    render(
      <Switch checked={false} onCheckedChange={onCheckedChange}>
        Degrees
      </Switch>,
    )
    const control = screen.getByRole('switch', { name: 'Degrees' })
    control.focus()
    expect(control).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })
})
