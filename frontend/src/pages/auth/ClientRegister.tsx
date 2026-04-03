// frontend/src/pages/auth/ClientRegister.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RegisterSchema, type RegisterFormData } from '@/schemas/auth'
import { useRegister, useResendVerification } from '@/hooks/useAuth'

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

export default function ClientRegister() {
  const registerMutation = useRegister()
  const resendMutation = useResendVerification()
  const [submitted, setSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [resendDone, setResendDone] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting }, getValues } = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    await registerMutation.mutateAsync({ full_name: data.full_name, email: data.email, phone: data.phone, password: data.password })
    setSubmittedEmail(data.email)
    setSubmitted(true)
  }

  const handleResend = async () => {
    const email = submittedEmail || getValues('email')
    await resendMutation.mutateAsync(email)
    setResendDone(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9ff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #4d79ff, #7aa5ff)', borderRadius: 8, flexShrink: 0 }} />
        <span style={{ fontSize: 18, fontWeight: 800, color: '#0a0e2e', letterSpacing: '-0.02em' }}>weCapture4U</span>
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 380, background: '#ffffff', border: '1px solid #e0e8ff', borderRadius: 16, padding: '28px 28px 24px', boxShadow: '0 4px 20px rgba(77,121,255,0.07)' }}>
        {submitted ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#0a0e2e', marginBottom: 8 }}>Check your inbox</p>
            <p style={{ fontSize: 13, color: '#778899', marginBottom: 20 }}>
              We've sent a verification link to <strong style={{ color: '#0a0e2e' }}>{submittedEmail}</strong>.
            </p>
            {resendDone ? (
              <p style={{ fontSize: 13, color: '#4d79ff', fontWeight: 600 }}>New link sent!</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resendMutation.isPending}
                style={{ background: 'none', border: 'none', color: '#4d79ff', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                {resendMutation.isPending ? 'Sending…' : "Didn't receive it? Resend"}
              </button>
            )}
            <div style={{ marginTop: 24 }}>
              <Link to="/client/login" style={{ fontSize: 13, color: '#778899' }}>← Back to sign in</Link>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#0a0e2e', marginBottom: 4 }}>Create your account</p>
              <p style={{ fontSize: 13, color: '#778899' }}>Join weCapture4U to view your sessions</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(
                [
                  { name: 'full_name', label: 'Full Name', type: 'text', placeholder: 'Sarah Johnson' },
                  { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
                  { name: 'phone', label: 'Phone', type: 'tel', placeholder: '+44 7700 900123' },
                  { name: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
                  { name: 'confirm_password', label: 'Confirm Password', type: 'password', placeholder: '••••••••' },
                ] as const
              ).map(({ name, label, type, placeholder }) => (
                <div key={name}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#778899', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                  <input type={type} style={inputStyle} placeholder={placeholder} {...register(name)} />
                  {errors[name] && <p style={{ color: '#e05252', fontSize: 12, marginTop: 4 }}>{(errors[name] as { message?: string })?.message}</p>}
                </div>
              ))}

              {registerMutation.isError && (
                <p style={{ color: '#e05252', fontSize: 13, textAlign: 'center' }}>Registration failed. Please try again.</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || registerMutation.isPending}
                style={{ width: '100%', background: '#4d79ff', color: '#fff', fontWeight: 700, fontSize: 14, padding: '12px', borderRadius: 9, border: 'none', cursor: (isSubmitting || registerMutation.isPending) ? 'not-allowed' : 'pointer', opacity: (isSubmitting || registerMutation.isPending) ? 0.7 : 1, marginTop: 4 }}
              >
                {(isSubmitting || registerMutation.isPending) ? 'Creating account…' : 'Create Account'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#778899' }}>
              Already have an account?{' '}
              <Link to="/client/login" style={{ color: '#4d79ff', fontWeight: 600 }}>Sign in</Link>
            </p>
          </>
        )}
      </div>

      <a href="/" style={{ marginTop: 20, fontSize: 12, color: '#778899' }}>← Back to website</a>
    </div>
  )
}
