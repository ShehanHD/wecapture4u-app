// frontend/src/pages/public/NotFound.tsx
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--pub-navy, #0a0e2e)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <p style={{ fontSize: 96, fontWeight: 900, color: 'rgba(77,121,255,0.15)', lineHeight: 1, margin: 0 }}>
        404
      </p>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: '12px 0 8px' }}>
        Page not found
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 32, maxWidth: 320 }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        style={{
          display: 'inline-block',
          background: '#4d79ff',
          color: '#fff',
          borderRadius: 10,
          padding: '12px 28px',
          fontSize: 14,
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        Back to Homepage
      </Link>
    </div>
  )
}
