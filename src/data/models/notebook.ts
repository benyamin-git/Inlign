import { z } from 'zod'

export interface Notebook {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

export const NotebookSchema: z.ZodType<Notebook> = z.object({
  id: z.string().min(1),
  title: z.string(),
  content: z.string(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
})
