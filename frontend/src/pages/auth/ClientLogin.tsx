import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useState } from 'react'
import apiClient from '@/lib/axios'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
})
type FormData = z.infer<typeof schema>

const inputClass = [
  'w-full font-[inherit] text-[15px] rounded-[10px] px-3.5 py-3 outline-none transition-all duration-150',
  'bg-[#F5F5F7] border border-[#E8E8ED]',
  'text-[#1D1D1F] placeholder:text-[#AEAEB2]',
  'focus:border-[#1D1D1F] focus:shadow-[0_0_0_3px_rgba(29,29,31,0.08)]',
].join(' ')

export default function ClientLogin() {
  const { login, loginWithBiometric } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [hasBiometric, setHasBiometric] = useState(false)
  const [checkedEmail, setCheckedEmail] = useState('')
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [directBiometricLoading, setDirectBiometricLoading] = useState(false)

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

  const handleDirectBiometric = async () => {
    setError(null)
    setDirectBiometricLoading(true)
    try {
      await loginWithBiometric()
    } catch {
      setError('Biometric login failed. Please sign in with email and password.')
    } finally {
      setDirectBiometricLoading(false)
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
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F5F5F7' }}>
      <div
        className="w-full max-w-[400px] bg-white p-11"
        style={{ borderRadius: 20, border: '1px solid #E8E8ED', boxShadow: '0 8px 40px rgba(0,0,0,0.10)' }}
      >
        {/* Logo + heading */}
        <div className="flex flex-col items-center mb-9 gap-2.5">
          <div
            className="flex items-center justify-center"
            style={{ width: 44, height: 44, borderRadius: 12, background: '#1D1D1F' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold" style={{ color: '#1D1D1F', letterSpacing: '-0.3px' }}>
              Client Portal
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#6E6E73' }}>Sign in to view your jobs &amp; photos</p>
          </div>
        </div>

        {/* Biometric (direct — no email needed) */}
        <button
          type="button"
          onClick={handleDirectBiometric}
          disabled={directBiometricLoading}
          className="w-full flex items-center justify-center gap-2 text-sm font-medium py-3 mb-5 transition-colors duration-150 disabled:opacity-50"
          style={{ borderRadius: 10, background: '#F5F5F7', border: '1px solid #E8E8ED', color: '#1D1D1F', fontFamily: 'inherit' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#EBEBF0')}
          onMouseLeave={e => (e.currentTarget.style.background = '#F5F5F7')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04.054-.09A13.916 13.916 0 0 0 8 11a4 4 0 1 1 8 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0 0 15.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 0 0 8 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
          </svg>
          {directBiometricLoading ? 'Verifying…' : 'Use Face ID / Fingerprint'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px" style={{ background: '#E8E8ED' }} />
          <span className="text-xs" style={{ color: '#AEAEB2' }}>or continue with email</span>
          <div className="flex-1 h-px" style={{ background: '#E8E8ED' }} />
        </div>

        {/* Email field */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6E6E73' }}>Email</label>
          <input
            type="email"
            placeholder="jane@example.com"
            className={inputClass}
            {...register('email')}
            onBlur={checkBiometric}
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        {/* Per-email biometric */}
        {hasBiometric && (
          <>
            <button
              type="button"
              onClick={handleBiometric}
              disabled={biometricLoading}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium py-3 mb-4 transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ borderRadius: 980, background: '#1D1D1F', color: '#fff', fontFamily: 'inherit', border: 'none' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04.054-.09A13.916 13.916 0 0 0 8 11a4 4 0 1 1 8 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0 0 15.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 0 0 8 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
              {biometricLoading ? 'Verifying…' : 'Use Face ID / Fingerprint'}
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: '#E8E8ED' }} />
              <span className="text-xs" style={{ color: '#AEAEB2' }}>or use password</span>
              <div className="flex-1 h-px" style={{ background: '#E8E8ED' }} />
            </div>
          </>
        )}

        {/* Password + submit */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#6E6E73' }}>Password</label>
            <input type="password" placeholder="••••••••" className={inputClass} {...register('password')} />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full text-sm font-medium py-3.5 rounded-full text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: '#1D1D1F', fontFamily: 'inherit', border: 'none' }}
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <Link
          to="/client/forgot-password"
          className="block text-center text-sm mt-5 transition-colors"
          style={{ color: '#6E6E73' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#1D1D1F')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6E6E73')}
        >
          Forgot password?
        </Link>
      </div>
    </div>
  )
}
