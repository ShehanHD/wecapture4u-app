import { z } from 'zod'

export const ClientSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  tags: z.array(z.string()),
  birthday: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
})
export type Client = z.infer<typeof ClientSchema>
export const ClientListSchema = z.array(ClientSchema)

export const ClientWithStatsSchema = ClientSchema.extend({
  total_spent: z.number(),
  is_active: z.boolean().nullable(),
})
export type ClientWithStats = z.infer<typeof ClientWithStatsSchema>
