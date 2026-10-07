import { APP_VERSION } from '@/lib/version'

describe('APP_VERSION', () => {
  it('exposes the package version injected at build time', () => {
    expect(APP_VERSION).toBe('0.1.0')
  })
})
