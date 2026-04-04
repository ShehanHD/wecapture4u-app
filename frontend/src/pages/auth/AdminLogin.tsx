import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Camera, Fingerprint } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useState } from 'react'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
})
type FormData = z.infer<typeof schema>

export default function AdminLogin() {
  const { login, loginWithBiometric } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [biometricLoading, setBiometricLoading] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const handleBiometric = async () => {
    setError(null)
    setBiometricLoading(true)
    try {
      await loginWithBiometric()
    } catch {
      setError('Biometric login failed. Please sign in with email and password.')
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

  const inputStyle = {
    width: '100%',
    border: '1.5px solid #e0e8ff',
    borderRadius: 10,
    background: '#f8f9ff',
    padding: '11px 14px',
    fontSize: 14,
    color: '#0a0e2e',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0e2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#fff',
          borderRadius: 20,
          padding: '40px 32px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              borderRadius: 14,
              background: '#0a0e2e',
              marginBottom: 12,
            }}
          >
            <Camera style={{ width: 26, height: 26, color: '#fff' }} />
          </div>
          <p style={{ fontSize: 20, fontWeight: 800, color: '#0a0e2e' }}>weCapture4U</p>
          <p style={{ fontSize: 13, color: '#778899', marginTop: 4 }}>Sign in to your account</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Biometric */}
          <button
            type="button"
            onClick={handleBiometric}
            disabled={biometricLoading}
            style={{
              width: '100%',
              border: '1.5px solid #e0e8ff',
              borderRadius: 10,
              background: '#f8f9ff',
              color: '#0a0e2e',
              fontWeight: 600,
              fontSize: 14,
              padding: '11px 14px',
              cursor: biometricLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Fingerprint style={{ width: 16, height: 16 }} />
            {biometricLoading ? 'Verifying…' : 'Use Face ID / Fingerprint'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#e0e8ff' }} />
            <span style={{ fontSize: 12, color: '#778899' }}>or sign in with email</span>
            <div style={{ flex: 1, height: 1, background: '#e0e8ff' }} />
          </div>

          {/* Email + password form */}
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input id="email" type="email" style={inputStyle} {...register('email')} />
              {errors.email && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.email.message}</p>}
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <input id="password" type="password" style={inputStyle} {...register('password')} />
              {errors.password && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.password.message}</p>}
            </div>

            {error && <p style={{ color: '#e53e3e', fontSize: 13, textAlign: 'center', margin: 0 }}>{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                background: '#4d79ff',
                color: '#fff',
                fontWeight: 700,
                fontSize: 15,
                padding: 14,
                borderRadius: 10,
                border: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <Link
          to="/forgot-password"
          style={{ display: 'block', textAlign: 'center', marginTop: 20, fontSize: 13, color: '#4d79ff' }}
        >
          Forgot password?
        </Link>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/" style={{ fontSize: 12, color: '#778899' }}>← Back to site</a>
        </div>
      </div>
    </div>
  )
}
