// frontend/src/pages/public/Landing.tsx
import { Helmet } from 'react-helmet-async'
import { usePublicSettings } from '../../hooks/usePortfolio'
import { PublicNav } from '../../components/layout/PublicNav'
import { HeroSection } from '../../components/public/HeroSection'
import { WaveDivider } from '../../components/public/WaveDivider'
import { GallerySection } from '../../components/public/GallerySection'
import { AboutSection } from '../../components/public/AboutSection'
import { StatsSection } from '../../components/public/StatsSection'
import { ReviewsSection } from '../../components/public/ReviewsSection'
import { InstagramStrip } from '../../components/public/InstagramStrip'
import { ContactSection } from '../../components/public/ContactSection'
import { PublicFooter } from '../../components/layout/PublicFooter'

function LandingSkeleton() {
  return (
    <>
      <PublicNav />
      {/* Hero skeleton */}
      <div style={{ height: '100vh', background: 'linear-gradient(180deg, #0d1235 0%, #0a0e2e 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }}>
        <div style={{ width: 180, height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.08)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: 320, height: 48, borderRadius: 10, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: 240, height: 16, borderRadius: 6, background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
      {/* Stats skeleton */}
      <div style={{ background: '#f8f9ff', padding: '64px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 100, borderRadius: 16, background: '#e8eeff', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      </div>
    </>
  )
}

export default function Landing() {
  const { data: settings, isLoading } = usePublicSettings()

  if (isLoading) return <LandingSkeleton />

  const title =
    settings?.meta_title ??
    (settings?.admin_name ? `${settings.admin_name} Photography` : 'Photography')

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <link rel="canonical" href={`${window.location.origin}/`} />

        {/* Standard */}
        {settings?.meta_description && <meta name="description" content={settings.meta_description} />}

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={title} />
        <meta property="og:title" content={title} />
        <meta property="og:url" content={`${window.location.origin}/`} />
        {settings?.meta_description && <meta property="og:description" content={settings.meta_description} />}
        {settings?.og_image_url && <meta property="og:image" content={settings.og_image_url} />}
        {settings?.og_image_url && <meta property="og:image:width" content="1200" />}
        {settings?.og_image_url && <meta property="og:image:height" content="630" />}

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        {settings?.meta_description && <meta name="twitter:description" content={settings.meta_description} />}
        {settings?.og_image_url && <meta name="twitter:image" content={settings.og_image_url} />}

        {/* JSON-LD — LocalBusiness + Photographer */}
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': ['LocalBusiness', 'Photographer'],
          name: title,
          url: `${window.location.origin}/`,
          ...(settings?.meta_description && { description: settings.meta_description }),
          ...(settings?.og_image_url && { image: settings.og_image_url }),
          ...(settings?.phone && { telephone: settings.phone }),
          ...(settings?.contact_email && { email: settings.contact_email }),
          ...(settings?.city && {
            address: {
              '@type': 'PostalAddress',
              addressLocality: settings.city,
              ...(settings?.country && { addressCountry: settings.country }),
            },
          }),
          ...((settings?.instagram_url || settings?.facebook_url) && {
            sameAs: [settings.instagram_url, settings.facebook_url].filter(Boolean),
          }),
          ...(settings?.google_rating != null && settings.google_reviews.length > 0 && {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: settings.google_rating.toFixed(1),
              reviewCount: settings.google_reviews.length,
              bestRating: '5',
              worstRating: '1',
            },
          }),
        })}</script>
      </Helmet>

      <PublicNav />
      <HeroSection tagline={settings?.tagline} />
      <WaveDivider fromColor="#0a0e2e" toColor="#f8f9ff" direction="down" />
      <GallerySection />
      <WaveDivider fromColor="#f8f9ff" toColor="#0a0e2e" direction="up" />
      <AboutSection
        adminName={settings?.admin_name}
        adminAvatarUrl={settings?.admin_avatar_url}
        bio={settings?.bio}
        instagramUrl={settings?.instagram_url}
        facebookUrl={settings?.facebook_url}
      />
      <WaveDivider fromColor="#0a0e2e" toColor="#f8f9ff" direction="down" />
      <StatsSection stats={settings?.stats} />
      <ReviewsSection
        reviews={settings?.google_reviews ?? []}
        reviewsUrl={settings?.google_reviews_url}
        writeReviewUrl={settings?.google_write_review_url}
        overallRating={settings?.google_rating}
      />
      <WaveDivider fromColor="#f8f9ff" toColor="#0a0e2e" direction="up" />
      <InstagramStrip instagramUrl={settings?.instagram_url} adminName={settings?.admin_name} />
      <WaveDivider fromColor="#0a0e2e" toColor="#f8f9ff" direction="down" />
      <ContactSection headline={settings?.contact_headline} />
      <WaveDivider fromColor="#f8f9ff" toColor="#060810" direction="up" />
      <PublicFooter
        adminName={settings?.admin_name}
        instagramUrl={settings?.instagram_url}
        facebookUrl={settings?.facebook_url}
      />
    </>
  )
}
