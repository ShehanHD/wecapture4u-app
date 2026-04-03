// frontend/src/api/clientPortal.ts
import apiClient from '@/lib/axios'
import { z } from 'zod'
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
import { NotificationSchema, NotificationListSchema, type Notification } from '@/schemas/notifications'

export type { ClientProfile, ClientJob, ClientJobDetail, SessionType, ClientBookingRequest, Notification }

// ── Internal response schema for /api/profile/avatar ────────────────────────
const ProfileResponseSchema = z.object({
  full_name: z.string(),
  email: z.string(),
  phone: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
})

// ── Profile ──────────────────────────────────────────────────────────────────

export async function fetchMyProfile(): Promise<ClientProfile> {
  const { data } = await apiClient.get('/api/client/me')
  return ClientProfileSchema.parse(data)
}

export async function updateMyProfile(payload: { name?: string; phone?: string | null }): Promise<ClientProfile> {
  const { data } = await apiClient.patch('/api/client/me', payload)
  return ClientProfileSchema.parse(data)
}

export async function changePassword(payload: { current_password: string; new_password: string }): Promise<void> {
  await apiClient.post('/api/profile/change-password', payload)
}

export async function uploadAvatar(file: File): Promise<ClientProfile> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post('/api/profile/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  // /api/profile/avatar returns ProfileResponse shape; validate raw data before mapping
  const raw = ProfileResponseSchema.parse(data)
  return ClientProfileSchema.parse({
    name: raw.full_name,
    email: raw.email,
    phone: raw.phone ?? null,
    avatar_url: raw.avatar_url ?? null,
  })
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

export async function fetchMyJobs(): Promise<ClientJob[]> {
  const { data } = await apiClient.get('/api/client/jobs')
  return ClientJobListSchema.parse(data)
}

export async function fetchMyJob(id: string): Promise<ClientJobDetail> {
  const { data } = await apiClient.get(`/api/client/jobs/${id}`)
  return ClientJobDetailSchema.parse(data)
}

// ── Session types ─────────────────────────────────────────────────────────────

export async function fetchSessionTypes(): Promise<SessionType[]> {
  const { data } = await apiClient.get('/api/client/session-types')
  return SessionTypeListSchema.parse(data)
}

// ── Booking requests ──────────────────────────────────────────────────────────

export async function fetchMyBookingRequests(): Promise<ClientBookingRequest[]> {
  const { data } = await apiClient.get('/api/client/booking-requests')
  return ClientBookingRequestListSchema.parse(data)
}

export interface BookingSlotPayload {
  session_type_id: string
  date: string
  time_slot: 'morning' | 'afternoon' | 'evening' | 'all_day'
}

export interface BookingRequestCreatePayload {
  session_slots: BookingSlotPayload[]
  message?: string | null
}

export async function createBookingRequest(payload: BookingRequestCreatePayload): Promise<ClientBookingRequest> {
  const { data } = await apiClient.post('/api/client/booking-requests', payload)
  return ClientBookingRequestSchema.parse(data)
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function fetchNotifications(): Promise<Notification[]> {
  const { data } = await apiClient.get('/api/notifications')
  return NotificationListSchema.parse(data)
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const { data } = await apiClient.patch(`/api/notifications/${id}/read`)
  return NotificationSchema.parse(data)
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post('/api/notifications/read-all')
}
