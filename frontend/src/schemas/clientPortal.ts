// frontend/src/schemas/clientPortal.ts
import { z } from 'zod'

export const ClientProfileSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  avatar_url: z.string().nullable().optional(),
})
export type ClientProfile = z.infer<typeof ClientProfileSchema>

export const ClientJobSchema = z.object({
  id: z.string().uuid(),
  delivery_url: z.string().nullable(),
  appointment_title: z.string(),
  appointment_starts_at: z.string(),
  stage_name: z.string(),
  stage_color: z.string(),
})
export type ClientJob = z.infer<typeof ClientJobSchema>
export const ClientJobListSchema = z.array(ClientJobSchema)

export const ClientJobStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  position: z.number().int(),
})
export type ClientJobStage = z.infer<typeof ClientJobStageSchema>

export const ClientJobDetailSchema = z.object({
  id: z.string().uuid(),
  delivery_url: z.string().nullable(),
  appointment_title: z.string(),
  appointment_starts_at: z.string(),
  appointment_session_types: z.array(z.string()),
  stage_id: z.string().uuid(),
  stage_name: z.string(),
  all_stages: z.array(ClientJobStageSchema),
})
export type ClientJobDetail = z.infer<typeof ClientJobDetailSchema>

export const SessionTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  available_days: z.array(z.number()).optional().default([]),
})
export type SessionType = z.infer<typeof SessionTypeSchema>
export const SessionTypeListSchema = z.array(SessionTypeSchema)

export const ClientBookingRequestSlotSchema = z.object({
  session_type_id: z.string().uuid(),
  session_type_name: z.string().nullable(),
  date: z.string(),
  time_slot: z.enum(['morning', 'afternoon', 'evening', 'all_day']),
})
export type ClientBookingRequestSlot = z.infer<typeof ClientBookingRequestSlotSchema>

export const ClientBookingRequestSchema = z.object({
  id: z.string().uuid(),
  preferred_date: z.string(),
  time_slot: z.enum(['morning', 'afternoon', 'evening', 'all_day']).nullable(),
  session_type_name: z.string().nullable(),
  session_slots: z.array(ClientBookingRequestSlotSchema).default([]),
  message: z.string().nullable(),
  status: z.enum(['pending', 'confirmed', 'rejected']),
  admin_notes: z.string().nullable(),
  created_at: z.string(),
})
export type ClientBookingRequest = z.infer<typeof ClientBookingRequestSchema>
export const ClientBookingRequestListSchema = z.array(ClientBookingRequestSchema)
