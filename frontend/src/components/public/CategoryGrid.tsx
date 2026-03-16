import { Link } from 'react-router-dom'
import type { Category } from '../../schemas/portfolio'

export function CategoryGrid({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null
  return (
    <section id="portfolio" className="py-16 px-4 bg-black">
      <p className="text-xs uppercase tracking-widest text-gray-400 text-center mb-8">
        Browse by category
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            to={`/portfolio/${cat.slug}`}
            className="relative block overflow-hidden rounded-xl group"
            style={{ height: '200px' }}
          >
            <img
              src={cat.cover_url}
              alt={cat.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
              <span className="text-white font-bold text-xl uppercase tracking-widest">
                {cat.name}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
