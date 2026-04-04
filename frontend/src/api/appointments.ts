import { api } from '@/lib/axios'
import { AppointmentListSchema, AppointmentSchema, type Appointment } from '@/schemas/appointments'

export type { Appointment }

export interface SessionSlotPayload {
  session_type_id: string
  date: string
  time_slot: 'morning' | 'afternoon' | 'evening' | 'all_day'
  time?: string
}

export interface AppointmentCreatePayload {
  client_id: string
  title: string
  starts_at?: string
  session_slots?: SessionSlotPayload[]
  session_type_ids?: string[]
  session_time?: 'morning' | 'afternoon' | 'evening' | null
  ends_at?: string | null
  location?: string | null
  status?: 'pending' | 'confirmed' | 'cancelled'
  addons?: string[]
  deposit_paid?: boolean
  deposit_amount?: string
  deposit_account_id?: string | null
  contract_signed?: boolean
  price?: string
  notes?: string | null
}

export async function fetchAppointments(params?: {
  status?: string
  session_type_id?: string
  start_date?: string
  end_date?: string
}): Promise<Appointment[]> {
  const { data } = await api.get('/api/appointments', { params })
  return AppointmentListSchema.parse(data)
}

export async function fetchAppointment(id: string): Promise<Appointment> {
  const { data } = await api.get(`/api/appointments/${id}`)
  return AppointmentSchema.parse(data)
}

export async function createAppointment(payload: AppointmentCreatePayload): Promise<Appointment> {
  const { data } = await api.post('/api/appointments', payload)
  return AppointmentSchema.parse(data)
}

export async function updateAppointment(
  id: string,
  payload: Partial<AppointmentCreatePayload>
): Promise<Appointment> {
  const { data } = await api.patch(`/api/appointments/${id}`, payload)
  return AppointmentSchema.parse(data)
}

export async function deleteAppointment(id: string): Promise<void> {
  await api.delete(`/api/appointments/${id}`)
}
