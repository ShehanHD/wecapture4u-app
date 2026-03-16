import { Helmet } from 'react-helmet-async'
import { useHeroPhotos, useCategories, usePublicSettings } from '../../hooks/usePortfolio'
import { HeroCarousel } from '../../components/public/HeroCarousel'
import { CategoryGrid } from '../../components/public/CategoryGrid'
import { AboutSection } from '../../components/public/AboutSection'
import { ContactForm } from '../../components/public/ContactForm'
import { PublicNav } from '../../components/layout/PublicNav'
import { PublicFooter } from '../../components/layout/PublicFooter'

export default function Landing() {
  const { data: heroPhotos = [] } = useHeroPhotos()
  const { data: categories = [] } = useCategories()
  const { data: settings } = usePublicSettings()

  const title =
    settings?.meta_title ??
    (settings?.admin_name ? `${settings.admin_name} Photography` : 'Photography')

  return (
    <>
      <Helmet>
        <title>{title}</title>
        {settings?.meta_description && (
          <meta name="description" content={settings.meta_description} />
        )}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        {settings?.meta_description && (
          <meta property="og:description" content={settings.meta_description} />
        )}
        {settings?.og_image_url && (
          <meta property="og:image" content={settings.og_image_url} />
        )}
        <meta property="og:url" content={`${window.location.origin}/`} />
      </Helmet>

      <PublicNav />
      <HeroCarousel photos={heroPhotos} tagline={settings?.tagline} />
      <CategoryGrid categories={categories} />
      <AboutSection
        adminName={settings?.admin_name}
        adminAvatarUrl={settings?.admin_avatar_url}
        bio={settings?.bio}
        instagramUrl={settings?.instagram_url}
        facebookUrl={settings?.facebook_url}
      />
      <ContactForm headline={settings?.contact_headline} />
      <PublicFooter adminName={settings?.admin_name} />
    </>
  )
}
