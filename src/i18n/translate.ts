import type { Dictionary, TranslationParams } from './types'

export function translate(dict: Dictionary, key: string, params?: TranslationParams): string {
  const value = resolve(dict, key)
  if (value === undefined) return key
  if (params === undefined) return value
  return value.replace(/\{(\w+)\}/g, (match, name: string) => {
    const param = params[name]
    return param === undefined ? match : String(param)
  })
}

function resolve(dict: Dictionary, key: string): string | undefined {
  let node: string | Dictionary = dict
  for (const part of key.split('.')) {
    if (typeof node === 'string') return undefined
    const next: string | Dictionary | undefined = node[part]
    if (next === undefined) return undefined
    node = next
  }
  return typeof node === 'string' ? node : undefined
}
