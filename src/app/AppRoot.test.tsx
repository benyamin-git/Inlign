import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoot } from '@/app/AppRoot'
import { db } from '@/data/db'
import { listNotebooks } from '@/data/repositories/notebooks'
import { getSettings } from '@/data/repositories/settings'
import { MockWorker } from '@/test/mockWorker'

beforeEach(async () => {
  await db.notebooks.clear()
  await db.settings.clear()
  MockWorker.reset()
  vi.stubGlobal('Worker', MockWorker)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('AppRoot', () => {
  it('seeds the welcome notebook and renders the shell with it', async () => {
    render(<AppRoot />)

    expect(await screen.findByDisplayValue('Welcome')).toBeInTheDocument()
    expect((await getSettings()).seeded).toBe(true)
    expect(await listNotebooks()).toHaveLength(1)
  })

  it('does not seed again when remounted', async () => {
    const { unmount } = render(<AppRoot />)
    await screen.findByDisplayValue('Welcome')
    unmount()

    render(<AppRoot />)
    await screen.findByDisplayValue('Welcome')

    expect(await listNotebooks()).toHaveLength(1)
  })
})
