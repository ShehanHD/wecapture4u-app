import { z } from 'zod'

export const AppSettingsSchema = z.object({
  id: z.number(),
  tax_enabled: z.boolean(),
  tax_rate: z.string(),
  pdf_invoices_enabled: z.boolean(),
  updated_at: z.string(),
})

export type AppSettings = z.infer<typeof AppSettingsSchema>

export const SessionTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  created_at: z.string(),
})

export type SessionType = z.infer<typeof SessionTypeSchema>

export const SessionTypeListSchema = z.array(SessionTypeSchema)
