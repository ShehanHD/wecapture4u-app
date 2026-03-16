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
    <section id="about" className="py-16 px-4 bg-[#0c0c0c]">
      <p className="text-xs uppercase tracking-widest text-gray-400 text-center mb-8">About</p>
      <div className="max-w-lg mx-auto flex flex-col items-center text-center gap-6">
        {adminAvatarUrl ? (
          <img
            src={adminAvatarUrl}
            alt={adminName ?? ''}
            className="w-24 h-24 rounded-full object-cover border-2 border-amber-500/30"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-3xl">
            {adminName?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        {adminName && <h2 className="text-white text-2xl font-bold">{adminName}</h2>}
        {bio && <p className="text-gray-400 leading-relaxed">{bio}</p>}
        <div className="flex gap-4">
          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 text-sm"
            >
              Instagram
            </a>
          )}
          {facebookUrl && (
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 text-sm"
            >
              Facebook
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
