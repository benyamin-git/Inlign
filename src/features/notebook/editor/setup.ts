import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { annotationsExtension } from './annotations'
import { mathHighlightStyle, mathLanguage } from './mathLanguage'

export interface EditorSetupOptions {
  label: string
  onDocChange?: (doc: string) => void
}

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '16px',
    backgroundColor: 'transparent',
    color: 'var(--md-sys-color-on-surface)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--app-font-mono)',
    lineHeight: '1.75',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '1rem 1.25rem 40vh',
    caretColor: 'var(--md-sys-color-primary)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-ann-conflict': {
    textDecoration: 'underline wavy var(--app-color-loss)',
    textUnderlineOffset: '0.25em',
  },
  '.cm-ann-result': {
    color: 'var(--md-sys-color-on-surface-variant)',
    paddingInlineStart: '0.5em',
  },
  '.cm-ann-result-block': {
    display: 'block',
    paddingInlineStart: '1.5rem',
  },
  '.cm-ann-fix': {
    font: 'inherit',
    color: 'var(--app-color-loss)',
    background: 'none',
    border: 'none',
    padding: '0 0.25em',
    cursor: 'pointer',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textUnderlineOffset: '0.25em',
  },
  '.cm-ann-error-note': { color: 'var(--app-color-warning)' },
  '.cm-ann-note': {
    color: 'var(--app-color-warning)',
    fontStyle: 'italic',
    paddingInlineStart: '0.5em',
  },
})

export function createEditorExtensions(options: EditorSetupOptions): Extension {
  const { label, onDocChange } = options
  const extensions: Extension[] = [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': label }),
    annotationsExtension,
    mathLanguage,
    syntaxHighlighting(mathHighlightStyle),
    editorTheme,
  ]
  if (onDocChange !== undefined) {
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onDocChange(update.state.doc.toString())
      }),
    )
  }
  return extensions
}
