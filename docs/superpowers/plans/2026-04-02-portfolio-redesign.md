# Portfolio / Public Site Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing public-facing pages (landing, gallery, login) with a mobile-first "editorial B" design — dark navy hero/footer bookending alternating light/dark sections connected by SVG wave dividers.

**Architecture:** All changes are frontend-only. New section components are created under `components/public/`. Existing `PublicNav` and `PublicFooter` in `components/layout/` are rewritten in-place. `Landing.tsx` is reassembled from new section components. Login pages and Gallery page receive visual-only restyles with no logic changes.

**Tech Stack:** React 18, TypeScript (strict), Tailwind CSS v3, react-hook-form + zod, TanStack Query, React Router v6, react-helmet-async.

---

## File Map

| File | Action |
|------|--------|
| `frontend/src/index.css` | Add `--pub-*` CSS custom properties inside `:root` |
| `frontend/src/components/public/WaveDivider.tsx` | Create — reusable SVG wave between sections |
| `frontend/src/components/layout/PublicNav.tsx` | Rewrite — dark navy sticky nav per spec |
| `frontend/src/components/public/HeroSection.tsx` | Create — full-bleed hero with portfolio photo |
| `frontend/src/components/public/GallerySection.tsx` | Create — 2-col swipeable mobile grid, standard desktop grid |
| `frontend/src/components/public/AboutSection.tsx` | Rewrite — dark navy, branded IG + FB buttons |
| `frontend/src/components/public/StatsSection.tsx` | Create — 4-card stat grid, hardcoded values |
| `frontend/src/components/public/InstagramStrip.tsx` | Create — static photo strip, no API |
| `frontend/src/schemas/portfolio.ts` | Modify — add `phone` to `ContactFormSchema` |
| `frontend/src/components/public/ContactForm.tsx` | Modify — add Phone field, restyle for light section |
| `frontend/src/components/public/ContactSection.tsx` | Create — white card wrapper around ContactForm |
| `frontend/src/components/layout/PublicFooter.tsx` | Rewrite — dark footer with social links, nav links |
| `frontend/src/pages/public/Landing.tsx` | Rewrite — assemble all sections with WaveDividers |
| `frontend/src/pages/auth/ClientLogin.tsx` | Restyle — dark card on navy bg, logic unchanged |
| `frontend/src/pages/auth/AdminLogin.tsx` | Restyle — dark card on navy bg, logic unchanged |
| `frontend/src/pages/public/Gallery.tsx` | Restyle — dark navy bg, PublicNav, breadcrumb |
| `frontend/public/instagram/` | Create — 6 placeholder JPG images for Instagram strip |

---

## Task 1: CSS Color Tokens

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add public color tokens to `:root`**

Open `frontend/src/index.css`. Inside the `:root { ... }` block (after the existing `--sidebar-ring` line, before the closing `}`), add:

```css
    /* ── Public site palette ─────────────────────────── */
    --pub-navy:      #0a0e2e;
    --pub-navy-deep: #060810;
    --pub-navy-mid:  #1a3468;
    --pub-accent:    #4d79ff;
    --pub-accent-lt: #7aa5ff;
    --pub-light:     #f8f9ff;
    --pub-card:      #ffffff;
    --pub-border:    #e0e8ff;
    --pub-muted:     #778899;
```

- [ ] **Step 2: Verify tokens don't conflict**

Run `grep -n "pub-navy\|pub-accent\|pub-light" frontend/src/index.css` — should find exactly the 9 lines just added, nowhere else.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(public): add pub-* CSS color tokens"
```

---

## Task 2: WaveDivider Component

**Files:**
- Create: `frontend/src/components/public/WaveDivider.tsx`

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/public/WaveDivider.tsx
interface Props {
  fromColor: string
  toColor: string
  direction: 'down' | 'up'
}

export function WaveDivider({ fromColor, toColor, direction }: Props) {
  const path =
    direction === 'down'
      ? 'M0,0 C480,60 960,60 1440,0 L1440,60 L0,60 Z'
      : 'M0,60 C480,0 960,0 1440,60 L1440,60 L0,60 Z'

  return (
    <svg
      viewBox="0 0 1440 60"
      preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', background: fromColor }}
      aria-hidden="true"
    >
      <path d={path} fill={toColor} />
    </svg>
  )
}
```

- [ ] **Step 2: Smoke-check TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep WaveDivider
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/public/WaveDivider.tsx
git commit -m "feat(public): add WaveDivider SVG component"
```

---

## Task 3: PublicNav Rewrite

**Files:**
- Modify: `frontend/src/components/layout/PublicNav.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire content of `frontend/src/components/layout/PublicNav.tsx`:

```tsx
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
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep PublicNav
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/PublicNav.tsx
git commit -m "feat(public): rewrite PublicNav — dark navy sticky nav"
```

---

## Task 4: HeroSection

**Files:**
- Create: `frontend/src/components/public/HeroSection.tsx`

The hero uses the first photo from `useHeroPhotos()` as the background. If none, it falls back to a plain navy gradient.

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/public/HeroSection.tsx
import { Link } from 'react-router-dom'
import { useHeroPhotos } from '../../hooks/usePortfolio'

interface Props {
  tagline?: string | null
}

export function HeroSection({ tagline }: Props) {
  const { data: heroPhotos = [] } = useHeroPhotos()
  const heroImage = heroPhotos[0]?.image_url

  const bgStyle = heroImage
    ? {
        background: `linear-gradient(to bottom right, rgba(10,14,46,0.88) 40%, rgba(10,14,46,0.5) 100%), url(${heroImage}) center/cover no-repeat`,
      }
    : {
        background: 'linear-gradient(135deg, #0a0e2e 0%, #1a3468 100%)',
      }

  return (
    <section
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px 60px',
        position: 'relative',
        ...bgStyle,
      }}
    >
      {/* Content */}
      <div style={{ maxWidth: 640, textAlign: 'center', zIndex: 1 }}>
        {/* Eyebrow pill */}
        <div
          style={{
            display: 'inline-block',
            background: 'rgba(77,121,255,0.15)',
            border: '1px solid rgba(77,121,255,0.3)',
            color: '#7aa5ff',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            padding: '6px 16px',
            borderRadius: 999,
            marginBottom: 24,
          }}
        >
          ✦ Photography Studio · Ireland
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 'clamp(32px, 8vw, 56px)',
            fontWeight: 900,
            color: '#fff',
            lineHeight: 1.15,
            marginBottom: 20,
          }}
        >
          Capturing Life's{' '}
          <span style={{ color: '#7aa5ff' }}>Most Beautiful</span>{' '}
          Moments
        </h1>

        {/* Subline */}
        <p
          style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.7,
            marginBottom: 36,
          }}
        >
          {tagline ??
            'Professional photography that tells your story. From weddings to portraits, every moment deserves to be remembered.'}
        </p>

        {/* CTA buttons */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          <button
            onClick={() =>
              document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' })
            }
            style={{
              background: '#4d79ff',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              padding: '12px 28px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            View Portfolio
          </button>

          <Link
            to="/client/login"
            style={{
              border: '1.5px solid rgba(255,255,255,0.3)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              padding: '12px 28px',
              borderRadius: 10,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            🔒 Book a Session
          </Link>
        </div>

        {/* Login gate note */}
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
          ℹ️ Booking requires a client account.{' '}
          <Link
            to="/client/login"
            style={{ color: '#7aa5ff', textDecoration: 'underline' }}
          >
            Log in
          </Link>{' '}
          or{' '}
          <button
            onClick={() =>
              document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
            }
            style={{
              background: 'none',
              border: 'none',
              color: '#7aa5ff',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: 12,
              padding: 0,
            }}
          >
            contact us
          </button>{' '}
          to get started.
        </p>
      </div>

      {/* Scroll hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.35)',
          fontSize: 11,
          letterSpacing: '0.12em',
        }}
      >
        scroll ↓
      </div>
    </section>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep HeroSection
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/public/HeroSection.tsx
git commit -m "feat(public): add HeroSection with portfolio background photo"
```

---

## Task 5: GallerySection

**Files:**
- Create: `frontend/src/components/public/GallerySection.tsx`

Mobile: 2-column horizontally-swipeable grid with scroll snap and dot indicators.
Desktop (≥768px): standard auto-fill grid.

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/public/GallerySection.tsx
import { useRef, useState, useEffect } from 'react'
import { useCategories } from '../../hooks/usePortfolio'
import type { Category } from '../../schemas/portfolio'

function CategoryCard({ category }: { category: Category }) {
  return (
    <a
      href={`/portfolio/${category.slug}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        style={{
          aspectRatio: '3/4',
          borderRadius: 12,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <img
          src={category.cover_url}
          alt={category.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(10,14,46,0.8) 0%, transparent 50%)',
            display: 'flex',
            alignItems: 'flex-end',
            padding: '12px 14px',
          }}
        >
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
              {category.name}
            </span>
          </div>
        </div>
      </div>
    </a>
  )
}

export function GallerySection() {
  const { data: categories = [] } = useCategories()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [activePage, setActivePage] = useState(0)
  const pageCount = Math.ceil(categories.length / 2)

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const handler = () => {
      const page = Math.round(el.scrollLeft / (el.scrollWidth / pageCount))
      setActivePage(page)
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [pageCount])

  return (
    <section
      id="gallery"
      style={{ background: 'var(--pub-light)', padding: '64px 0 48px' }}
    >
      <div style={{ textAlign: 'center', marginBottom: 32, padding: '0 16px' }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--pub-accent)',
            marginBottom: 8,
          }}
        >
          Portfolio
        </p>
        <h2
          style={{
            fontSize: 'clamp(24px, 5vw, 36px)',
            fontWeight: 800,
            color: 'var(--pub-navy)',
          }}
        >
          Our Work
        </h2>
      </div>

      {/* Mobile: swipeable 2-col grid */}
      <div className="md:hidden">
        <div
          ref={viewportRef}
          style={{
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            padding: '0 12px 16px',
            scrollbarWidth: 'none',
          }}
        >
          <style>{`.swipe-viewport::-webkit-scrollbar { display: none; }`}</style>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${categories.length}, calc(50vw - 20px))`,
              gridTemplateRows: 'auto',
              gap: 8,
              width: 'max-content',
            }}
          >
            {categories.map((cat) => (
              <div
                key={cat.id}
                style={{ scrollSnapAlign: 'start', width: 'calc(50vw - 20px)' }}
              >
                <CategoryCard category={cat} />
              </div>
            ))}
          </div>
        </div>

        {/* Dot indicators */}
        {pageCount > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 0 4px',
            }}
          >
            {Array.from({ length: pageCount }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === activePage ? 16 : 6,
                  height: 6,
                  borderRadius: i === activePage ? 3 : '50%',
                  background: i === activePage ? 'var(--pub-accent)' : '#ccd',
                  transition: 'width 0.2s',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: auto-fill grid */}
      <div
        className="hidden md:block"
        style={{ padding: '0 24px', maxWidth: 1200, margin: '0 auto' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {categories.map((cat) => (
            <CategoryCard key={cat.id} category={cat} />
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep GallerySection
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/public/GallerySection.tsx
git commit -m "feat(public): add GallerySection with mobile swipe grid"
```

---

## Task 6: AboutSection Rewrite

**Files:**
- Modify: `frontend/src/components/public/AboutSection.tsx`

Dark navy section. Branded Instagram (gradient) and Facebook (blue) buttons. Avatar with blue border + glow ring.

- [ ] **Step 1: Rewrite the file**

Replace the entire content of `frontend/src/components/public/AboutSection.tsx`:

```tsx
// frontend/src/components/public/AboutSection.tsx
interface Props {
  adminName: string | null | undefined
  adminAvatarUrl: string | null | undefined
  bio: string | null | undefined
  instagramUrl: string | null | undefined
  facebookUrl: string | null | undefined
}

export function AboutSection({
  adminName,
  adminAvatarUrl,
  bio,
  instagramUrl,
  facebookUrl,
}: Props) {
  return (
    <section
      id="about"
      style={{
        background: 'var(--pub-navy)',
        padding: '72px 24px',
      }}
    >
      <div
        style={{
          maxWidth: 560,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 20,
        }}
      >
        {/* Avatar */}
        {adminAvatarUrl ? (
          <div
            style={{
              padding: 4,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4d79ff, #7aa5ff)',
              boxShadow: '0 0 0 4px rgba(77,121,255,0.15)',
            }}
          >
            <img
              src={adminAvatarUrl}
              alt={adminName ?? ''}
              style={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                objectFit: 'cover',
                display: 'block',
                border: '3px solid var(--pub-navy)',
              }}
            />
          </div>
        ) : (
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'rgba(77,121,255,0.15)',
              border: '3px solid #4d79ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              fontWeight: 800,
              color: '#4d79ff',
            }}
          >
            {adminName?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}

        {/* Eyebrow */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--pub-accent-lt)',
          }}
        >
          About Me
        </p>

        {/* Name */}
        {adminName && (
          <h2
            style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: 0 }}
          >
            {adminName}
          </h2>
        )}

        {/* Bio */}
        {bio && (
          <p
            style={{
              fontSize: 15,
              color: 'rgba(255,255,255,0.65)',
              lineHeight: 1.75,
            }}
          >
            {bio}
          </p>
        )}

        {/* Social buttons */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 20px',
                borderRadius: 8,
                background:
                  'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              {/* Instagram SVG icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
              Instagram
            </a>
          )}

          {facebookUrl && (
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 20px',
                borderRadius: 8,
                background: '#1877f2',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              {/* Facebook SVG icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep AboutSection
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/public/AboutSection.tsx
git commit -m "feat(public): rewrite AboutSection — dark navy, branded social buttons"
```

---

## Task 7: StatsSection

**Files:**
- Create: `frontend/src/components/public/StatsSection.tsx`

Hardcoded stats. 2×2 grid on mobile, 4-column on desktop.

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/public/StatsSection.tsx
const STATS = [
  { value: '500', accent: '+', label: 'Sessions completed' },
  { value: '10', accent: '+', label: 'Years of experience' },
  { value: '5', accent: ' ★', label: 'Average client rating' },
  { value: '48', accent: 'h', label: 'Photo delivery time' },
]

export function StatsSection() {
  return (
    <section
      style={{ background: 'var(--pub-light)', padding: '64px 24px' }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
          }}
        >
          {STATS.map((stat) => (
            <div
              key={stat.label}
              style={{
                background: 'var(--pub-card)',
                border: '1px solid var(--pub-border)',
                borderRadius: 16,
                padding: '28px 20px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: 'var(--pub-navy)',
                  lineHeight: 1,
                }}
              >
                {stat.value}
                <span style={{ color: 'var(--pub-accent)' }}>{stat.accent}</span>
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: 'var(--pub-muted)',
                  lineHeight: 1.4,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep StatsSection
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/public/StatsSection.tsx
git commit -m "feat(public): add StatsSection with hardcoded stats"
```

---

## Task 8: InstagramStrip + Static Placeholders

**Files:**
- Create: `frontend/src/components/public/InstagramStrip.tsx`
- Create: `frontend/public/instagram/` directory with 6 placeholder images

- [ ] **Step 1: Create the placeholder images directory**

```bash
mkdir -p frontend/public/instagram
```

Create 6 small placeholder SVG files (browsers render them as images — no external fetch needed):

```bash
for i in 1 2 3 4 5 6; do
cat > frontend/public/instagram/photo-${i}.jpg << 'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
  <rect width="120" height="120" fill="#1a2550"/>
  <text x="60" y="68" text-anchor="middle" fill="#4d79ff" font-size="32">📷</text>
</svg>
SVG
done
```

(These are SVG content in `.jpg` files — browsers handle this fine as placeholders. The admin replaces them with real JPGs.)

- [ ] **Step 2: Create the component**

```tsx
// frontend/src/components/public/InstagramStrip.tsx
const PHOTOS = [
  '/instagram/photo-1.jpg',
  '/instagram/photo-2.jpg',
  '/instagram/photo-3.jpg',
  '/instagram/photo-4.jpg',
  '/instagram/photo-5.jpg',
  '/instagram/photo-6.jpg',
]

export function InstagramStrip() {
  return (
    <section
      style={{
        background: 'var(--pub-navy)',
        padding: '64px 0 48px',
        overflow: 'hidden',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 32, padding: '0 24px' }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--pub-accent-lt)',
            marginBottom: 8,
          }}
        >
          Follow Our Work
        </p>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)' }}>
          @weCapture4U
        </p>
      </div>

      {/* Scrollable photo strip */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          gap: 8,
          padding: '0 24px',
          scrollbarWidth: 'none',
        }}
      >
        {PHOTOS.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Instagram photo ${i + 1}`}
            style={{
              width: 120,
              height: 120,
              objectFit: 'cover',
              borderRadius: 8,
              flexShrink: 0,
            }}
            loading="lazy"
          />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep InstagramStrip
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/public/InstagramStrip.tsx frontend/public/instagram/
git commit -m "feat(public): add InstagramStrip with static photo placeholders"
```

---

## Task 9: ContactSection + Phone Field

**Files:**
- Modify: `frontend/src/schemas/portfolio.ts` — add `phone` to `ContactFormSchema`
- Modify: `frontend/src/components/public/ContactForm.tsx` — add Phone field, restyle for light section
- Create: `frontend/src/components/public/ContactSection.tsx` — white card wrapper

- [ ] **Step 1: Add phone to ContactFormSchema**

In `frontend/src/schemas/portfolio.ts`, replace:

```ts
export const ContactFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address').max(254),
  message: z.string().min(1, 'Message is required').max(5000),
})
```

with:

```ts
export const ContactFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address').max(254),
  phone: z.string().max(30).optional(),
  message: z.string().min(1, 'Message is required').max(5000),
})
```

- [ ] **Step 2: Run TypeScript to see any downstream breakage**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i contact
```

If there are errors in the backend API layer about missing `phone` field, note them — the backend already accepts optional fields gracefully (Pydantic ignores extra fields), so no backend change is needed.

- [ ] **Step 3: Rewrite ContactForm for light section style**

Replace the entire content of `frontend/src/components/public/ContactForm.tsx`:

```tsx
// frontend/src/components/public/ContactForm.tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ContactFormSchema, type ContactForm as ContactFormData } from '../../schemas/portfolio'
import { useSubmitContact } from '../../hooks/usePortfolio'

interface Props {
  headline?: string | null
}

export function ContactForm({ headline }: Props) {
  const [submitted, setSubmitted] = useState(false)
  const submitMutation = useSubmitContact()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(ContactFormSchema),
  })

  const onSubmit = async (data: ContactFormData) => {
    try {
      await submitMutation.mutateAsync(data)
      setSubmitted(true)
    } catch {}
  }

  const inputStyle = {
    width: '100%',
    border: '1.5px solid var(--pub-border)',
    borderRadius: 10,
    background: 'var(--pub-light)',
    padding: '12px 16px',
    fontSize: 14,
    color: 'var(--pub-navy)',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  if (submitted) {
    return (
      <p style={{ textAlign: 'center', color: 'var(--pub-accent)', fontSize: 16, padding: '20px 0' }}>
        Thanks! I'll be in touch soon.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {headline && (
        <p style={{ fontSize: 14, color: 'var(--pub-muted)', marginBottom: 4 }}>{headline}</p>
      )}
      {submitMutation.isError && (
        <p style={{ color: '#e53e3e', fontSize: 13, textAlign: 'center' }}>
          Something went wrong. Please try again.
        </p>
      )}

      <div>
        <input placeholder="Your name" style={inputStyle} {...register('name')} />
        {errors.name && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.name.message}</p>}
      </div>

      <div>
        <input type="email" placeholder="Email address" style={inputStyle} {...register('email')} />
        {errors.email && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.email.message}</p>}
      </div>

      <div>
        <input type="tel" placeholder="Phone number (optional)" style={inputStyle} {...register('phone')} />
        {errors.phone && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.phone.message}</p>}
      </div>

      <div>
        <textarea
          rows={4}
          placeholder="Your message"
          style={{ ...inputStyle, resize: 'none' }}
          {...register('message')}
        />
        {errors.message && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.message.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          width: '100%',
          background: 'var(--pub-accent)',
          color: '#fff',
          fontWeight: 700,
          fontSize: 15,
          padding: '14px',
          borderRadius: 10,
          border: 'none',
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
          opacity: isSubmitting ? 0.6 : 1,
        }}
      >
        {isSubmitting ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Create ContactSection wrapper**

```tsx
// frontend/src/components/public/ContactSection.tsx
import { ContactForm } from './ContactForm'

interface Props {
  headline?: string | null
}

export function ContactSection({ headline }: Props) {
  return (
    <section
      id="contact"
      style={{ background: 'var(--pub-light)', padding: '72px 24px' }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: 'var(--pub-navy)', marginBottom: 8 }}>
            Contact Us
          </h2>
          <p style={{ fontSize: 14, color: 'var(--pub-muted)' }}>
            Fill in the form and I'll get back to you within 24 hours
          </p>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 20,
            boxShadow: '0 8px 40px rgba(77,121,255,0.08)',
            padding: '36px 32px',
          }}
        >
          <ContactForm headline={headline} />
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i "contact\|portfolio"
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/schemas/portfolio.ts \
        frontend/src/components/public/ContactForm.tsx \
        frontend/src/components/public/ContactSection.tsx
git commit -m "feat(public): add ContactSection, phone field, restyle ContactForm"
```

---

## Task 10: PublicFooter Rewrite

**Files:**
- Modify: `frontend/src/components/layout/PublicFooter.tsx`

Dark navy-deep footer with social buttons, nav links, and copyright.

- [ ] **Step 1: Rewrite the file**

Replace the entire content of `frontend/src/components/layout/PublicFooter.tsx`:

```tsx
// frontend/src/components/layout/PublicFooter.tsx
interface Props {
  adminName?: string | null
  instagramUrl?: string | null
  facebookUrl?: string | null
}

export function PublicFooter({ adminName, instagramUrl, facebookUrl }: Props) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <footer
      style={{
        background: 'var(--pub-navy-deep)',
        padding: '48px 24px 32px',
        textAlign: 'center',
      }}
    >
      {/* Logo + tagline */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
          weCapture4U
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          Capturing life's most beautiful moments
        </p>
      </div>

      {/* Social buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 28 }}>
        {instagramUrl && (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
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
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              background: '#1877f2',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Facebook
          </a>
        )}
      </div>

      {/* Nav links */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 24,
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        {[
          { label: 'Gallery', action: () => scrollTo('gallery') },
          { label: 'About', action: () => scrollTo('about') },
          { label: 'Contact', action: () => scrollTo('contact') },
        ].map(({ label, action }) => (
          <button
            key={label}
            onClick={action}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.45)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
        <a
          href="/client/login"
          style={{
            color: 'rgba(255,255,255,0.45)',
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Client Login
        </a>
      </div>

      {/* Copyright */}
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
        © {new Date().getFullYear()}{' '}
        {adminName ? `${adminName} Photography` : 'Photography'}. All rights reserved.
      </p>
    </footer>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep PublicFooter
```

Expected: no output (note: `Landing.tsx` passes only `adminName` currently — new props `instagramUrl`/`facebookUrl` are optional so no breakage).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/PublicFooter.tsx
git commit -m "feat(public): rewrite PublicFooter — dark footer with social links"
```

---

## Task 11: Landing.tsx Assembly

**Files:**
- Modify: `frontend/src/pages/public/Landing.tsx`

Replace HeroCarousel/CategoryGrid/AboutSection/ContactForm with the new section components plus WaveDividers.

- [ ] **Step 1: Rewrite Landing.tsx**

Replace the entire content of `frontend/src/pages/public/Landing.tsx`:

```tsx
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
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/public/Landing.tsx
git commit -m "feat(public): assemble Landing page with all new sections + wave dividers"
```

---

## Task 12: Login Pages Restyle

**Files:**
- Modify: `frontend/src/pages/auth/ClientLogin.tsx`
- Modify: `frontend/src/pages/auth/AdminLogin.tsx`

Visual restyle only — all form logic, hooks, and zod schemas are unchanged.

- [ ] **Step 1: Restyle ClientLogin.tsx**

Replace the `return (...)` block (lines 34–65) only — keep all imports and logic above it unchanged. Replace:

```tsx
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-8 bg-card rounded-lg">
        <h1 className="text-2xl font-bold text-white">Client Login</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-red-400 text-sm">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-red-400 text-sm">{errors.password.message}</p>}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <Link to="/client/forgot-password" className="block text-center text-sm text-muted hover:text-primary">
          Forgot password?
        </Link>
      </div>
    </div>
  )
```

with:

```tsx
  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1.5px solid #e0e8ff',
    borderRadius: 10,
    background: '#f8f9ff',
    padding: '11px 14px',
    fontSize: 14,
    color: '#0a0e2e',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0e2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#fff',
          borderRadius: 20,
          padding: '40px 32px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#0a0e2e' }}>weCapture4U</p>
          <p style={{ fontSize: 13, color: '#778899', marginTop: 4 }}>Client Portal</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input id="email" type="email" style={inputStyle} {...register('email')} />
            {errors.email && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.email.message}</p>}
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input id="password" type="password" style={inputStyle} {...register('password')} />
            {errors.password && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.password.message}</p>}
          </div>

          {error && <p style={{ color: '#e53e3e', fontSize: 13, textAlign: 'center' }}>{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              background: '#4d79ff',
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              padding: 14,
              borderRadius: 10,
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
              marginTop: 4,
            }}
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <Link
          to="/client/forgot-password"
          style={{ display: 'block', textAlign: 'center', marginTop: 20, fontSize: 13, color: '#4d79ff' }}
        >
          Forgot password?
        </Link>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/" style={{ fontSize: 12, color: '#778899' }}>← Back to site</a>
        </div>
      </div>
    </div>
  )
```

Also add `import React from 'react'` at the top if not already present (needed for `React.CSSProperties`). Actually, since we're using `React.CSSProperties` as a type annotation, we need the React import. The file already imports from React hooks so this is fine — just use the type inline or cast.

Actually, to avoid needing `import React`, use a plain object without `React.CSSProperties` annotation and let TypeScript infer:

Replace `const inputStyle: React.CSSProperties = {` with just `const inputStyle = {` and add `as const` isn't needed — TypeScript infers this correctly for inline style objects passed to `style` props.

- [ ] **Step 2: Restyle AdminLogin.tsx**

In `frontend/src/pages/auth/AdminLogin.tsx`, replace the `return (...)` block (lines 79–159) — keep all logic (state, hooks, handlers) unchanged. Replace:

```tsx
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-br shadow-lg mb-4">
            <Camera className="h-7 w-7 text-black" />
          </div>
          <h1 className="text-xl font-bold text-brand">weCapture4U</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        <div className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 rounded-xl"
            onClick={handleDirectBiometric}
            disabled={directBiometricLoading}
          >
            <Fingerprint className="w-4 h-4 mr-2" />
            {directBiometricLoading ? 'Verifying…' : 'Use Face ID / Fingerprint'}
          </Button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or sign in with email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              onBlur={checkBiometric}
            />
            {errors.email && <p className="text-red-400 text-sm">{errors.email.message}</p>}
          </div>

          {hasBiometric && (
            <>
              <Button
                type="button"
                className="w-full h-10 rounded-xl"
                onClick={handleBiometric}
                disabled={biometricLoading}
              >
                <Fingerprint className="w-4 h-4 mr-2" />
                {biometricLoading ? 'Verifying…' : 'Use Face ID / Fingerprint'}
              </Button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or use password</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-red-400 text-sm">{errors.password.message}</p>}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <Button type="submit" className="w-full h-10 rounded-xl" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </div>

        <Link to="/forgot-password" className="block text-center text-sm text-muted hover:text-primary mt-4">
          Forgot password?
        </Link>
      </div>
    </div>
  )
```

with:

```tsx
  const inputStyle = {
    width: '100%',
    border: '1.5px solid #e0e8ff',
    borderRadius: 10,
    background: '#f8f9ff',
    padding: '11px 14px',
    fontSize: 14,
    color: '#0a0e2e',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  const dividerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '4px 0',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0e2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#fff',
          borderRadius: 20,
          padding: '40px 32px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              borderRadius: 14,
              background: '#0a0e2e',
              marginBottom: 12,
            }}
          >
            <Camera style={{ width: 26, height: 26, color: '#fff' }} />
          </div>
          <p style={{ fontSize: 20, fontWeight: 800, color: '#0a0e2e' }}>weCapture4U</p>
          <p style={{ fontSize: 13, color: '#778899', marginTop: 4 }}>Sign in to your account</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Direct biometric */}
          <button
            type="button"
            onClick={handleDirectBiometric}
            disabled={directBiometricLoading}
            style={{
              width: '100%',
              border: '1.5px solid #e0e8ff',
              borderRadius: 10,
              background: '#f8f9ff',
              color: '#0a0e2e',
              fontWeight: 600,
              fontSize: 14,
              padding: '11px 14px',
              cursor: directBiometricLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Fingerprint style={{ width: 16, height: 16 }} />
            {directBiometricLoading ? 'Verifying…' : 'Use Face ID / Fingerprint'}
          </button>

          {/* Divider */}
          <div style={dividerStyle}>
            <div style={{ flex: 1, height: 1, background: '#e0e8ff' }} />
            <span style={{ fontSize: 12, color: '#778899' }}>or sign in with email</span>
            <div style={{ flex: 1, height: 1, background: '#e0e8ff' }} />
          </div>

          {/* Email */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              style={inputStyle}
              {...register('email')}
              onBlur={checkBiometric}
            />
            {errors.email && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.email.message}</p>}
          </div>

          {hasBiometric && (
            <>
              <button
                type="button"
                onClick={handleBiometric}
                disabled={biometricLoading}
                style={{
                  width: '100%',
                  background: '#4d79ff',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  padding: '11px 14px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: biometricLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Fingerprint style={{ width: 16, height: 16 }} />
                {biometricLoading ? 'Verifying…' : 'Use Face ID / Fingerprint'}
              </button>

              <div style={dividerStyle}>
                <div style={{ flex: 1, height: 1, background: '#e0e8ff' }} />
                <span style={{ fontSize: 12, color: '#778899' }}>or use password</span>
                <div style={{ flex: 1, height: 1, background: '#e0e8ff' }} />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <input id="password" type="password" style={inputStyle} {...register('password')} />
              {errors.password && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.password.message}</p>}
            </div>

            {error && <p style={{ color: '#e53e3e', fontSize: 13, textAlign: 'center' }}>{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                background: '#4d79ff',
                color: '#fff',
                fontWeight: 700,
                fontSize: 15,
                padding: 14,
                borderRadius: 10,
                border: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <Link
          to="/forgot-password"
          style={{ display: 'block', textAlign: 'center', marginTop: 20, fontSize: 13, color: '#4d79ff' }}
        >
          Forgot password?
        </Link>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/" style={{ fontSize: 12, color: '#778899' }}>← Back to site</a>
        </div>
      </div>
    </div>
  )
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i "login\|auth"
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/auth/ClientLogin.tsx frontend/src/pages/auth/AdminLogin.tsx
git commit -m "feat(public): restyle login pages — dark navy background, white card"
```

---

## Task 13: Gallery Page Restyle

**Files:**
- Modify: `frontend/src/pages/public/Gallery.tsx`

Restyle only — same masonry grid, same Lightbox logic. Add `PublicNav`, update background to `#0a0e2e`, white breadcrumb.

- [ ] **Step 1: Restyle Gallery.tsx**

The existing file is already dark-themed. Update nav background reference and breadcrumb to match the new nav:

Replace the `return (...)` block:

```tsx
  return (
    <>
      <PublicNav />
      <div
        style={{
          minHeight: '100vh',
          background: '#0a0e2e',
          paddingTop: 80,
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: 48,
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <a
            href="/"
            style={{
              fontSize: 13,
              color: 'rgba(170,192,255,0.7)',
              textDecoration: 'none',
              display: 'inline-block',
              marginBottom: 16,
            }}
          >
            ← Portfolio
          </a>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            {category.name}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 32 }}>
            {category.photos.length} photos
          </p>

          {/* CSS columns masonry grid */}
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-3">
            {category.photos.map((photo, idx) => (
              <div
                key={photo.id}
                className="break-inside-avoid mb-3 cursor-pointer overflow-hidden rounded-lg group"
                onClick={() => setLightboxIdx(idx)}
              >
                <img
                  src={photo.image_url}
                  alt={`Photo ${idx + 1}`}
                  className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {lightboxIdx !== null && (
        <Lightbox
          photos={category.photos}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  )
```

Also update the loading state:

```tsx
  if (isLoading) {
    return (
      <>
        <PublicNav />
        <div
          style={{
            minHeight: '100vh',
            background: '#0a0e2e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          Loading…
        </div>
      </>
    )
  }
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep Gallery
```

Expected: no output.

- [ ] **Step 3: Run frontend tests**

```bash
cd frontend && npm run test 2>&1 | tail -20
```

Expected: same pass/fail ratio as before this feature (pre-existing failures are not regressions).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/public/Gallery.tsx
git commit -m "feat(public): restyle Gallery page — dark navy, updated nav"
```

---

## Self-Review Checklist

After all tasks are complete, verify:

- [ ] All 9 public color tokens are in `index.css` `:root`
- [ ] `WaveDivider` used between every section transition in `Landing.tsx` (6 waves total)
- [ ] `HeroSection`: hero image from API, fallback gradient, login gate note
- [ ] `GallerySection`: 2-col swipe on mobile (`md:hidden`), auto-fill grid on desktop (`hidden md:block`)
- [ ] `AboutSection`: no early-return when both `adminName` and `bio` are null (show empty state gracefully)
- [ ] `InstagramStrip`: 6 placeholder images exist in `frontend/public/instagram/`
- [ ] `ContactForm`: Phone field added, `ContactFormSchema` updated
- [ ] Login pages: all existing logic (biometric, password, error handling, links) preserved
- [ ] Gallery page: Lightbox and masonry logic untouched
- [ ] `PublicNav`: scroll-to links work on `#gallery`, `#about`, `#contact`; "Contact Us" button visible on mobile
- [ ] `npx tsc --noEmit` passes with no new errors
