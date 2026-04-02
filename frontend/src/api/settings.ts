import { api } from '@/lib/axios'
import {
  AppSettingsSchema,
  SessionTypeListSchema,
  SessionTypeSchema,
  type AppSettings,
  type SessionType,
} from '@/schemas/settings'

export type { AppSettings, SessionType }

export async function fetchSettings(): Promise<AppSettings> {
  const { data } = await api.get('/api/settings')
  return AppSettingsSchema.parse(data)
}

export async function updateSettings(payload: Partial<{
  tax_enabled: boolean
  tax_rate: string
  pdf_invoices_enabled: boolean
}>): Promise<AppSettings> {
  const { data } = await api.patch('/api/settings', payload)
  return AppSettingsSchema.parse(data)
}

export async function fetchSessionTypes(): Promise<SessionType[]> {
  const { data } = await api.get('/api/session-types')
  return SessionTypeListSchema.parse(data)
}

export async function createSessionType(name: string): Promise<SessionType> {
  const { data } = await api.post('/api/session-types', { name })
  return SessionTypeSchema.parse(data)
}

export async function updateSessionType(
  id: string,
  payload: { name?: string; available_days?: number[] },
): Promise<SessionType> {
  const { data } = await api.patch(`/api/session-types/${id}`, payload)
  return SessionTypeSchema.parse(data)
}

export async function deleteSessionType(id: string): Promise<void> {
  await api.delete(`/api/session-types/${id}`)
}
