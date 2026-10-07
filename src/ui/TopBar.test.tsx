import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TopBar } from './TopBar'

describe('TopBar', () => {
  it('renders the title as a heading inside the banner landmark', () => {
    render(
      <TopBar title="Inlign">
        <button>New notebook</button>
      </TopBar>,
    )
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Inlign' })).toBeInTheDocument()
  })

  it('renders its actions', () => {
    render(
      <TopBar title="Inlign">
        <button>New notebook</button>
      </TopBar>,
    )
    expect(screen.getByRole('button', { name: 'New notebook' })).toBeInTheDocument()
  })

  it('renders without actions', () => {
    render(<TopBar title="Inlign" />)
    expect(screen.getByRole('heading', { name: 'Inlign' })).toBeInTheDocument()
  })
})
