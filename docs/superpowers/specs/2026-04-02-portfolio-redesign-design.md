# Portfolio / Public Site Redesign

## Goal

Replace the existing landing page with a mobile-first, one-page photography portfolio site inspired by the "editorial B" design: dark navy hero and footer bookending alternating light/dark sections connected by SVG wave dividers.

## Scope

This spec covers **the public-facing pages only**:
- `/` — one-page portfolio landing
- `/portfolio/:slug` — album gallery page (restyled, layout unchanged)
- `/client/login` and `/login` — login pages (restyled, logic unchanged)

The client portal (authenticated area) and admin panel are **out of scope** for this spec.

---

## Color System

New CSS custom properties added to `index.css`:

```css
--pub-navy:      #0a0e2e;   /* hero, dark sections, nav */
--pub-navy-deep: #060810;   /* footer */
--pub-navy-mid:  #1a3468;   /* gradient accents */
--pub-accent:    #4d79ff;   /* CTAs, links, highlights */
--pub-accent-lt: #7aa5ff;   /* muted accent text */
--pub-light:     #f8f9ff;   /* light section backgrounds */
--pub-card:      #ffffff;   /* cards on light sections */
--pub-border:    #e0e8ff;   /* card borders */
--pub-muted:     #778899;   /* body text on light */
```

These are scoped to the public pages — no overlap with the existing admin/client `--background`, `--foreground` tokens.

---

## Architecture

### File changes

| File | Action |
|------|--------|
| `frontend/src/pages/public/Landing.tsx` | Full rewrite — one-page layout |
| `frontend/src/components/public/HeroSection.tsx` | New — replaces HeroCarousel |
| `frontend/src/components/public/GallerySection.tsx` | New — replaces CategoryGrid |
| `frontend/src/components/public/AboutSection.tsx` | Rewrite in-place |
| `frontend/src/components/public/StatsSection.tsx` | New |
| `frontend/src/components/public/InstagramStrip.tsx` | New |
| `frontend/src/components/public/ContactSection.tsx` | New — wraps existing ContactForm |
| `frontend/src/components/public/PublicNav.tsx` | New — replaces existing nav in Landing |
| `frontend/src/components/public/WaveDivider.tsx` | New — reusable SVG wave |
| `frontend/src/components/public/PublicFooter.tsx` | New |
| `frontend/src/pages/public/Gallery.tsx` | Restyle only — dark nav, same masonry logic |
| `frontend/src/pages/auth/ClientLogin.tsx` | Restyle only — dark card on navy bg |
| `frontend/src/pages/auth/AdminLogin.tsx` | Restyle only — dark card on navy bg |
| `frontend/src/index.css` | Add public color tokens |

Existing components (`HeroCarousel`, `CategoryGrid`, `Lightbox`) are replaced or retired. `ContactForm` logic is preserved, only the wrapper changes.

---

## Components

### `PublicNav`

Sticky top bar. `position: sticky; top: 0; z-index: 50`.

- Background: `rgba(10,14,46,0.92)` + `backdrop-filter: blur(16px)`
- Left: logo "weCapture4U" (font-weight 800, white)
- Centre: nav links — Gallery · About (scroll to anchor, `color: #aac0ff`)
- Right: "Contact Us" button (ghost style: `border: 1.5px solid rgba(77,121,255,0.4); color: #7aa5ff`) — scrolls to `#contact`
- Mobile: same layout, links hidden below 380px, only logo + Contact Us button shown

### `HeroSection`

Full-bleed background photo with dark gradient overlay.

```
background:
  linear-gradient(to bottom right, rgba(10,14,46,0.88) 40%, rgba(10,14,46,0.5) 100%),
  url({hero_image}) center/cover no-repeat
```

- Hero image: the first image from the admin's portfolio (fetched via existing `/api/portfolio` endpoint), or a fallback static image
- Eyebrow pill: "✦ Photography Studio · Ireland" — `background: rgba(77,121,255,0.15); border: 1px solid rgba(77,121,255,0.3); color: #7aa5ff`
- Headline: `font-size: clamp(32px, 8vw, 56px); font-weight: 900; color: #fff` — "Capturing Life's Most Beautiful Moments" — "Most Beautiful" rendered in `color: #7aa5ff`
- Subline: `font-size: 14px; color: rgba(255,255,255,0.7); line-height: 1.7`
- Two CTA buttons:
  - "View Portfolio" — primary (`background: #4d79ff`)  — smooth-scrolls to `#gallery`
  - "🔒 Book a Session" — ghost style — links to `/client/login` (login required to book)
- Login gate note below buttons: small pill `"ℹ️ Booking requires a client account. Log in or contact us to get started."` — links "Log in" → `/client/login`, "contact us" → `#contact`
- Scroll hint at bottom: "scroll ↓"
- Min height: `100svh` on mobile

### `WaveDivider`

Reusable SVG component. Props: `fromColor`, `toColor`, `direction: 'down' | 'up'`.

```tsx
// direction="down": wave points down into next section
// direction="up":   wave points up into next section
<svg viewBox="0 0 1440 60" preserveAspectRatio="none" style={{ display:'block', width:'100%', background: fromColor }}>
  <path d={direction === 'down'
    ? 'M0,0 C480,60 960,60 1440,0 L1440,60 L0,60 Z'
    : 'M0,60 C480,0 960,0 1440,60 L1440,60 L0,60 Z'}
    fill={toColor} />
</svg>
```

Used between every section transition.

### `GallerySection` (id="gallery")

Light section (`background: #f8f9ff`). Fetches portfolio categories from `/api/portfolio/public`.

**Mobile** (< 768px): 2-column horizontally-swipeable grid
- `overflow-x: auto; scroll-snap-type: x mandatory`
- Cards arranged in a CSS grid: `grid-template-columns: repeat(N, calc(50% - 4px))` where N = number of categories
- Dot indicators below track scroll position
- Each card: `aspect-ratio: 3/4`, rounded-xl, cover photo + dark gradient overlay with category name + photo count

**Desktop** (≥ 768px): standard CSS grid `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))` — no scrolling

Each card links to `/portfolio/:slug`.

### `AboutSection` (id="about")

Dark navy section (`background: #0a0e2e`). Content sourced from admin settings (existing `/api/settings/public` or hardcoded until backend supports it).

- Circular avatar photo (100px, `border: 3px solid #4d79ff`, outer glow ring)
- Eyebrow: "About Me"
- Name heading: white, font-weight 900
- Bio paragraph: `color: rgba(255,255,255,0.65)`
- Two social buttons side by side:
  - Instagram — gradient `linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)` + IG SVG icon
  - Facebook — `background: #1877f2` + FB SVG icon
  - Both open `target="_blank"` links. URLs configurable via admin settings (Instagram handle, Facebook handle fields added to settings in a future spec — for now use `#` placeholder).

### `StatsSection`

Light section (`background: #f8f9ff`). Four stat cards in a `2×2` grid.

| Stat | Value |
|------|-------|
| Sessions completed | 500+ |
| Years of experience | 10+ |
| Average client rating | 5 ★ |
| Photo delivery time | 48h |

Cards: `background: #fff; border: 1px solid #e0e8ff; border-radius: 16px`. Number in `color: #0a0e2e`, accent character (+ / ★ / h) in `color: #4d79ff`. Label in `color: #778899`.

Stats are hardcoded strings for now — no backend integration needed.

### `InstagramStrip`

Dark navy section (`background: #0a0e2e`). Static photo strip — no live API integration.

- Eyebrow: "Follow Our Work"
- Handle: `@weCapture4U` (configurable via env or settings)
- Full-width horizontally-scrolling strip of 6 square photos (120×120px). Photos are **static placeholder images** stored in `public/instagram/` — the admin replaces them manually. No Instagram API required.
- No "Follow" buttons inside the section — social links live in the footer only.

### `ContactSection` (id="contact")

Light section (`background: #f8f9ff`). Wraps the existing `ContactForm` component in a white card (`border-radius: 20px; box-shadow: 0 8px 40px rgba(77,121,255,0.08)`).

- Section title: "Contact Us"
- Sub: "Fill in the form and I'll get back to you within 24 hours"
- Form fields: Name, Email, Phone, Message (existing schema and mutation unchanged)
- Submit button: full-width, `background: #4d79ff`

### `PublicFooter`

Dark footer (`background: #060810`).

- Logo + tagline
- Social row: Instagram + Facebook buttons (same brand-coloured pills as AboutSection)
- Nav links: Gallery · About · Contact · Client Login
- Copyright line

---

## Landing Page Assembly (`Landing.tsx`)

```tsx
<>
  <PublicNav />
  <HeroSection />
  <WaveDivider fromColor="#0a0e2e" toColor="#f8f9ff" direction="down" />
  <GallerySection />
  <WaveDivider fromColor="#f8f9ff" toColor="#0a0e2e" direction="up" />
  <AboutSection />
  <WaveDivider fromColor="#0a0e2e" toColor="#f8f9ff" direction="down" />
  <StatsSection />
  <WaveDivider fromColor="#f8f9ff" toColor="#0a0e2e" direction="up" />
  <InstagramStrip />
  <WaveDivider fromColor="#0a0e2e" toColor="#f8f9ff" direction="down" />
  <ContactSection />
  <WaveDivider fromColor="#f8f9ff" toColor="#060810" direction="up" />
  <PublicFooter />
</>
```

---

## Login Pages

Both `ClientLogin.tsx` and `AdminLogin.tsx` get a visual restyle only — no logic changes.

Layout: full-screen `background: #0a0e2e`, centred white card (`background: #fff; border-radius: 20px; padding: 40px 32px; box-shadow: 0 20px 60px rgba(0,0,0,0.3)`).

- Logo at top of card
- Form inputs: `border: 1.5px solid #e0e8ff; border-radius: 10px; background: #f8f9ff`
- Submit button: `background: #4d79ff`
- Links (forgot password, back to site): `color: #4d79ff`

---

## Gallery Page (`/portfolio/:slug`)

Restyle only. Existing masonry grid and Lightbox logic are preserved.

- Page background: `#0a0e2e`
- Top nav: same `PublicNav` component
- Breadcrumb: white text, back arrow → `/`
- Photo grid: white cards, same masonry layout
- Lightbox: unchanged

---

## Routing & Behaviour

- "Book a Session" button → `/client/login` (not a scroll-to-section, a route change)
- "Client Login" footer link → `/client/login`
- Nav "Contact Us" → smooth scroll to `#contact` anchor
- Nav "Gallery" → smooth scroll to `#gallery`
- Nav "About" → smooth scroll to `#about`
- All external social links open `target="_blank" rel="noopener noreferrer"`

---

## Out of Scope

- Instagram API / live feed
- Social media handle configuration in admin UI (placeholder `#` links for now)
- Stats editing in admin (hardcoded)
- Client portal restyling (separate spec)
- Any backend changes
