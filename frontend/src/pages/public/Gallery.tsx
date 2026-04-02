import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useCategoryBySlug } from '../../hooks/usePortfolio'
import { Lightbox } from '../../components/public/Lightbox'
import { PublicNav } from '../../components/layout/PublicNav'

export default function Gallery() {
  const { slug } = useParams<{ slug: string }>()
  const { data: category, isLoading, isError } = useCategoryBySlug(slug ?? '')
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  if (isLoading) {
    return (
      <>
        <PublicNav />
        <div
          style={{
            minHeight: '100vh',
            background: '#0a0e2e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          Loading…
        </div>
      </>
    )
  }

  if (isError || !category) return <Navigate to="/" replace />

  return (
    <>
      <PublicNav />
      <div
        style={{
          minHeight: '100vh',
          background: '#0a0e2e',
          paddingTop: 80,
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: 48,
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <a
            href="/"
            style={{
              fontSize: 13,
              color: 'rgba(170,192,255,0.7)',
              textDecoration: 'none',
              display: 'inline-block',
              marginBottom: 16,
            }}
          >
            ← Portfolio
          </a>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            {category.name}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 32 }}>
            {category.photos.length} photos
          </p>

          {/* CSS columns masonry grid */}
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-3">
            {category.photos.map((photo, idx) => (
              <div
                key={photo.id}
                className="break-inside-avoid mb-3 cursor-pointer overflow-hidden rounded-lg group"
                onClick={() => setLightboxIdx(idx)}
              >
                <img
                  src={photo.image_url}
                  alt={`Photo ${idx + 1}`}
                  className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {lightboxIdx !== null && (
        <Lightbox
          photos={category.photos}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  )
}
