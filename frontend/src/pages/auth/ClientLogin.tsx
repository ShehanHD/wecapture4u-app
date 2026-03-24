import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Fingerprint } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import apiClient from '@/lib/axios'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
})
type FormData = z.infer<typeof schema>

export default function ClientLogin() {
  const { login, loginWithBiometric } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [hasBiometric, setHasBiometric] = useState(false)
  const [checkedEmail, setCheckedEmail] = useState('')
  const [biometricLoading, setBiometricLoading] = useState(false)

  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const checkBiometric = async () => {
    const email = getValues('email')
    if (!email || checkedEmail === email) return
    setCheckedEmail(email)
    try {
      const { data } = await apiClient.get(`/api/auth/webauthn/device-check?email=${encodeURIComponent(email)}`)
      setHasBiometric(data.has_credential)
    } catch {
      setHasBiometric(false)
    }
  }

  const handleBiometric = async () => {
    const email = getValues('email')
    if (!email) return
    setError(null)
    setBiometricLoading(true)
    try {
      await loginWithBiometric(email)
    } catch {
      setError('Biometric login failed. Please use your password.')
    } finally {
      setBiometricLoading(false)
    }
  }

  const onSubmit = async (data: FormData) => {
    setError(null)
    try {
      await login(data.email, data.password)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Login failed. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-xl font-semibold text-foreground">Client Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to view your jobs</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              onBlur={checkBiometric}
            />
            {errors.email && <p className="text-red-400 text-sm">{errors.email.message}</p>}
          </div>

          {hasBiometric && (
            <>
              <Button
                type="button"
                className="w-full h-10 rounded-xl"
                onClick={handleBiometric}
                disabled={biometricLoading}
              >
                <Fingerprint className="w-4 h-4 mr-2" />
                {biometricLoading ? 'Verifying…' : 'Use Face ID / Fingerprint'}
              </Button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or use password</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-red-400 text-sm">{errors.password.message}</p>}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <Button type="submit" className="w-full h-10 rounded-xl" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </div>

        <Link to="/client/forgot-password" className="block text-center text-sm text-muted hover:text-primary mt-4">
          Forgot password?
        </Link>
      </div>
    </div>
  )
}
