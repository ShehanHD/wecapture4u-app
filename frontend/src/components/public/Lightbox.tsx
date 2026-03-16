import { useEffect, useState } from 'react'
import type { Photo } from '../../schemas/portfolio'

interface Props {
  photos: Photo[]
  initialIndex: number
  onClose: () => void
}

export function Lightbox({ photos, initialIndex, onClose }: Props) {
  const [idx, setIdx] = useState(initialIndex)

  const next = () => setIdx((i) => (i + 1) % photos.length)
  const prev = () => setIdx((i) => (i - 1 + photos.length) % photos.length)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [idx])

  const photo = photos[idx]
  if (!photo) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white text-3xl leading-none hover:text-gray-300 z-10"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>

      <img
        src={photo.image_url}
        alt={`Photo ${idx + 1}`}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev() }}
            className="absolute left-4 text-white text-4xl bg-black/30 hover:bg-black/60 w-12 h-12 rounded-full flex items-center justify-center"
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next() }}
            className="absolute right-4 text-white text-4xl bg-black/30 hover:bg-black/60 w-12 h-12 rounded-full flex items-center justify-center"
            aria-label="Next photo"
          >
            ›
          </button>
        </>
      )}

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-sm">
        {idx + 1} / {photos.length}
      </div>
    </div>
  )
}
