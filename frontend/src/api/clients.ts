import { api } from '@/lib/axios'
import { ClientListSchema, ClientSchema, ClientWithStatsSchema, type Client, type ClientWithStats } from '@/schemas/clients'

export type { Client, ClientWithStats }

export interface ClientCreatePayload {
  name: string
  email: string
  phone?: string | null
  address?: string | null
  tags?: string[]
  birthday?: string | null
  notes?: string | null
  portal_access?: boolean
  temp_password?: string | null
}

export async function fetchClients(params?: { search?: string; tag?: string }): Promise<Client[]> {
  const { data } = await api.get('/api/clients', { params })
  return ClientListSchema.parse(data)
}

export async function fetchClient(id: string): Promise<ClientWithStats> {
  const { data } = await api.get(`/api/clients/${id}`)
  return ClientWithStatsSchema.parse(data)
}

export async function createClient(payload: ClientCreatePayload): Promise<Client> {
  const { data } = await api.post('/api/clients', payload)
  return ClientSchema.parse(data)
}

export async function updateClient(id: string, payload: Partial<ClientCreatePayload>): Promise<Client> {
  const { data } = await api.patch(`/api/clients/${id}`, payload)
  return ClientSchema.parse(data)
}

export async function deleteClient(id: string): Promise<void> {
  await api.delete(`/api/clients/${id}`)
}

export async function createPortalAccess(id: string, temp_password: string): Promise<Client> {
  const { data } = await api.post(`/api/clients/${id}/portal-access`, { temp_password })
  return ClientSchema.parse(data)
}

export async function togglePortalAccess(id: string, is_active: boolean): Promise<Client> {
  const { data } = await api.patch(`/api/clients/${id}/portal-access`, { is_active })
  return ClientSchema.parse(data)
}
