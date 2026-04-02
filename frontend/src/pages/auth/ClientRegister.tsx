// frontend/src/pages/auth/ClientRegister.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RegisterSchema, type RegisterFormData } from '@/schemas/auth'
import { useRegister } from '@/hooks/useAuth'
import { useResendVerification } from '@/hooks/useAuth'

export default function ClientRegister() {
  const registerMutation = useRegister()
  const resendMutation = useResendVerification()
  const [submitted, setSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [resendDone, setResendDone] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterSchema),
  })

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

  const onSubmit = async (data: RegisterFormData) => {
    await registerMutation.mutateAsync({
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      password: data.password,
    })
    setSubmittedEmail(data.email)
    setSubmitted(true)
  }

  const handleResend = async () => {
    const email = submittedEmail || getValues('email')
    await resendMutation.mutateAsync(email)
    setResendDone(true)
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
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#0a0e2e' }}>weCapture4U</p>
          <p style={{ fontSize: 13, color: '#778899', marginTop: 4 }}>Create your account</p>
        </div>

        {submitted ? (
          /* Success state — inline, no redirect */
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: '#0a0e2e', marginBottom: 12 }}>
              We've sent a verification link to <strong>{submittedEmail}</strong>. Check your inbox.
            </p>
            {resendDone ? (
              <p style={{ fontSize: 13, color: '#4d79ff' }}>New link sent!</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resendMutation.isPending}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4d79ff',
                  fontSize: 13,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {resendMutation.isPending ? 'Sending…' : "Didn't receive it? Resend"}
              </button>
            )}
            <div style={{ marginTop: 24 }}>
              <Link to="/client/login" style={{ fontSize: 13, color: '#778899' }}>
                ← Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', display: 'block', marginBottom: 6 }}>
                Full Name
              </label>
              <input type="text" style={inputStyle} {...register('full_name')} />
              {errors.full_name && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.full_name.message}</p>}
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input type="email" style={inputStyle} {...register('email')} />
              {errors.email && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.email.message}</p>}
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', display: 'block', marginBottom: 6 }}>
                Phone
              </label>
              <input type="tel" style={inputStyle} {...register('phone')} />
              {errors.phone && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.phone.message}</p>}
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <input type="password" style={inputStyle} {...register('password')} />
              {errors.password && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.password.message}</p>}
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', display: 'block', marginBottom: 6 }}>
                Confirm Password
              </label>
              <input type="password" style={inputStyle} {...register('confirm_password')} />
              {errors.confirm_password && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.confirm_password.message}</p>}
            </div>

            {registerMutation.isError && (
              <p style={{ color: '#e53e3e', fontSize: 13, textAlign: 'center' }}>
                Registration failed. Please try again.
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || registerMutation.isPending}
              style={{
                width: '100%',
                background: '#4d79ff',
                color: '#fff',
                fontWeight: 700,
                fontSize: 15,
                padding: 14,
                borderRadius: 10,
                border: 'none',
                cursor: (isSubmitting || registerMutation.isPending) ? 'not-allowed' : 'pointer',
                opacity: (isSubmitting || registerMutation.isPending) ? 0.6 : 1,
                marginTop: 4,
              }}
            >
              {(isSubmitting || registerMutation.isPending) ? 'Creating account…' : 'Create Account'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: '#778899' }}>
              Already have an account?{' '}
              <Link to="/client/login" style={{ color: '#4d79ff' }}>Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
