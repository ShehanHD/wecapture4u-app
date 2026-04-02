// frontend/src/components/public/InstagramStrip.tsx
const PHOTOS = [
  '/instagram/photo-1.svg',
  '/instagram/photo-2.svg',
  '/instagram/photo-3.svg',
  '/instagram/photo-4.svg',
  '/instagram/photo-5.svg',
  '/instagram/photo-6.svg',
]

export function InstagramStrip() {
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
          @weCapture4U
        </p>
      </div>

      {/* Scrollable photo strip */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          gap: 8,
          padding: '0 24px',
          scrollbarWidth: 'none',
        }}
      >
        {PHOTOS.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Instagram photo ${i + 1}`}
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
