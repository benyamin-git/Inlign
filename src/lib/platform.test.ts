import { APP_PLATFORM, IS_NATIVE } from '@/lib/platform'

describe('platform', () => {
  it('reports web when not built for a native target', () => {
    expect(APP_PLATFORM).toBe('web')
    expect(IS_NATIVE).toBe(false)
  })
})
