import { Link } from 'react-router-dom'
import type { Category } from '../../schemas/portfolio'

export function CategoryGrid({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null

  return (
    <section id="portfolio" className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <p className="text-xs font-semibold tracking-[0.1em] uppercase mb-2.5" style={{ color: '#6E6E73' }}>
          Portfolio
        </p>
        <h2 className="font-semibold mb-12 leading-tight" style={{ fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '-1px', color: '#1D1D1F' }}>
          Captured moments,<br />timeless stories.
        </h2>

        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: 'repeat(12, 1fr)',
          }}
        >
          {categories.map((cat, i) => {
            // First card is large (spans 7 cols / 2 rows), others alternate
            const isFeature = i === 0
            const colSpan = isFeature ? 7 : (i % 2 === 0 ? 5 : 5)
            const gridStyle: React.CSSProperties = isFeature
              ? { gridColumn: 'span 7', gridRow: 'span 2' }
              : i === 1
              ? { gridColumn: 'span 5' }
              : i === 2
              ? { gridColumn: 'span 5' }
              : { gridColumn: 'span 4' }

            void colSpan

            return (
              <Link
                key={cat.id}
                to={`/portfolio/${cat.slug}`}
                className="relative block overflow-hidden group"
                style={{
                  ...gridStyle,
                  borderRadius: 12,
                  aspectRatio: isFeature ? '4/3' : '3/2',
                  background: '#F5F5F7',
                  minHeight: 160,
                }}
              >
                <img
                  src={cat.cover_url}
                  alt={cat.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                {/* Label — visible on hover */}
                <div
                  className="absolute inset-0 flex items-end p-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.52) 0%, transparent 55%)' }}
                >
                  <span className="text-sm font-medium text-white tracking-wide">{cat.name}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
