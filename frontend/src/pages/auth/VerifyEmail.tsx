// frontend/src/pages/auth/VerifyEmail.tsx
import { useSearchParams, Link } from 'react-router-dom'
import { useVerifyEmail, useResendVerification } from '@/hooks/useAuth'
import { useState } from 'react'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { isPending, isSuccess, isError, error } = useVerifyEmail(token)
  const resendMutation = useResendVerification()
  const [resendEmail, setResendEmail] = useState('')
  const [resendDone, setResendDone] = useState(false)

  // Determine HTTP status from the error response
  const httpStatus = (error as { response?: { status?: number } })?.response?.status

  const cardStyle = {
    width: '100%',
    maxWidth: 400,
    background: '#fff',
    borderRadius: 20,
    padding: '40px 32px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    textAlign: 'center' as const,
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
    marginTop: 12,
  }

  const handleResend = async () => {
    if (!resendEmail) return
    await resendMutation.mutateAsync(resendEmail)
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
      <div style={cardStyle}>
        <p style={{ fontSize: 22, fontWeight: 800, color: '#0a0e2e', marginBottom: 8 }}>weCapture4U</p>

        {!token && (
          <>
            <p style={{ color: '#e53e3e', fontSize: 14, marginTop: 16 }}>No verification token found.</p>
            <Link to="/client/login" style={{ display: 'block', marginTop: 20, color: '#4d79ff', fontSize: 14 }}>
              Sign In
            </Link>
          </>
        )}

        {token && isPending && (
          <p style={{ color: '#778899', fontSize: 14, marginTop: 16 }}>Verifying your email…</p>
        )}

        {token && isSuccess && (
          <>
            <p style={{ color: '#0a0e2e', fontSize: 15, marginTop: 16 }}>
              Your email is verified! You can now sign in.
            </p>
            <Link
              to="/client/login"
              style={{
                display: 'inline-block',
                marginTop: 20,
                background: '#4d79ff',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                padding: '12px 28px',
                borderRadius: 10,
                textDecoration: 'none',
              }}
            >
              Sign In
            </Link>
          </>
        )}

        {token && isError && httpStatus === 410 && (
          <>
            <p style={{ color: '#e53e3e', fontSize: 14, marginTop: 16 }}>This link has expired.</p>
            {resendDone ? (
              <p style={{ color: '#4d79ff', fontSize: 13, marginTop: 12 }}>New link sent — check your inbox.</p>
            ) : (
              <div style={{ marginTop: 16 }}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={resendEmail}
                  onChange={e => setResendEmail(e.target.value)}
                  style={inputStyle}
                />
                <button
                  onClick={handleResend}
                  disabled={resendMutation.isPending || !resendEmail}
                  style={{
                    width: '100%',
                    marginTop: 12,
                    background: '#4d79ff',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    padding: '12px 28px',
                    borderRadius: 10,
                    border: 'none',
                    cursor: (resendMutation.isPending || !resendEmail) ? 'not-allowed' : 'pointer',
                    opacity: (resendMutation.isPending || !resendEmail) ? 0.6 : 1,
                  }}
                >
                  {resendMutation.isPending ? 'Sending…' : 'Resend verification email'}
                </button>
              </div>
            )}
          </>
        )}

        {token && isError && httpStatus !== 410 && (
          <>
            <p style={{ color: '#e53e3e', fontSize: 14, marginTop: 16 }}>This link is no longer valid.</p>
            <Link
              to="/client/login"
              style={{
                display: 'inline-block',
                marginTop: 20,
                background: '#4d79ff',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                padding: '12px 28px',
                borderRadius: 10,
                textDecoration: 'none',
              }}
            >
              Sign In
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
