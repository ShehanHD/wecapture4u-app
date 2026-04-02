// frontend/src/components/layout/PublicNav.tsx
export function PublicNav() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(10,14,46,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(77,121,255,0.15)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 16px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <a
          href="/"
          style={{ fontWeight: 800, fontSize: 18, color: '#fff', textDecoration: 'none' }}
        >
          weCapture4U
        </a>

        {/* Centre nav links — hidden on very small screens */}
        <div
          className="hidden-xs"
          style={{ display: 'flex', gap: 32, alignItems: 'center' }}
        >
          <button
            onClick={() => scrollTo('gallery')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#aac0ff',
              fontSize: 14,
            }}
          >
            Gallery
          </button>
          <button
            onClick={() => scrollTo('about')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#aac0ff',
              fontSize: 14,
            }}
          >
            About
          </button>
        </div>

        {/* Right CTA */}
        <button
          onClick={() => scrollTo('contact')}
          style={{
            border: '1.5px solid rgba(77,121,255,0.4)',
            background: 'none',
            color: '#7aa5ff',
            fontSize: 13,
            fontWeight: 600,
            padding: '7px 16px',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Contact Us
        </button>
      </div>
    </nav>
  )
}
