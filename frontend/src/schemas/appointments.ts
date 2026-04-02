import { z } from 'zod'

const VALID_STATUSES = ['pending', 'confirmed', 'cancelled'] as const
const VALID_ADDONS = ['album', 'thank_you_card', 'enlarged_photos'] as const
const VALID_TIME_SLOTS = ['morning', 'afternoon', 'evening', 'all_day'] as const

export const SessionSlotSchema = z.object({
  session_type_id: z.string().uuid(),
  date: z.string(),           // "YYYY-MM-DD"
  time_slot: z.enum(VALID_TIME_SLOTS),
})

export type SessionSlot = z.infer<typeof SessionSlotSchema>

export const SessionTypeSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

export const AppointmentSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  session_slots: z.array(SessionSlotSchema),
  session_type_ids: z.array(z.string().uuid()),   // derived, kept for calendar
  session_time: z.string().nullable(),  // legacy
  session_types: z.array(SessionTypeSummarySchema),
  title: z.string(),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
  location: z.string().nullable(),
  status: z.enum(VALID_STATUSES),
  addons: z.array(z.enum(VALID_ADDONS)),
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
