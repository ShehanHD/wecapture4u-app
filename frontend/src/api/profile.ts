// frontend/src/api/profile.ts
import { api } from '@/lib/axios'
import {
  ProfileSchema, CredentialListSchema,
  type Profile, type Credential,
} from '@/schemas/profile'

export type { Profile, Credential }

export async function fetchProfile(): Promise<Profile> {
  const { data } = await api.get('/api/profile')
  return ProfileSchema.parse(data)
}

export async function updateProfile(payload: {
  full_name?: string
  email?: string
  current_password?: string
}): Promise<Profile> {
  const { data } = await api.patch('/api/profile', payload)
  return ProfileSchema.parse(data)
}

export async function changePassword(payload: {
  current_password: string
  new_password: string
}): Promise<void> {
  await api.post('/api/profile/change-password', payload)
}

export async function uploadAvatar(file: File): Promise<Profile> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/api/profile/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return ProfileSchema.parse(data)
}

export async function fetchCredentials(): Promise<Credential[]> {
  const { data } = await api.get('/api/auth/webauthn/credentials')
  return CredentialListSchema.parse(data)
}

export async function deleteCredential(credentialId: string): Promise<void> {
  await api.delete(`/api/auth/webauthn/credentials/${credentialId}`)
}
