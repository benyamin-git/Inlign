import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { en } from './en'
import { I18nProvider, useI18n } from './I18nProvider'
import { translate } from './translate'
import type { Dictionary } from './types'

const fixture = {
  greeting: 'Hello, {name}!',
  nested: { count: '{count} items' },
} as const satisfies Dictionary

function Probe() {
  const { t } = useI18n()
  return createElement('span', null, t('app.name'))
}

describe('translate', () => {
  it('resolves dot-separated keys in the English dictionary', () => {
    expect(translate(en, 'app.name')).toBe('Inlign')
  })

  it('falls back to the key for missing or non-leaf keys', () => {
    expect(translate(en, 'app.missing')).toBe('app.missing')
    expect(translate(en, 'app')).toBe('app')
    expect(translate(en, '')).toBe('')
  })

  it('interpolates {param} placeholders', () => {
    expect(translate(fixture, 'greeting', { name: 'Inlign' })).toBe('Hello, Inlign!')
    expect(translate(fixture, 'nested.count', { count: 3 })).toBe('3 items')
  })

  it('leaves placeholders without a param in place', () => {
    expect(translate(fixture, 'greeting', { other: 'x' })).toBe('Hello, {name}!')
    expect(translate(fixture, 'greeting')).toBe('Hello, {name}!')
  })
})

describe('useI18n', () => {
  it('translates through the default English dictionary', () => {
    render(createElement(Probe))
    expect(screen.getByText('Inlign')).toBeInTheDocument()
  })

  it('translates through an explicit provider', () => {
    render(createElement(I18nProvider, null, createElement(Probe)))
    expect(screen.getByText('Inlign')).toBeInTheDocument()
  })
})
