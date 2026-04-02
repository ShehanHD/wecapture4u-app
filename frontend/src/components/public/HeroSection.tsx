// frontend/src/components/public/HeroSection.tsx
import { Link } from 'react-router-dom'
import { useHeroPhotos } from '../../hooks/usePortfolio'

interface Props {
  tagline?: string | null
}

export function HeroSection({ tagline }: Props) {
  const { data: heroPhotos = [] } = useHeroPhotos()
  const heroImage = heroPhotos[0]?.image_url

  const bgStyle = heroImage
    ? {
        background: `linear-gradient(to bottom right, rgba(10,14,46,0.88) 40%, rgba(10,14,46,0.5) 100%), url(${heroImage}) center/cover no-repeat`,
      }
    : {
        background: 'linear-gradient(135deg, #0a0e2e 0%, #1a3468 100%)',
      }

  return (
    <section
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px 60px',
        position: 'relative',
        ...bgStyle,
      }}
    >
      {/* Content */}
      <div style={{ maxWidth: 640, textAlign: 'center', zIndex: 1 }}>
        {/* Eyebrow pill */}
        <div
          style={{
            display: 'inline-block',
            background: 'rgba(77,121,255,0.15)',
            border: '1px solid rgba(77,121,255,0.3)',
            color: '#7aa5ff',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            padding: '6px 16px',
            borderRadius: 999,
            marginBottom: 24,
          }}
        >
          ✦ Photography Studio · Ireland
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 'clamp(32px, 8vw, 56px)',
            fontWeight: 900,
            color: '#fff',
            lineHeight: 1.15,
            marginBottom: 20,
          }}
        >
          Capturing Life's{' '}
          <span style={{ color: '#7aa5ff' }}>Most Beautiful</span>{' '}
          Moments
        </h1>

        {/* Subline */}
        <p
          style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.7,
            marginBottom: 36,
          }}
        >
          {tagline ??
            'Professional photography that tells your story. From weddings to portraits, every moment deserves to be remembered.'}
        </p>

        {/* CTA buttons */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          <button
            onClick={() =>
              document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' })
            }
            style={{
              background: '#4d79ff',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              padding: '12px 28px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            View Portfolio
          </button>

          <Link
            to="/client/login"
            style={{
              border: '1.5px solid rgba(255,255,255,0.3)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              padding: '12px 28px',
              borderRadius: 10,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            🔒 Book a Session
          </Link>
        </div>

        {/* Login gate note */}
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
          ℹ️ Booking requires a client account.{' '}
          <Link
            to="/client/login"
            style={{ color: '#7aa5ff', textDecoration: 'underline' }}
          >
            Log in
          </Link>{' '}
          or{' '}
          <button
            onClick={() =>
              document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
            }
            style={{
              background: 'none',
              border: 'none',
              color: '#7aa5ff',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: 12,
              padding: 0,
            }}
          >
            contact us
          </button>{' '}
          to get started.
        </p>
      </div>

      {/* Scroll hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.35)',
          fontSize: 11,
          letterSpacing: '0.12em',
        }}
      >
        scroll ↓
      </div>
    </section>
  )
}
