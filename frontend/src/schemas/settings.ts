import { z } from 'zod'
import { numericString } from '@/lib/zod'

export const AppSettingsSchema = z.object({
  id: z.number(),
  tax_enabled: z.boolean(),
  tax_rate: numericString,
  pdf_invoices_enabled: z.boolean(),
  updated_at: z.string(),
})

export type AppSettings = z.infer<typeof AppSettingsSchema>

export const SessionTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  available_days: z.array(z.number().int().min(0).max(6)),
  created_at: z.string(),
})

export type SessionType = z.infer<typeof SessionTypeSchema>

export const SessionTypeListSchema = z.array(SessionTypeSchema)
