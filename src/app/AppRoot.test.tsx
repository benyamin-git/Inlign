import { render, screen } from '@testing-library/react'
import { AppRoot } from '@/app/AppRoot'

describe('AppRoot', () => {
  it('renders the app name and version', () => {
    render(<AppRoot />)
    expect(screen.getByRole('heading', { name: 'Inlign' })).toBeInTheDocument()
    expect(screen.getByText('v0.1.0')).toBeInTheDocument()
  })
})
