// frontend/src/components/public/GallerySection.tsx
import { useRef, useState, useEffect } from 'react'
import { useCategories } from '../../hooks/usePortfolio'
import type { Category } from '../../schemas/portfolio'

function CategoryCard({ category }: { category: Category }) {
  return (
    <a
      href={`/portfolio/${category.slug}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        style={{
          aspectRatio: '3/4',
          borderRadius: 12,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <img
          src={category.cover_url}
          alt={category.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(10,14,46,0.8) 0%, transparent 50%)',
            display: 'flex',
            alignItems: 'flex-end',
            padding: '12px 14px',
          }}
        >
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
              {category.name}
            </span>
          </div>
        </div>
      </div>
    </a>
  )
}

export function GallerySection() {
  const { data: categories = [] } = useCategories()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [activePage, setActivePage] = useState(0)
  const pageCount = Math.ceil(categories.length / 2)

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const handler = () => {
      const page = Math.round(el.scrollLeft / (el.scrollWidth / pageCount))
      setActivePage(page)
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [pageCount])

  return (
    <section
      id="gallery"
      style={{ background: 'var(--pub-light)', padding: '64px 0 48px' }}
    >
      <div style={{ textAlign: 'center', marginBottom: 32, padding: '0 16px' }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--pub-accent)',
            marginBottom: 8,
          }}
        >
          Portfolio
        </p>
        <h2
          style={{
            fontSize: 'clamp(24px, 5vw, 36px)',
            fontWeight: 800,
            color: 'var(--pub-navy)',
          }}
        >
          Our Work
        </h2>
      </div>

      {/* Mobile: swipeable 2-col grid */}
      <div className="md:hidden">
        <div
          ref={viewportRef}
          style={{
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            padding: '0 12px 16px',
            scrollbarWidth: 'none',
          }}
        >
          <style>{`.swipe-viewport::-webkit-scrollbar { display: none; }`}</style>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${categories.length}, calc(50vw - 20px))`,
              gridTemplateRows: 'auto',
              gap: 8,
              width: 'max-content',
            }}
          >
            {categories.map((cat) => (
              <div
                key={cat.id}
                style={{ scrollSnapAlign: 'start', width: 'calc(50vw - 20px)' }}
              >
                <CategoryCard category={cat} />
              </div>
            ))}
          </div>
        </div>

        {/* Dot indicators */}
        {pageCount > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 0 4px',
            }}
          >
            {Array.from({ length: pageCount }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === activePage ? 16 : 6,
                  height: 6,
                  borderRadius: i === activePage ? 3 : '50%',
                  background: i === activePage ? 'var(--pub-accent)' : '#ccd',
                  transition: 'width 0.2s',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: auto-fill grid */}
      <div
        className="hidden md:block"
        style={{ padding: '0 24px', maxWidth: 1200, margin: '0 auto' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {categories.map((cat) => (
            <CategoryCard key={cat.id} category={cat} />
          ))}
        </div>
      </div>
    </section>
  )
}
