import { z } from 'zod'

export const JobStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  position: z.number().int(),
  is_terminal: z.boolean(),
  created_at: z.string(),
})
export type JobStage = z.infer<typeof JobStageSchema>
export const JobStageListSchema = z.array(JobStageSchema)

const ClientSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
})

const AppointmentSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  starts_at: z.string(),
  status: z.string(),
})

export const JobSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  client: ClientSummarySchema.nullable().optional(),
  appointment_id: z.string().uuid().nullable(),
  title: z.string(),
  stage_id: z.string().uuid(),
  shoot_date: z.string().nullable(),
  delivery_deadline: z.string().nullable(),
  delivery_url: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
})
export type Job = z.infer<typeof JobSchema>
export const JobListSchema = z.array(JobSchema)

export const JobDetailSchema = JobSchema.extend({
  appointment: AppointmentSummarySchema.nullable().optional(),
})
export type JobDetail = z.infer<typeof JobDetailSchema>
