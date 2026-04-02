// frontend/src/api/clientPortal.ts
import { api } from '@/lib/axios'
import {
  ClientProfileSchema,
  ClientJobListSchema,
  ClientJobDetailSchema,
  SessionTypeListSchema,
  ClientBookingRequestListSchema,
  ClientBookingRequestSchema,
  type ClientProfile,
  type ClientJob,
  type ClientJobDetail,
  type SessionType,
  type ClientBookingRequest,
} from '@/schemas/clientPortal'

export type { ClientProfile, ClientJob, ClientJobDetail, SessionType, ClientBookingRequest }

export async function fetchMyProfile(): Promise<ClientProfile> {
  const { data } = await api.get('/api/client/me')
  return ClientProfileSchema.parse(data)
}

export async function updateMyProfile(payload: { name?: string; phone?: string | null }): Promise<ClientProfile> {
  const { data } = await api.patch('/api/client/me', payload)
  return ClientProfileSchema.parse(data)
}

export async function fetchMyJobs(): Promise<ClientJob[]> {
  const { data } = await api.get('/api/client/jobs')
  return ClientJobListSchema.parse(data)
}

export async function fetchMyJob(id: string): Promise<ClientJobDetail> {
  const { data } = await api.get(`/api/client/jobs/${id}`)
  return ClientJobDetailSchema.parse(data)
}

export async function fetchSessionTypes(): Promise<SessionType[]> {
  const { data } = await api.get('/api/client/session-types')
  return SessionTypeListSchema.parse(data)
}

export async function fetchMyBookingRequests(): Promise<ClientBookingRequest[]> {
  const { data } = await api.get('/api/client/booking-requests')
  return ClientBookingRequestListSchema.parse(data)
}

export interface BookingRequestCreatePayload {
  preferred_date: string
  time_slot: 'morning' | 'afternoon' | 'evening' | 'all_day'
  session_type_id?: string | null
  message?: string | null
}

export async function createBookingRequest(payload: BookingRequestCreatePayload): Promise<ClientBookingRequest> {
  const { data } = await api.post('/api/client/booking-requests', payload)
  return ClientBookingRequestSchema.parse(data)
}
