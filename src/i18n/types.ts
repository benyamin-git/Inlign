import type { en } from './en'

export type Dictionary = { readonly [key: string]: string | Dictionary }

export type TranslationParams = Record<string, string | number>

type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`
}[keyof T & string]

export type TranslationKey = Leaves<typeof en>
