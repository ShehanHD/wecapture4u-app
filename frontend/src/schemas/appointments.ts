import { z } from 'zod'

const VALID_STATUSES = ['pending', 'confirmed', 'cancelled'] as const
const VALID_ADDONS = ['album', 'thank_you_card', 'enlarged_photos'] as const

export const SessionTypeSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

export const AppointmentSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  session_type_ids: z.array(z.string().uuid()),
  session_time: z.enum(['morning', 'afternoon', 'evening']).nullable(),
  session_types: z.array(SessionTypeSummarySchema),
  title: z.string(),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
  location: z.string().nullable(),
  status: z.enum(VALID_STATUSES),
  addons: z.array(z.string()),
  deposit_paid: z.boolean(),
  deposit_amount: z.string(),
  deposit_account_id: z.string().uuid().nullable(),
  contract_signed: z.boolean(),
  price: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
})

export type Appointment = z.infer<typeof AppointmentSchema>

export const AppointmentListSchema = z.array(AppointmentSchema)
