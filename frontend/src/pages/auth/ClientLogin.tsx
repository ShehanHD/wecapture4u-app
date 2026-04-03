// frontend/src/pages/auth/ClientLogin.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import axios from 'axios'
import { useAuth } from '@/hooks/useAuth'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
})
type FormData = z.infer<typeof schema>

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid #e0e8ff',
  borderRadius: 9,
  background: '#f8f9ff',
  padding: '11px 14px',
  fontSize: 14,
  color: '#0a0e2e',
  outline: 'none',
  boxSizing: 'border-box',
}

export default function ClientLogin() {
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setError(null)
    try {
      await login(data.email, data.password)
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail : undefined
      setError(msg ?? 'Login failed. Please try again.')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9ff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* Logo above card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #4d79ff, #7aa5ff)', borderRadius: 8, flexShrink: 0 }} />
        <span style={{ fontSize: 18, fontWeight: 800, color: '#0a0e2e', letterSpacing: '-0.02em' }}>weCapture4U</span>
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 380, background: '#ffffff', border: '1px solid #e0e8ff', borderRadius: 16, padding: '28px 28px 24px', boxShadow: '0 4px 20px rgba(77,121,255,0.07)' }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#0a0e2e', marginBottom: 4 }}>Welcome back</p>
          <p style={{ fontSize: 13, color: '#778899' }}>Sign in to your client area</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#778899', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label>
            <input type="email" style={inputStyle} placeholder="you@example.com" {...register('email')} />
            {errors.email && <p style={{ color: '#e05252', fontSize: 12, marginTop: 4 }}>{errors.email.message}</p>}
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#778899', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Password</label>
            <input type="password" style={inputStyle} placeholder="••••••••" {...register('password')} />
            {errors.password && <p style={{ color: '#e05252', fontSize: 12, marginTop: 4 }}>{errors.password.message}</p>}
          </div>

          <div style={{ textAlign: 'right', marginTop: -4 }}>
            <Link to="/client/forgot-password" style={{ fontSize: 12, color: '#4d79ff', fontWeight: 600 }}>Forgot password?</Link>
          </div>

          {error && <p style={{ color: '#e05252', fontSize: 13, textAlign: 'center' }}>{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{ width: '100%', background: '#4d79ff', color: '#fff', fontWeight: 700, fontSize: 14, padding: '12px', borderRadius: 9, border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, marginTop: 4 }}
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#778899' }}>
          Don't have an account?{' '}
          <Link to="/client/register" style={{ color: '#4d79ff', fontWeight: 600 }}>Register</Link>
        </p>
      </div>

      <a href="/" style={{ marginTop: 20, fontSize: 12, color: '#778899' }}>← Back to website</a>
    </div>
  )
}
