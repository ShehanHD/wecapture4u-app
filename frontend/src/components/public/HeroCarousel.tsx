import { useEffect, useRef, useState } from 'react'
import type { HeroPhoto } from '../../schemas/portfolio'

interface Props {
  photos: HeroPhoto[]
  tagline: string | null | undefined
}

export function HeroCarousel({ photos, tagline }: Props) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const count = Math.max(photos.length, 1)
  const next = () => setCurrent((c) => (c + 1) % count)
  const prev = () => setCurrent((c) => (c - 1 + count) % count)

  useEffect(() => {
    if (!paused && photos.length > 1) {
      timerRef.current = setInterval(next, 5000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [paused, photos.length, current])

  const photo = photos[current]

  return (
    <div
      className="relative w-full h-screen overflow-hidden bg-black"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {photo ? (
        <img src={photo.image_url} alt="Hero" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-[#0c0c0c]" />
      )}

      {/* Bottom gradient + text overlay */}
      <div
        className="absolute inset-x-0 bottom-0 h-2/5 flex flex-col items-center justify-end pb-16 px-4"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))' }}
      >
        <p className="text-xs uppercase tracking-widest text-gray-300 mb-2">Photography</p>
        {tagline && (
          <p className="text-white text-2xl md:text-4xl font-light text-center mb-6">{tagline}</p>
        )}
        <a
          href="#contact"
          className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-8 py-3 rounded-full transition-colors"
        >
          Book a Session
        </a>
      </div>

      {/* Arrow buttons */}
      {photos.length > 1 && (
        <>
          <button
            aria-label="Previous"
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          >
            ‹
          </button>
          <button
            aria-label="Next"
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          >
            ›
          </button>
        </>
      )}

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div className="absolute bottom-6 right-6 flex gap-2">
          {photos.map((_, i) => (
            <button
              key={i}
              data-testid="carousel-dot"
              data-index={i}
              data-active={i === current}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === current ? 'bg-amber-400 w-4' : 'bg-white/35'
              }`}
              aria-label={`Go to photo ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
