import type { TranslationKey } from '@/i18n/types'

export type DocId = 'getting-started' | 'syntax' | 'checking' | 'engine-limits' | 'data'

export interface DocEntry {
  id: DocId
  titleKey: TranslationKey
  summaryKey: TranslationKey
  body: () => Promise<string>
}

export const docRegistry: DocEntry[] = [
  {
    id: 'getting-started',
    titleKey: 'docs.entries.gettingStarted.title',
    summaryKey: 'docs.entries.gettingStarted.summary',
    body: () => import('./en/getting-started.md?raw').then((module) => module.default),
  },
  {
    id: 'syntax',
    titleKey: 'docs.entries.syntax.title',
    summaryKey: 'docs.entries.syntax.summary',
    body: () => import('./en/syntax.md?raw').then((module) => module.default),
  },
  {
    id: 'checking',
    titleKey: 'docs.entries.checking.title',
    summaryKey: 'docs.entries.checking.summary',
    body: () => import('./en/checking.md?raw').then((module) => module.default),
  },
  {
    id: 'engine-limits',
    titleKey: 'docs.entries.engineLimits.title',
    summaryKey: 'docs.entries.engineLimits.summary',
    body: () => import('./en/engine-limits.md?raw').then((module) => module.default),
  },
  {
    id: 'data',
    titleKey: 'docs.entries.data.title',
    summaryKey: 'docs.entries.data.summary',
    body: () => import('./en/data.md?raw').then((module) => module.default),
  },
]
