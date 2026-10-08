import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { en } from './en'
import { translate } from './translate'
import type { Dictionary, TranslationKey, TranslationParams } from './types'

export interface I18n {
  t: (key: TranslationKey, params?: TranslationParams) => string
}

const english: I18n = { t: (key, params) => translate(en, key, params) }

const I18nContext = createContext<I18n>(english)

export function I18nProvider({ dict = en, children }: { dict?: Dictionary; children: ReactNode }) {
  const value = useMemo<I18n>(() => ({ t: (key, params) => translate(dict, key, params) }), [dict])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18n {
  return useContext(I18nContext)
}
