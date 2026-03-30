interface Props {
  adminName: string | null | undefined
  adminAvatarUrl: string | null | undefined
  bio: string | null | undefined
  instagramUrl: string | null | undefined
  facebookUrl: string | null | undefined
}

export function AboutSection({ adminName, adminAvatarUrl, bio, instagramUrl, facebookUrl }: Props) {
  if (!adminName && !bio) return null

  return (
    <section id="about" className="py-24" style={{ background: '#F5F5F7' }}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid gap-20 items-center" style={{ gridTemplateColumns: '1fr 1fr' }}>

          {/* Photo */}
          <div
            className="overflow-hidden"
            style={{ borderRadius: 16, aspectRatio: '4/5', background: '#E8E8ED' }}
          >
            {adminAvatarUrl ? (
              <img
                src={adminAvatarUrl}
                alt={adminName ?? ''}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-6xl font-bold"
                style={{ color: '#AEAEB2' }}
              >
                {adminName?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
          </div>

          {/* Text */}
          <div>
            <p className="text-xs font-semibold tracking-[0.1em] uppercase mb-4" style={{ color: '#6E6E73' }}>
              About
            </p>
            <h2 className="font-semibold mb-5 leading-tight" style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', letterSpacing: '-0.8px', color: '#1D1D1F' }}>
              {adminName ? `Behind the lens\nwith ${adminName}` : 'Behind the lens'}
            </h2>
            {bio && (
              <p className="leading-relaxed mb-8" style={{ fontSize: 16, color: '#6E6E73', lineHeight: 1.75 }}>
                {bio}
              </p>
            )}
            {(instagramUrl || facebookUrl) && (
              <div className="flex gap-5">
                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm font-medium transition-colors duration-150"
                    style={{
                      color: '#6E6E73',
                      borderBottom: '1px solid #D2D2D7',
                      paddingBottom: 2,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = '#1D1D1F'
                      e.currentTarget.style.borderBottomColor = '#1D1D1F'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = '#6E6E73'
                      e.currentTarget.style.borderBottomColor = '#D2D2D7'
                    }}
                  >
                    Instagram
                  </a>
                )}
                {facebookUrl && (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm font-medium transition-colors duration-150"
                    style={{
                      color: '#6E6E73',
                      borderBottom: '1px solid #D2D2D7',
                      paddingBottom: 2,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = '#1D1D1F'
                      e.currentTarget.style.borderBottomColor = '#1D1D1F'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = '#6E6E73'
                      e.currentTarget.style.borderBottomColor = '#D2D2D7'
                    }}
                  >
                    Facebook
                  </a>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </section>
  )
}
