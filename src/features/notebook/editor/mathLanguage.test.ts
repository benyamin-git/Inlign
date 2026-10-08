import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { highlightTree } from '@lezer/highlight'
import { describe, expect, it } from 'vitest'
import { mathHighlightStyle, mathLanguage } from './mathLanguage'

interface Highlight {
  text: string
  classes: string
}

function highlights(doc: string): Highlight[] {
  const state = EditorState.create({ doc, extensions: [mathLanguage] })
  const tree = ensureSyntaxTree(state, state.doc.length, 1000) ?? syntaxTree(state)
  const found: Highlight[] = []
  highlightTree(tree, mathHighlightStyle, (from, to, classes) => {
    found.push({ text: doc.slice(from, to), classes })
  })
  return found
}

describe('mathLanguage', () => {
  it('highlights numbers, identifiers, functions, operators, and comments distinctly', () => {
    const found = highlights('x = sqrt(4) + 2 # note')
    const classesFor = (text: string) => found.find((entry) => entry.text === text)?.classes
    const number = classesFor('4')
    const identifier = classesFor('x')
    const fn = classesFor('sqrt')
    const operator = classesFor('=')
    const comment = classesFor('# note')
    for (const cls of [number, identifier, fn, operator, comment]) {
      expect(cls).toBeDefined()
    }
    expect(new Set([number, identifier, fn, operator, comment]).size).toBe(5)
  })

  it('keeps decimals and exponents as single number tokens', () => {
    const found = highlights('1.5e-3')
    expect(found.map((entry) => entry.text)).toEqual(['1.5e-3'])
    expect(found[0]?.classes).toBeTruthy()
  })
})
