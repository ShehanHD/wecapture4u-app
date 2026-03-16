import { useEffect, useState } from 'react'

export function PublicNav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const navClass = `fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
    scrolled || menuOpen ? 'bg-[#0c0c0c] border-b border-white/10' : 'bg-transparent'
  }`

  const links = [
    { href: '#portfolio', label: 'Portfolio' },
    { href: '#about', label: 'About' },
    { href: '#contact', label: 'Contact' },
  ]

  return (
    <nav className={navClass}>
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <a href="/" className="text-amber-400 font-bold tracking-wide">
          weCapture4U
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              {l.label}
            </a>
          ))}
          <a href="/client/login" className="text-sm text-gray-300 hover:text-white">
            Login
          </a>
          <a
            href="#contact"
            className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Book Now
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white text-2xl"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#0c0c0c] border-t border-white/10 px-4 py-4 space-y-4">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="block text-gray-300 hover:text-white"
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <a
            href="/client/login"
            className="block text-gray-300 hover:text-white"
            onClick={() => setMenuOpen(false)}
          >
            Login
          </a>
          <a
            href="#contact"
            className="block bg-amber-500 text-black font-semibold px-4 py-2 rounded-lg text-center"
            onClick={() => setMenuOpen(false)}
          >
            Book Now
          </a>
        </div>
      )}
    </nav>
  )
}
