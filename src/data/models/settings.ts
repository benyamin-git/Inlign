import { z } from 'zod'
import type { AngleMode } from '@/engine/types'
import type { AccentId } from '@/theme/accents'
import type { ThemeChoice } from '@/theme/theme'

export interface Settings {
  id: 'app'
  precision: number
  toleranceOverride: number | null
  angleMode: AngleMode
  theme: ThemeChoice
  accent: AccentId
  seeded: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  precision: 12,
  toleranceOverride: null,
  angleMode: 'radians',
  theme: 'system',
  accent: 'blue',
  seeded: false,
}

export const SettingsSchema: z.ZodType<Settings> = z.object({
  id: z.literal('app'),
  precision: z.number().int().min(8).max(15),
  toleranceOverride: z.number().nonnegative().nullable(),
  angleMode: z.enum(['radians', 'degrees']),
  theme: z.enum(['system', 'light', 'dark', 'oled']),
  accent: z.enum(['blue', 'teal', 'green', 'orange', 'rose', 'violet']),
  seeded: z.boolean(),
})
