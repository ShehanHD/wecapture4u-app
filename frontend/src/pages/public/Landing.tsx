// frontend/src/pages/public/Landing.tsx
import { Helmet } from 'react-helmet-async'
import { usePublicSettings } from '../../hooks/usePortfolio'
import { PublicNav } from '../../components/layout/PublicNav'
import { HeroSection } from '../../components/public/HeroSection'
import { WaveDivider } from '../../components/public/WaveDivider'
import { GallerySection } from '../../components/public/GallerySection'
import { AboutSection } from '../../components/public/AboutSection'
import { StatsSection } from '../../components/public/StatsSection'
import { InstagramStrip } from '../../components/public/InstagramStrip'
import { ContactSection } from '../../components/public/ContactSection'
import { PublicFooter } from '../../components/layout/PublicFooter'

export default function Landing() {
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
      <StatsSection />
      <WaveDivider fromColor="#f8f9ff" toColor="#0a0e2e" direction="up" />
      <InstagramStrip />
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
