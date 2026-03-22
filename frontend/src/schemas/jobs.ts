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

const SessionTypeSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

const AppointmentSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
  status: z.string(),
  location: z.string().nullable(),
  session_time: z.enum(['morning', 'afternoon', 'evening']).nullable(),
  session_type_ids: z.array(z.string().uuid()),
  session_types: z.array(SessionTypeSummarySchema),
  addons: z.array(z.string()),
  deposit_paid: z.boolean(),
  deposit_amount: z.string(),
  contract_signed: z.boolean(),
  price: z.string(),
  notes: z.string().nullable(),
})

const StageSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
})

export const JobSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  client: ClientSummarySchema.nullable().optional(),
  appointment_id: z.string().uuid().nullable(),
  appointment: AppointmentSummarySchema.nullable().optional(),
  stage_id: z.string().uuid(),
  stage: StageSummarySchema.nullable().optional(),
  delivery_url: z.string().nullable(),
  created_at: z.string(),
})
export type Job = z.infer<typeof JobSchema>
export const JobListSchema = z.array(JobSchema)

// JobDetailSchema is now identical to JobSchema
export const JobDetailSchema = JobSchema
export type JobDetail = Job
