import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders its title, description and action', () => {
    render(
      <EmptyState title="No notebooks yet" description="Create one to start drafting">
        <button>New notebook</button>
      </EmptyState>,
    )
    expect(screen.getByRole('heading', { name: 'No notebooks yet' })).toBeInTheDocument()
    expect(screen.getByText('Create one to start drafting')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New notebook' })).toBeInTheDocument()
  })

  it('hides decorative icons from assistive technology', () => {
    render(<EmptyState title="Nothing here" icon={<svg data-testid="icon" />} />)
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true')
  })
})
