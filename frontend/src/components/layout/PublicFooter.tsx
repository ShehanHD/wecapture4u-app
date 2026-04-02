// frontend/src/components/layout/PublicFooter.tsx
interface Props {
  adminName?: string | null
  instagramUrl?: string | null
  facebookUrl?: string | null
}

export function PublicFooter({ adminName, instagramUrl, facebookUrl }: Props) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <footer
      style={{
        background: 'var(--pub-navy-deep)',
        padding: '48px 24px 32px',
        textAlign: 'center',
      }}
    >
      {/* Logo + tagline */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
          weCapture4U
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          Capturing life's most beautiful moments
        </p>
      </div>

      {/* Social buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 28 }}>
        {instagramUrl && (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Instagram
          </a>
        )}
        {facebookUrl && (
          <a
            href={facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              background: '#1877f2',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Facebook
          </a>
        )}
      </div>

      {/* Nav links */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 24,
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        {[
          { label: 'Gallery', action: () => scrollTo('gallery') },
          { label: 'About', action: () => scrollTo('about') },
          { label: 'Contact', action: () => scrollTo('contact') },
        ].map(({ label, action }) => (
          <button
            key={label}
            onClick={action}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.45)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
        <a
          href="/client/login"
          style={{
            color: 'rgba(255,255,255,0.45)',
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Client Login
        </a>
      </div>

      {/* Copyright */}
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
        © {new Date().getFullYear()}{' '}
        {adminName ? `${adminName} Photography` : 'Photography'}. All rights reserved.
      </p>
    </footer>
  )
}
