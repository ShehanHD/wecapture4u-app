// frontend/src/components/public/ReviewsSection.tsx
import { useEffect, useState } from 'react'
import type { GoogleReview } from '@/schemas/portfolio'

interface Props {
  reviews: GoogleReview[]
  reviewsUrl?: string | null
  writeReviewUrl?: string | null
  overallRating?: number | null
}

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24" fill={n <= rating ? '#FBBC05' : '#d8e0f0'}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  )
}

function GoogleColorLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export function ReviewsSection({ reviews, reviewsUrl, writeReviewUrl, overallRating }: Props) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (reviews.length < 2) return
    const t = setInterval(() => setActive((i) => (i + 1) % reviews.length), 5000)
    return () => clearInterval(t)
  }, [reviews.length])

  if (reviews.length === 0 && !writeReviewUrl) return null

  const prev = () => setActive((i) => (i - 1 + reviews.length) % reviews.length)
  const next = () => setActive((i) => (i + 1) % reviews.length)

  return (
    <section style={{ background: 'var(--pub-light)', padding: '64px 24px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <GoogleColorLogo size={24} />
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--pub-muted)', margin: 0, marginBottom: 4 }}>
                Google Reviews
              </p>
              {overallRating != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--pub-navy)', lineHeight: 1 }}>
                    {overallRating.toFixed(1)}
                  </span>
                  <Stars rating={Math.round(overallRating)} size={15} />
                </div>
              )}
            </div>
          </div>
          {reviewsUrl && (
            <a
              href={reviewsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, fontWeight: 600, color: '#4285F4', textDecoration: 'none', border: '1.5px solid #4285F4', borderRadius: 8, padding: '7px 16px', whiteSpace: 'nowrap' }}
            >
              See all on Google
            </a>
          )}
        </div>

        {/* Carousel */}
        {reviews.length > 0 && (
          <>
            <div style={{ position: 'relative', minHeight: 200 }}>
              {reviews.map((r, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: i === active ? 1 : 0,
                    transition: 'opacity 0.6s ease-in-out',
                    pointerEvents: i === active ? 'auto' : 'none',
                  }}
                >
                  <a
                    href={r.author_url ?? reviewsUrl ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none', display: 'block' }}
                  >
                    <div style={{ background: 'var(--pub-card)', border: '1px solid var(--pub-border)', borderRadius: 20, padding: '28px 28px', textAlign: 'center' }}>
                      {/* Avatar */}
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                        {r.profile_photo_url ? (
                          <img
                            src={r.profile_photo_url}
                            alt={r.author_name}
                            style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>
                              {r.author_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--pub-navy)', margin: '0 0 2px' }}>{r.author_name}</p>
                      <p style={{ fontSize: 11, color: 'var(--pub-muted)', margin: '0 0 12px' }}>{r.relative_time}</p>

                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                        <Stars rating={r.rating} size={16} />
                      </div>

                      {r.text && (
                        <p style={{ fontSize: 14, color: '#4a5568', lineHeight: 1.65, margin: 0, fontStyle: 'italic' }}>
                          "{r.text}"
                        </p>
                      )}
                    </div>
                  </a>
                </div>
              ))}

              {/* Invisible spacer to hold height of tallest card */}
              <div style={{ visibility: 'hidden', pointerEvents: 'none' }}>
                <div style={{ background: 'var(--pub-card)', border: '1px solid var(--pub-border)', borderRadius: 20, padding: '28px 28px', textAlign: 'center' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', margin: '0 auto 14px' }} />
                  <p style={{ margin: '0 0 2px', fontSize: 14 }}>x</p>
                  <p style={{ margin: '0 0 12px', fontSize: 11 }}>x</p>
                  <div style={{ marginBottom: 14, height: 16 }} />
                  {reviews.reduce((longest, r) => r.text.length > longest.length ? r.text : longest, '')}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 24 }}>
              {reviews.length > 1 && (
                <button onClick={prev} style={{ background: 'none', border: '1.5px solid var(--pub-border)', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pub-navy)', flexShrink: 0 }}>
                  ‹
                </button>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                {reviews.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    style={{ width: i === active ? 20 : 7, height: 7, borderRadius: 4, border: 'none', cursor: 'pointer', background: i === active ? 'var(--pub-accent)' : 'var(--pub-border)', padding: 0, transition: 'width 0.3s, background 0.3s' }}
                  />
                ))}
              </div>
              {reviews.length > 1 && (
                <button onClick={next} style={{ background: 'none', border: '1.5px solid var(--pub-border)', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pub-navy)', flexShrink: 0 }}>
                  ›
                </button>
              )}
            </div>
          </>
        )}

        {/* Write a review CTA */}
        {writeReviewUrl && (
          <div style={{ textAlign: 'center', marginTop: reviews.length > 0 ? 32 : 0 }}>
            <button
              onClick={() => window.open(writeReviewUrl, 'google-review', 'width=560,height=680,left=200,top=100')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--pub-navy)', color: '#fff', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
            >
              <GoogleColorLogo size={16} />
              Leave a Google Review
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
