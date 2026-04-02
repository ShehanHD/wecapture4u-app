import { z } from 'zod'

export const RegisterSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(1, 'Phone is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
})

export type RegisterFormData = z.infer<typeof RegisterSchema>

export const VerifyEmailResponseSchema = z.object({
  message: z.string(),
})

export type VerifyEmailResponse = z.infer<typeof VerifyEmailResponseSchema>
