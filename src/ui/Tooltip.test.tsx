import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  it('associates a keyboard-focusable trigger with a tooltip', () => {
    render(
      <Tooltip label="Delete notebook">
        <button>Delete</button>
      </Tooltip>,
    )
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('Delete notebook')

    const trigger = document.querySelector(`[aria-describedby="${tooltip.id}"]`)
    expect(trigger).not.toBeNull()
    ;(trigger as HTMLElement).focus()
    expect(trigger).toHaveFocus()
  })

  it('gives every instance a unique description target', () => {
    render(
      <>
        <Tooltip label="First">
          <button>One</button>
        </Tooltip>
        <Tooltip label="Second">
          <button>Two</button>
        </Tooltip>
      </>,
    )
    const [first, second] = screen.getAllByRole('tooltip')
    expect(first?.id).toBeTruthy()
    expect(second?.id).toBeTruthy()
    expect(first?.id).not.toBe(second?.id)
  })
})
