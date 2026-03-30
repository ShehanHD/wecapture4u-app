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
  const next = () => setCurrent(c => (c + 1) % count)
  const prev = () => setCurrent(c => (c - 1 + count) % count)

  useEffect(() => {
    if (!paused && photos.length > 1) {
      timerRef.current = setInterval(next, 5000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [paused, photos.length, current])

  const photo = photos[current]

  return (
    <div
      className="relative w-full overflow-hidden bg-[#1a1a1a]"
      style={{ height: '92vh', minHeight: 600 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Photo */}
      {photo ? (
        <img src={photo.image_url} alt="Hero" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #2c2c2e 0%, #1a1a1a 100%)' }} />
      )}

      {/* Subtle bottom fade */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: '55%', background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)' }}
      />

      {/* Content */}
      <div className="absolute inset-x-0 bottom-0 max-w-5xl mx-auto px-6 pb-20">
        <p className="text-xs font-medium tracking-[0.14em] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Photography
        </p>
        {tagline && (
          <p className="font-light text-white mb-8 leading-tight" style={{ fontSize: 'clamp(36px, 6vw, 68px)', letterSpacing: '-1.5px' }}>
            {tagline}
          </p>
        )}
        <a
          href="#contact"
          className="inline-flex items-center gap-2 text-sm font-medium px-7 py-3.5 rounded-full bg-white hover:opacity-88 transition-opacity"
          style={{ color: '#1D1D1F' }}
        >
          Book a Session
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* Prev / Next */}
      {photos.length > 1 && (
        <>
          <button
            aria-label="Previous"
            onClick={prev}
            className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors"
            style={{ background: 'rgba(0,0,0,0.25)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.5)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.25)')}
          >
            ‹
          </button>
          <button
            aria-label="Next"
            onClick={next}
            className="absolute right-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors"
            style={{ background: 'rgba(0,0,0,0.25)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.5)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.25)')}
          >
            ›
          </button>
        </>
      )}

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex gap-1.5">
          {photos.map((_, i) => (
            <button
              key={i}
              data-testid="carousel-dot"
              data-index={i}
              data-active={i === current}
              onClick={() => setCurrent(i)}
              aria-label={`Go to photo ${i + 1}`}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === current ? 18 : 6,
                background: i === current ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
              }}
            />
          ))}
        </div>
      )}

      {/* Scroll indicator */}
      <div className="absolute bottom-7 right-7 flex flex-col items-center gap-1.5" style={{ opacity: 0.3 }}>
        <div
          className="w-px bg-white"
          style={{ height: 36, animation: 'heroScrollPulse 2s ease-in-out infinite' }}
        />
        <span className="text-white" style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Scroll</span>
      </div>

      <style>{`
        @keyframes heroScrollPulse {
          0%, 100% { transform: scaleY(1); opacity: .4; }
          50%       { transform: scaleY(.4); opacity: .1; }
        }
      `}</style>
    </div>
  )
}
