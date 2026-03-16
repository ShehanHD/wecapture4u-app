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
        <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center text-gray-400">
          Loading…
        </div>
      </>
    )
  }

  if (isError || !category) return <Navigate to="/" replace />

  return (
    <>
      <PublicNav />
      <div className="min-h-screen bg-[#0c0c0c] pt-20 px-4 pb-12">
        <div className="max-w-5xl mx-auto">
          <a href="/" className="text-xs text-gray-400 hover:text-white mb-4 inline-block">
            ← Portfolio
          </a>
          <h1 className="text-3xl font-bold text-white mb-1">{category.name}</h1>
          <p className="text-sm text-gray-400 mb-8">{category.photos.length} photos</p>

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
