import { z } from 'zod'
import { SessionSlotSchema } from '@/schemas/appointments'

export const BookingRequestSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  client_name: z.string(),
  preferred_date: z.string(),
  time_slot: z.enum(['morning', 'afternoon', 'evening', 'all_day']),
  session_type_id: z.string().uuid().nullable(),
  session_slots: z.array(SessionSlotSchema),
  addons: z.array(z.string()),
  message: z.string().nullable(),
  status: z.enum(['pending', 'confirmed', 'rejected']),
  admin_notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type BookingRequest = z.infer<typeof BookingRequestSchema>

export const BookingRequestListSchema = z.array(BookingRequestSchema)
