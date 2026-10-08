import { HighlightStyle, StreamLanguage } from '@codemirror/language'
import { tags } from '@lezer/highlight'

export const mathLanguage = StreamLanguage.define({
  startState: () => ({}),
  token(stream) {
    if (stream.eatSpace()) return null
    if (stream.peek() === '#') {
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.match(/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/)) return 'number'
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) {
      return stream.peek() === '(' ? 'function' : 'identifier'
    }
    if (stream.match(/^[+\-*/^%()<>=!,.':]/)) return 'operator'
    stream.next()
    return null
  },
  tokenTable: {
    number: tags.number,
    operator: tags.operator,
    identifier: tags.variableName,
    function: tags.function(tags.variableName),
    comment: tags.comment,
  },
})

export const mathHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: 'var(--md-sys-color-on-surface-variant)', fontStyle: 'italic' },
  { tag: tags.number, color: 'var(--md-sys-color-primary)' },
  { tag: tags.operator, color: 'var(--md-sys-color-on-surface-variant)' },
  { tag: tags.function(tags.variableName), color: 'var(--md-sys-color-tertiary)' },
  { tag: tags.variableName, color: 'var(--md-sys-color-on-surface)' },
])
