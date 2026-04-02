import { api } from '@/lib/axios'
import { VerifyEmailResponseSchema, type VerifyEmailResponse } from '@/schemas/auth'

export interface RegisterPayload {
  full_name: string
  email: string
  phone: string
  password: string
}

export async function registerClient(data: RegisterPayload): Promise<void> {
  await api.post('/api/auth/register', data)
}

export async function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  const { data } = await api.get('/api/auth/verify-email', { params: { token } })
  return VerifyEmailResponseSchema.parse(data)
}

export async function resendVerification(email: string): Promise<void> {
  await api.post('/api/auth/resend-verification', { email })
}
