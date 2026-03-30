import { useEffect, useState } from 'react'

export function PublicNav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const links = [
    { href: '#portfolio', label: 'Portfolio' },
    { href: '#about', label: 'About' },
    { href: '#contact', label: 'Contact' },
  ]

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{
        background: scrolled || menuOpen
          ? 'rgba(255,255,255,0.88)'
          : 'rgba(255,255,255,0)',
        backdropFilter: scrolled || menuOpen ? 'saturate(180%) blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled || menuOpen ? 'saturate(180%) blur(20px)' : 'none',
        borderBottom: scrolled || menuOpen ? '1px solid #E8E8ED' : '1px solid transparent',
      }}
    >
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-sm font-semibold tracking-tight" style={{ color: scrolled || menuOpen ? '#1D1D1F' : '#ffffff' }}>
          weCapture4U
        </a>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm transition-colors duration-150"
              style={{ color: scrolled || menuOpen ? '#6E6E73' : 'rgba(255,255,255,0.75)' }}
              onMouseEnter={e => (e.currentTarget.style.color = scrolled || menuOpen ? '#1D1D1F' : '#ffffff')}
              onMouseLeave={e => (e.currentTarget.style.color = scrolled || menuOpen ? '#6E6E73' : 'rgba(255,255,255,0.75)')}
            >
              {l.label}
            </a>
          ))}
          <a
            href="/client/login"
            className="text-sm transition-colors duration-150"
            style={{ color: scrolled || menuOpen ? '#6E6E73' : 'rgba(255,255,255,0.75)' }}
          >
            Login
          </a>
          <a
            href="#contact"
            className="text-sm font-medium px-5 py-2 rounded-full transition-opacity duration-150 hover:opacity-80"
            style={{
              background: scrolled || menuOpen ? '#1D1D1F' : 'rgba(255,255,255,0.95)',
              color: scrolled || menuOpen ? '#ffffff' : '#1D1D1F',
            }}
          >
            Book a Session
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-xl leading-none"
          style={{ color: scrolled || menuOpen ? '#1D1D1F' : '#ffffff' }}
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t px-6 py-5 space-y-4" style={{ borderColor: '#E8E8ED' }}>
          {links.map(l => (
            <a
              key={l.href}
              href={l.href}
              className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <a
            href="/client/login"
            className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            Login
          </a>
          <a
            href="#contact"
            className="inline-block text-sm font-medium px-5 py-2.5 rounded-full bg-[#1D1D1F] text-white"
            onClick={() => setMenuOpen(false)}
          >
            Book a Session
          </a>
        </div>
      )}
    </nav>
  )
}
