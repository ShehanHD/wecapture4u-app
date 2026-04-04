// frontend/src/components/public/HeroSection.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHeroPhotos } from '../../hooks/usePortfolio'

interface Props {
  tagline?: string | null
}

const INTERVAL_MS = 5000

export function HeroSection({ tagline }: Props) {
  const { data: heroPhotos = [] } = useHeroPhotos()
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (heroPhotos.length < 2) return
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % heroPhotos.length)
    }, INTERVAL_MS)
    return () => clearInterval(timer)
  }, [heroPhotos.length])

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
        overflow: 'hidden',
        background: '#0a0e2e',
      }}
    >
      {/* Carousel background slides */}
      {heroPhotos.length > 0
        ? heroPhotos.map((photo, i) => (
            <div
              key={photo.id}
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url(${photo.image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: i === activeIndex ? 1 : 0,
                transition: 'opacity 1s ease-in-out',
              }}
            />
          ))
        : null}

      {/* Dark overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom right, rgba(10,14,46,0.88) 40%, rgba(10,14,46,0.5) 100%)',
        }}
      />

      {/* Content */}
      <div style={{ maxWidth: 640, textAlign: 'center', zIndex: 1, position: 'relative' }}>
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
          ✦ Photography Studio · Milan
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
            View Gallery
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
            Client Login
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

      {/* Dot indicators */}
      {heroPhotos.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 52,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 6,
            zIndex: 1,
          }}
        >
          {heroPhotos.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              style={{
                width: i === activeIndex ? 20 : 6,
                height: 6,
                borderRadius: 999,
                background: i === activeIndex ? '#7aa5ff' : 'rgba(255,255,255,0.35)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'width 0.3s ease, background 0.3s ease',
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}

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
          zIndex: 1,
        }}
      >
        scroll ↓
      </div>
    </section>
  )
}
