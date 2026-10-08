import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n/I18nProvider'
import { HelpSheet } from './HelpSheet'

function renderSheet() {
  const onClose = vi.fn()
  render(
    <I18nProvider>
      <HelpSheet open onClose={onClose} />
    </I18nProvider>,
  )
  return { onClose }
}

describe('HelpSheet', () => {
  it('lists all five documentation pages with titles and summaries', () => {
    renderSheet()

    for (const title of [
      'Getting started',
      'Syntax reference',
      'How checking works',
      'Engine limits',
      'Data & backup',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(`^${title}`) })).toBeInTheDocument()
    }
    expect(
      screen.getByText('Write your first formulas and see results as you type.'),
    ).toBeInTheDocument()
  })

  it('opens a page and renders its heading', async () => {
    const user = userEvent.setup()
    renderSheet()

    await user.click(screen.getByRole('button', { name: /^Syntax reference/ }))

    expect(await screen.findByRole('heading', { name: 'Lines' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Syntax reference/ })).not.toBeInTheDocument()
  })

  it('returns to the index', async () => {
    const user = userEvent.setup()
    renderSheet()

    await user.click(screen.getByRole('button', { name: /^Data & backup/ }))
    await screen.findByRole('heading', { name: 'Local-first by design' })
    await user.click(screen.getByRole('button', { name: 'All topics' }))

    expect(screen.getByRole('button', { name: /^Data & backup/ })).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const { onClose } = renderSheet()

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
