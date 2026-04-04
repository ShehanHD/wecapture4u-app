// frontend/src/components/public/InstagramStrip.tsx
import { useHeroPhotos } from '../../hooks/usePortfolio'

interface Props {
  instagramUrl?: string | null
  adminName?: string | null
}

function extractHandle(url: string | null | undefined, fallback: string | null | undefined): string {
  if (url) {
    const match = url.match(/instagram\.com\/([^/?#]+)/)
    if (match) return `@${match[1]}`
  }
  return fallback ? `@${fallback}` : '@wecapture4u'
}

export function InstagramStrip({ instagramUrl, adminName }: Props) {
  const { data: photos = [] } = useHeroPhotos()

  const handle = extractHandle(instagramUrl, adminName)
  const displayPhotos = photos.slice(0, 6)

  if (displayPhotos.length === 0) return null

  return (
    <section
      style={{
        background: 'var(--pub-navy)',
        padding: '64px 0 48px',
        overflow: 'hidden',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 32, padding: '0 24px' }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--pub-accent-lt)',
            marginBottom: 8,
          }}
        >
          Follow Our Work
        </p>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)' }}>
          {handle}
        </p>
      </div>

      {/* Scrollable photo strip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          overflowX: 'auto',
          gap: 8,
          padding: '0 24px',
          scrollbarWidth: 'none',
        }}
      >
        {displayPhotos.map((photo) => (
          <img
            key={photo.id}
            src={photo.image_url}
            alt={handle}
            style={{
              width: 120,
              height: 120,
              objectFit: 'cover',
              borderRadius: 8,
              flexShrink: 0,
            }}
            loading="lazy"
          />
        ))}
      </div>
    </section>
  )
}
