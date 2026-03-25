// frontend/src/schemas/profile.ts
import { z } from 'zod'

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string(),
  avatar_url: z.string().nullable(),
  role: z.string(),
})
export type Profile = z.infer<typeof ProfileSchema>

export const CredentialSchema = z.object({
  credential_id: z.string(),
  device_name: z.string().nullable(),
  created_at: z.string(),
})
export type Credential = z.infer<typeof CredentialSchema>
export const CredentialListSchema = z.array(CredentialSchema)
