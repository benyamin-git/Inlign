import { cn } from '@/lib/cn'

describe('cn', () => {
  it('joins truthy class names with spaces', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('ignores false, null and undefined', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('returns an empty string when nothing is truthy', () => {
    expect(cn(false, null, undefined)).toBe('')
  })
})
