# weCapture4U — Portfolio Frontend & SEO

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public landing page (`/`), gallery page (`/portfolio/:slug`), admin Portfolio management page (`/admin/portfolio`), and add SEO meta tags with `react-helmet-async`. Includes the migration 006_seo.sql for og:image columns.

**Architecture:** Public pages have no auth. The landing page is a single-page scroll with 4 sections (Hero carousel, Categories, About, Contact). The admin Portfolio page has 5 tabs. SEO meta tags injected via `react-helmet-async` in `Landing.tsx`.

**Depends on:** Plans 1–4 (Foundation, Auth, Admin shell already wired), Plan 14 (Portfolio Backend).

**Tech Stack:** React 18 + TypeScript, TanStack Query v5, react-hook-form, Zod, shadcn/ui, Tailwind CSS, `react-helmet-async`, `@dnd-kit/core` (already installed).

---

## File Structure

```
migrations/
  006_seo.sql               # Add meta_title, meta_description, og_image_url to app_settings

frontend/src/
  schemas/
    portfolio.ts            # Zod schemas for public portfolio data + admin operations
  api/
    portfolio.ts            # Typed API functions
  hooks/
    usePortfolio.ts         # TanStack Query hooks
  components/
    public/
      HeroCarousel.tsx      # Auto-advancing carousel with dot indicators
      CategoryGrid.tsx      # Category cards grid
      AboutSection.tsx      # Admin avatar, bio, social links
      ContactForm.tsx       # Contact submission form
      Lightbox.tsx          # Fullscreen photo viewer with keyboard/swipe
    layout/
      PublicNav.tsx         # Sticky nav with scroll behavior + mobile hamburger
      PublicFooter.tsx
  pages/
    public/
      Landing.tsx           # / — full landing page with SEO Helmet
      Gallery.tsx           # /portfolio/:slug
    admin/
      Portfolio.tsx         # /admin/portfolio — 5 tabs
  routes/
    index.tsx               # Add public routes + admin portfolio route
  main.tsx                  # Wrap with HelmetProvider
```

---

## Chunk 1: Migration + Schemas + API

### Task 1: Migration 006_seo.sql + schemas + API

**Files:**
- Create: `migrations/006_seo.sql`
- Create: `frontend/src/schemas/portfolio.ts`
- Create: `frontend/src/schemas/__tests__/portfolio.test.ts`
- Create: `frontend/src/api/portfolio.ts`
- Create: `frontend/src/hooks/usePortfolio.ts`

- [ ] **Step 1: Write migration**

```sql
-- migrations/006_seo.sql
-- SEO: og:image and meta fields for landing page
-- Depends on: 005_portfolio.sql

ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS meta_title        TEXT,
    ADD COLUMN IF NOT EXISTS meta_description  TEXT,
    ADD COLUMN IF NOT EXISTS og_image_url      TEXT;
```

- [ ] **Step 2: Write failing schema tests**

```typescript
// frontend/src/schemas/__tests__/portfolio.test.ts
import { ContactFormSchema, PositionItemSchema } from '../portfolio'

describe('ContactFormSchema', () => {
  it('rejects empty name', () => {
    const result = ContactFormSchema.safeParse({ name: '', email: 'a@b.com', message: 'hi' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = ContactFormSchema.safeParse({ name: 'Alice', email: 'not-an-email', message: 'hi' })
    expect(result.success).toBe(false)
  })

  it('rejects message > 5000 chars', () => {
    const result = ContactFormSchema.safeParse({ name: 'Alice', email: 'a@b.com', message: 'x'.repeat(5001) })
    expect(result.success).toBe(false)
  })

  it('accepts valid contact form', () => {
    const result = ContactFormSchema.safeParse({ name: 'Alice', email: 'a@b.com', message: 'Hello!' })
    expect(result.success).toBe(true)
  })
})

describe('PositionItemSchema', () => {
  it('requires id and position', () => {
    const result = PositionItemSchema.safeParse({ id: 'not-a-uuid', position: 1 })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 3: Run — expect failures**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="portfolio.test" --watchAll=false 2>&1 | head -20
```

- [ ] **Step 4: Write schemas**

```typescript
// frontend/src/schemas/portfolio.ts
import { z } from 'zod'

// Public
export const HeroPhotoSchema = z.object({
  id: z.string().uuid(),
  image_url: z.string().url(),
  position: z.number(),
})
export type HeroPhoto = z.infer<typeof HeroPhotoSchema>

export const CategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  cover_url: z.string().url(),
  position: z.number(),
})
export type Category = z.infer<typeof CategorySchema>

export const PhotoSchema = z.object({
  id: z.string().uuid(),
  image_url: z.string().url(),
  position: z.number(),
})
export type Photo = z.infer<typeof PhotoSchema>

export const CategoryWithPhotosSchema = CategorySchema.extend({
  photos: z.array(PhotoSchema).default([]),
})
export type CategoryWithPhotos = z.infer<typeof CategoryWithPhotosSchema>

export const PublicSettingsSchema = z.object({
  tagline: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  instagram_url: z.string().nullable().optional(),
  facebook_url: z.string().nullable().optional(),
  contact_headline: z.string().nullable().optional(),
  admin_name: z.string().nullable().optional(),
  admin_avatar_url: z.string().nullable().optional(),
  meta_title: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
  og_image_url: z.string().nullable().optional(),
})
export type PublicSettings = z.infer<typeof PublicSettingsSchema>

export const AboutSettingsSchema = z.object({
  tagline: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  instagram_url: z.string().nullable().optional(),
  facebook_url: z.string().nullable().optional(),
  contact_headline: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
  meta_title: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
  og_image_url: z.string().nullable().optional(),
})
export type AboutSettings = z.infer<typeof AboutSettingsSchema>

// Contact form
export const ContactFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address').max(254),
  message: z.string().min(1, 'Message is required').max(5000),
})
export type ContactForm = z.infer<typeof ContactFormSchema>

// Admin operations
export const PositionItemSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().positive(),
})
export type PositionItem = z.infer<typeof PositionItemSchema>
```

- [ ] **Step 5: Write API functions**

```typescript
// frontend/src/api/portfolio.ts
import api from './index'
import {
  HeroPhotoSchema, HeroPhoto,
  CategorySchema, Category,
  CategoryWithPhotosSchema, CategoryWithPhotos,
  PublicSettingsSchema, PublicSettings,
  AboutSettingsSchema, AboutSettings,
  PositionItem,
} from '../schemas/portfolio'
import { z } from 'zod'

// Public
export const fetchHeroPhotos = async (): Promise<HeroPhoto[]> => {
  const res = await api.get('/portfolio/hero')
  return z.array(HeroPhotoSchema).parse(res.data)
}

export const fetchCategories = async (): Promise<Category[]> => {
  const res = await api.get('/portfolio/categories')
  return z.array(CategorySchema).parse(res.data)
}

export const fetchCategoryBySlug = async (slug: string): Promise<CategoryWithPhotos> => {
  const res = await api.get(`/portfolio/categories/${slug}`)
  return CategoryWithPhotosSchema.parse(res.data)
}

export const fetchPublicSettings = async (): Promise<PublicSettings> => {
  const res = await api.get('/settings/public')
  return PublicSettingsSchema.parse(res.data)
}

export const submitContact = async (data: { name: string; email: string; message: string }): Promise<void> => {
  await api.post('/contact', data)
}

// Admin
export const fetchAboutSettings = async (): Promise<AboutSettings> => {
  const res = await api.get('/settings/about')
  return AboutSettingsSchema.parse(res.data)
}

export const updateAboutSettings = async (data: Partial<AboutSettings>): Promise<AboutSettings> => {
  const res = await api.patch('/settings/about', data)
  return AboutSettingsSchema.parse(res.data)
}

export const uploadHeroPhoto = async (file: File): Promise<HeroPhoto> => {
  const form = new FormData()
  form.append('photo', file)
  const res = await api.post('/portfolio/hero', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return HeroPhotoSchema.parse(res.data)
}

export const deleteHeroPhoto = async (id: string): Promise<void> => {
  await api.delete(`/portfolio/hero/${id}`)
}

export const reorderHeroPhotos = async (items: PositionItem[]): Promise<void> => {
  await api.patch('/portfolio/hero/positions', items)
}

export const createCategory = async (name: string, coverFile: File): Promise<Category> => {
  const form = new FormData()
  form.append('name', name)
  form.append('cover', coverFile)
  const res = await api.post('/portfolio/categories', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return CategorySchema.parse(res.data)
}

export const updateCategory = async (id: string, data: { name?: string; coverFile?: File }): Promise<Category> => {
  const form = new FormData()
  if (data.name) form.append('name', data.name)
  if (data.coverFile) form.append('cover', data.coverFile)
  const res = await api.patch(`/portfolio/categories/${id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return CategorySchema.parse(res.data)
}

export const deleteCategory = async (id: string): Promise<void> => {
  await api.delete(`/portfolio/categories/${id}`)
}

export const reorderCategories = async (items: PositionItem[]): Promise<void> => {
  await api.patch('/portfolio/categories/positions', items)
}

export const uploadPhotos = async (categoryId: string, files: File[]): Promise<void> => {
  const form = new FormData()
  files.forEach(f => form.append('photos', f))
  await api.post(`/portfolio/categories/${categoryId}/photos`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
}

export const deletePhoto = async (photoId: string): Promise<void> => {
  await api.delete(`/portfolio/photos/${photoId}`)
}

export const reorderPhotos = async (categoryId: string, items: PositionItem[]): Promise<void> => {
  await api.patch(`/portfolio/categories/${categoryId}/photos/positions`, items)
}

export const uploadOgImage = async (file: File): Promise<{ og_image_url: string }> => {
  const form = new FormData()
  form.append('image', file)
  const res = await api.post('/settings/og-image', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return res.data
}

export const deleteOgImage = async (): Promise<void> => {
  await api.delete('/settings/og-image')
}
```

- [ ] **Step 6: Write hooks**

```typescript
// frontend/src/hooks/usePortfolio.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../lib/apiError'
import * as portfolioApi from '../api/portfolio'

// Public
export const useHeroPhotos = () =>
  useQuery({ queryKey: ['hero-photos'], queryFn: portfolioApi.fetchHeroPhotos })

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: portfolioApi.fetchCategories })

export const useCategoryBySlug = (slug: string) =>
  useQuery({
    queryKey: ['category', slug],
    queryFn: () => portfolioApi.fetchCategoryBySlug(slug),
    enabled: !!slug,
  })

export const usePublicSettings = () =>
  useQuery({ queryKey: ['public-settings'], queryFn: portfolioApi.fetchPublicSettings })

export const useSubmitContact = () =>
  useMutation({
    mutationFn: portfolioApi.submitContact,
    onError: (err) => toast.error(getApiErrorMessage(err, 'Something went wrong. Please try again.')),
  })

// Admin
export const useAboutSettings = () =>
  useQuery({ queryKey: ['about-settings'], queryFn: portfolioApi.fetchAboutSettings })

export const useUpdateAboutSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: portfolioApi.updateAboutSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['about-settings'] })
      qc.invalidateQueries({ queryKey: ['public-settings'] })
      toast.success('Settings saved')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to save settings')),
  })
}

export const useUploadHeroPhoto = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => portfolioApi.uploadHeroPhoto(file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hero-photos'] }); toast.success('Photo uploaded') },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Upload failed')),
  })
}

export const useDeleteHeroPhoto = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => portfolioApi.deleteHeroPhoto(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hero-photos'] }) },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Delete failed')),
  })
}

export const useCreateCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, coverFile }: { name: string; coverFile: File }) =>
      portfolioApi.createCategory(name, coverFile),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Category created') },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create category')),
  })
}

export const useDeleteCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => portfolioApi.deleteCategory(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Category deleted') },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Cannot delete category')),
  })
}

export const useUploadPhotos = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ categoryId, files }: { categoryId: string; files: File[] }) =>
      portfolioApi.uploadPhotos(categoryId, files),
    onSuccess: (_, { categoryId }) => {
      qc.invalidateQueries({ queryKey: ['category-photos', categoryId] })
      toast.success('Photos uploaded')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Upload failed')),
  })
}

export const useDeletePhoto = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => portfolioApi.deletePhoto(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: (err) => {
      // 404 = already deleted in another tab — silently ignore
      const e = err as { response?: { status?: number } }
      if (e.response?.status !== 404) {
        toast.error(getApiErrorMessage(err, 'Failed to delete photo. Please try again.'))
      }
    },
  })
}

export const useUploadOgImage = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => portfolioApi.uploadOgImage(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['about-settings'] })
      qc.invalidateQueries({ queryKey: ['public-settings'] })
      toast.success('Social image uploaded')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Upload failed')),
  })
}

export const useDeleteOgImage = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: portfolioApi.deleteOgImage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['about-settings'] })
      toast.success('Social image removed')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to remove image')),
  })
}
```

- [ ] **Step 7: Run schema tests — PASS**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="portfolio.test" --watchAll=false
```

Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add migrations/006_seo.sql frontend/src/schemas/portfolio.ts frontend/src/schemas/__tests__/portfolio.test.ts frontend/src/api/portfolio.ts frontend/src/hooks/usePortfolio.ts
git commit -m "feat: add portfolio schemas, API functions, hooks and SEO migration"
```

---

## Chunk 2: Public Components

### Task 2: HeroCarousel component test + implementation

**Files:**
- Create: `frontend/src/components/public/__tests__/HeroCarousel.test.tsx`
- Create: `frontend/src/components/public/HeroCarousel.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/src/components/public/__tests__/HeroCarousel.test.tsx
import { render, screen, act } from '@testing-library/react'
import { HeroCarousel } from '../HeroCarousel'

const photos = [
  { id: '1', image_url: 'https://example.com/1.webp', position: 1 },
  { id: '2', image_url: 'https://example.com/2.webp', position: 2 },
  { id: '3', image_url: 'https://example.com/3.webp', position: 3 },
]

describe('HeroCarousel', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('renders dot indicators for each photo', () => {
    render(<HeroCarousel photos={photos} tagline={null} />)
    const dots = document.querySelectorAll('[data-testid="carousel-dot"]')
    expect(dots).toHaveLength(3)
  })

  it('renders prev and next buttons', () => {
    render(<HeroCarousel photos={photos} tagline={null} />)
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
  })

  it('auto-advances after 5 seconds', () => {
    render(<HeroCarousel photos={photos} tagline={null} />)
    const firstDot = document.querySelector('[data-testid="carousel-dot"][data-active="true"]')
    expect(firstDot?.getAttribute('data-index')).toBe('0')
    act(() => jest.advanceTimersByTime(5000))
    const activeDot = document.querySelector('[data-testid="carousel-dot"][data-active="true"]')
    expect(activeDot?.getAttribute('data-index')).toBe('1')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="HeroCarousel" --watchAll=false 2>&1 | head -20
```

- [ ] **Step 3: Write HeroCarousel**

```typescript
// frontend/src/components/public/HeroCarousel.tsx
import { useEffect, useRef, useState } from 'react'
import type { HeroPhoto } from '../../schemas/portfolio'

interface Props {
  photos: HeroPhoto[]
  tagline: string | null | undefined
}

export function HeroCarousel({ photos, tagline }: Props) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const next = () => setCurrent(c => (c + 1) % Math.max(photos.length, 1))
  const prev = () => setCurrent(c => (c - 1 + Math.max(photos.length, 1)) % Math.max(photos.length, 1))

  useEffect(() => {
    if (!paused && photos.length > 1) {
      timerRef.current = setInterval(next, 5000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [paused, photos.length, current])

  const photo = photos[current]

  return (
    <div
      className="relative w-full h-screen overflow-hidden bg-black"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => { setPaused(false) }}
    >
      {/* Photo */}
      {photo ? (
        <img
          src={photo.image_url}
          alt="Hero"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-[#0c0c0c]" />
      )}

      {/* Bottom gradient + text overlay */}
      <div
        className="absolute inset-x-0 bottom-0 h-2/5 flex flex-col items-center justify-end pb-16 px-4"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))' }}
      >
        <p className="text-xs uppercase tracking-widest text-gray-300 mb-2">Photography</p>
        {tagline && <p className="text-white text-2xl md:text-4xl font-light text-center mb-6">{tagline}</p>}
        <a
          href="#contact"
          className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-8 py-3 rounded-full transition-colors"
        >
          Book a Session
        </a>
      </div>

      {/* Arrow buttons */}
      {photos.length > 1 && (
        <>
          <button
            aria-label="Previous"
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          >
            ‹
          </button>
          <button
            aria-label="Next"
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          >
            ›
          </button>
        </>
      )}

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div className="absolute bottom-6 right-6 flex gap-2">
          {photos.map((_, i) => (
            <button
              key={i}
              data-testid="carousel-dot"
              data-index={i}
              data-active={i === current}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === current ? 'bg-amber-400 w-4' : 'bg-white/35'
              }`}
              aria-label={`Go to photo ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — PASS**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="HeroCarousel" --watchAll=false
```

---

### Task 3: Lightbox component test + implementation

**Files:**
- Create: `frontend/src/components/public/__tests__/Lightbox.test.tsx`
- Create: `frontend/src/components/public/Lightbox.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/src/components/public/__tests__/Lightbox.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Lightbox } from '../Lightbox'

const photos = [
  { id: '1', image_url: 'https://example.com/1.webp', position: 1 },
  { id: '2', image_url: 'https://example.com/2.webp', position: 2 },
]

describe('Lightbox', () => {
  it('shows photo counter', () => {
    render(<Lightbox photos={photos} initialIndex={0} onClose={() => {}} />)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('ESC key closes lightbox', () => {
    const onClose = jest.fn()
    render(<Lightbox photos={photos} initialIndex={0} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('right arrow key advances to next photo', () => {
    render(<Lightbox photos={photos} initialIndex={0} onClose={() => {}} />)
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="Lightbox" --watchAll=false 2>&1 | head -20
```

- [ ] **Step 3: Write Lightbox**

```typescript
// frontend/src/components/public/Lightbox.tsx
import { useEffect, useState } from 'react'
import type { Photo } from '../../schemas/portfolio'

interface Props {
  photos: Photo[]
  initialIndex: number
  onClose: () => void
}

export function Lightbox({ photos, initialIndex, onClose }: Props) {
  const [idx, setIdx] = useState(initialIndex)

  const next = () => setIdx(i => (i + 1) % photos.length)
  const prev = () => setIdx(i => (i - 1 + photos.length) % photos.length)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const photo = photos[idx]
  if (!photo) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 text-white text-3xl leading-none hover:text-gray-300 z-10"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>

      {/* Photo */}
      <img
        src={photo.image_url}
        alt={`Photo ${idx + 1}`}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Nav arrows */}
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev() }}
            className="absolute left-4 text-white text-4xl bg-black/30 hover:bg-black/60 w-12 h-12 rounded-full flex items-center justify-center"
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next() }}
            className="absolute right-4 text-white text-4xl bg-black/30 hover:bg-black/60 w-12 h-12 rounded-full flex items-center justify-center"
            aria-label="Next photo"
          >
            ›
          </button>
        </>
      )}

      {/* Counter */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-sm">
        {idx + 1} / {photos.length}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — PASS**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="Lightbox" --watchAll=false
```

- [ ] **Step 5: Write remaining public components (no separate tests — UI-only)**

```typescript
// frontend/src/components/public/CategoryGrid.tsx
import { Link } from 'react-router-dom'
import type { Category } from '../../schemas/portfolio'

export function CategoryGrid({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null
  return (
    <section id="portfolio" className="py-16 px-4 bg-black">
      <p className="text-xs uppercase tracking-widest text-gray-400 text-center mb-8">Browse by category</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
        {categories.map(cat => (
          <Link
            key={cat.id}
            to={`/portfolio/${cat.slug}`}
            className="relative block overflow-hidden rounded-xl group"
            style={{ height: '200px' }}
          >
            <img
              src={cat.cover_url}
              alt={cat.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
              <span className="text-white font-bold text-xl uppercase tracking-widest">{cat.name}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

// frontend/src/components/public/AboutSection.tsx
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
          <img src={adminAvatarUrl} alt={adminName ?? ''} className="w-24 h-24 rounded-full object-cover border-2 border-amber-500/30" />
        ) : (
          <div className="w-24 h-24 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-3xl">
            {adminName?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        {adminName && <h2 className="text-white text-2xl font-bold">{adminName}</h2>}
        {bio && <p className="text-gray-400 leading-relaxed">{bio}</p>}
        <div className="flex gap-4">
          {instagramUrl && <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 text-sm">Instagram</a>}
          {facebookUrl && <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 text-sm">Facebook</a>}
        </div>
      </div>
    </section>
  )
}

// frontend/src/components/public/ContactForm.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { ContactFormSchema, ContactForm as ContactFormData } from '../../schemas/portfolio'
import { useSubmitContact } from '../../hooks/usePortfolio'

interface Props {
  headline: string | null | undefined
}

export function ContactForm({ headline }: Props) {
  const [submitted, setSubmitted] = useState(false)
  const submitMutation = useSubmitContact()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ContactFormData>({
    resolver: zodResolver(ContactFormSchema),
  })

  const onSubmit = async (data: ContactFormData) => {
    try {
      await submitMutation.mutateAsync(data)
      setSubmitted(true)
    } catch {}
  }

  return (
    <section id="contact" className="py-16 px-4 bg-black">
      <p className="text-xs uppercase tracking-widest text-gray-400 text-center mb-4">Contact</p>
      <h2 className="text-white text-3xl font-bold text-center mb-10">{headline ?? 'Get in touch'}</h2>
      <div className="max-w-md mx-auto">
        {submitted ? (
          <p className="text-center text-amber-400 text-lg">Thanks! I'll be in touch soon.</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {submitMutation.isError && (
              <p className="text-red-400 text-sm text-center">Something went wrong. Please try again.</p>
            )}
            <div>
              <input placeholder="Your name" className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500" {...register('name')} />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <input type="email" placeholder="Email address" className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500" {...register('email')} />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <textarea rows={4} placeholder="Your message" className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500 resize-none" {...register('message')} />
              {errors.message && <p className="text-red-400 text-xs mt-1">{errors.message.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold py-3 rounded-lg transition-colors">
              {isSubmitting ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Write PublicNav + PublicFooter**

```typescript
// frontend/src/components/layout/PublicNav.tsx
import { useEffect, useState } from 'react'

export function PublicNav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const navClass = `fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
    scrolled || menuOpen ? 'bg-[#0c0c0c] border-b border-white/10' : 'bg-transparent'
  }`

  const links = [
    { href: '#portfolio', label: 'Portfolio' },
    { href: '#about', label: 'About' },
    { href: '#contact', label: 'Contact' },
  ]

  return (
    <nav className={navClass}>
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <a href="/" className="text-amber-400 font-bold tracking-wide">weCapture4U</a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-sm text-gray-300 hover:text-white transition-colors">{l.label}</a>
          ))}
          <a href="/client/login" className="text-sm text-gray-300 hover:text-white">Login</a>
          <a href="#contact" className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors">Book Now</a>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden text-white text-2xl" onClick={() => setMenuOpen(o => !o)}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#0c0c0c] border-t border-white/10 px-4 py-4 space-y-4">
          {links.map(l => (
            <a key={l.href} href={l.href} className="block text-gray-300 hover:text-white" onClick={() => setMenuOpen(false)}>{l.label}</a>
          ))}
          <a href="/client/login" className="block text-gray-300 hover:text-white" onClick={() => setMenuOpen(false)}>Login</a>
          <a href="#contact" className="block bg-amber-500 text-black font-semibold px-4 py-2 rounded-lg text-center" onClick={() => setMenuOpen(false)}>Book Now</a>
        </div>
      )}
    </nav>
  )
}

// frontend/src/components/layout/PublicFooter.tsx
interface Props { adminName: string | null | undefined }
export function PublicFooter({ adminName }: Props) {
  return (
    <footer className="bg-[#0c0c0c] border-t border-white/10 py-6 px-4 text-center">
      <p className="text-gray-500 text-sm">
        © {new Date().getFullYear()} {adminName ? `${adminName} Photography` : 'Photography'}
      </p>
      <a href="/client/login" className="text-xs text-gray-600 hover:text-gray-400 mt-1 inline-block">Client Login</a>
    </footer>
  )
}
```

- [ ] **Step 7: Commit components**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add frontend/src/components/public/ frontend/src/components/layout/PublicNav.tsx frontend/src/components/layout/PublicFooter.tsx
git commit -m "feat: add public portfolio components — HeroCarousel, Lightbox, CategoryGrid, AboutSection, ContactForm, PublicNav"
```

---

## Chunk 3: Landing Page + Gallery Page + Admin Portfolio Page

### Task 4: Landing.tsx with SEO Helmet

**Files:**
- Modify: `frontend/src/main.tsx` — add HelmetProvider
- Create: `frontend/src/pages/public/Landing.tsx`
- Create: `frontend/src/pages/public/__tests__/Landing.test.tsx`

- [ ] **Step 1: Install react-helmet-async**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm install react-helmet-async
npm install --save-dev @types/react-helmet
```

- [ ] **Step 2: Write failing test**

```typescript
// frontend/src/pages/public/__tests__/Landing.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import Landing from '../Landing'

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <HelmetProvider>
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  </HelmetProvider>
)

describe('Landing', () => {
  it('renders Book a Session button linking to #contact', () => {
    render(<Landing />, { wrapper: Wrapper })
    const ctaLinks = screen.getAllByRole('link', { name: /book a session/i })
    expect(ctaLinks.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 3: Add HelmetProvider to main.tsx**

In `frontend/src/main.tsx`, wrap the app:
```typescript
import { HelmetProvider } from 'react-helmet-async'
// Wrap <App /> with <HelmetProvider><App /></HelmetProvider>
```

- [ ] **Step 4: Write Landing.tsx**

```typescript
// frontend/src/pages/public/Landing.tsx
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

  const title = settings?.meta_title ??
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
```

- [ ] **Step 5: Run Landing test — PASS**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --testPathPattern="Landing.test" --watchAll=false
```

---

### Task 5: Gallery.tsx + admin Portfolio.tsx + route wiring

**Files:**
- Create: `frontend/src/pages/public/Gallery.tsx`
- Create: `frontend/src/pages/admin/Portfolio.tsx`
- Modify: `frontend/src/routes/index.tsx`

- [ ] **Step 1: Write Gallery.tsx**

```typescript
// frontend/src/pages/public/Gallery.tsx
import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useCategoryBySlug } from '../../hooks/usePortfolio'
import { Lightbox } from '../../components/public/Lightbox'
import { PublicNav } from '../../components/layout/PublicNav'

export default function Gallery() {
  const { slug } = useParams<{ slug: string }>()
  const { data: category, isLoading, isError } = useCategoryBySlug(slug ?? '')
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  if (isLoading) return (
    <>
      <PublicNav />
      <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center text-gray-400">Loading…</div>
    </>
  )

  if (isError || !category) return <Navigate to="/" replace />

  return (
    <>
      <PublicNav />
      <div className="min-h-screen bg-[#0c0c0c] pt-20 px-4 pb-12">
        <div className="max-w-5xl mx-auto">
          <a href="/" className="text-xs text-gray-400 hover:text-white mb-4 inline-block">← Portfolio</a>
          <h1 className="text-3xl font-bold text-white mb-1">{category.name}</h1>
          <p className="text-sm text-gray-400 mb-8">{category.photos.length} photos</p>

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
}
```

- [ ] **Step 2: Write admin Portfolio.tsx (5-tab management page)**

```typescript
// frontend/src/pages/admin/Portfolio.tsx
import { useState, useRef } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import { Button } from '../../components/ui/button'
import { useForm } from 'react-hook-form'
import {
  useHeroPhotos, useUploadHeroPhoto, useDeleteHeroPhoto,
  useCategories, useCreateCategory, useDeleteCategory,
  useAboutSettings, useUpdateAboutSettings,
  useUploadOgImage, useDeleteOgImage,
} from '../../hooks/usePortfolio'
import type { Category } from '../../schemas/portfolio'

// ─── Tab 1: Hero Carousel ───────────────────────────────────────────────────

function HeroTab() {
  const { data: photos = [] } = useHeroPhotos()
  const uploadMutation = useUploadHeroPhoto()
  const deleteMutation = useDeleteHeroPhoto()
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-300">Hero Photos ({photos.length}/20)</h3>
        <Button
          size="sm"
          className="bg-amber-500 text-black hover:bg-amber-400"
          disabled={photos.length >= 20}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Photo
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadMutation.mutate(file)
            e.target.value = ''
          }}
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map(photo => (
          <div key={photo.id} className="relative group rounded-lg overflow-hidden aspect-video">
            <img src={photo.image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm('Delete this hero photo?')) deleteMutation.mutate(photo.id)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab 2: Categories ──────────────────────────────────────────────────────

function CategoriesTab({ onSelectCategory }: { onSelectCategory: (c: Category) => void }) {
  const { data: categories = [] } = useCategories()
  const createMutation = useCreateCategory()
  const deleteMutation = useDeleteCategory()
  const [newName, setNewName] = useState('')
  const [newCover, setNewCover] = useState<File | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const handleCreate = async () => {
    if (!newName || !newCover) return
    await createMutation.mutateAsync({ name: newName, coverFile: newCover })
    setNewName(''); setNewCover(null)
  }

  return (
    <div className="space-y-4">
      {/* Create form */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex gap-3 items-end">
        <div>
          <label className="text-xs text-gray-400">Name</label>
          <input className="mt-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white w-48"
            value={newName} onChange={e => setNewName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-400">Cover Photo</label>
          <Button size="sm" variant="outline" className="mt-1 border-white/20 text-white ml-2"
            onClick={() => coverInputRef.current?.click()}>
            {newCover ? newCover.name : 'Choose…'}
          </Button>
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) setNewCover(f); e.target.value = '' }} />
        </div>
        <Button size="sm" className="bg-amber-500 text-black" onClick={handleCreate}
          disabled={!newName || !newCover || createMutation.isPending}>
          Create
        </Button>
      </div>

      <div className="space-y-2">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <img src={cat.cover_url} alt="" className="w-12 h-8 object-cover rounded" />
              <div>
                <p className="text-white">{cat.name}</p>
                <p className="text-xs text-gray-500">/{cat.slug}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="text-amber-400 text-xs"
                onClick={() => onSelectCategory(cat)}>
                Photos
              </Button>
              <Button size="sm" variant="ghost" className="text-red-400 text-xs"
                onClick={() => { if (confirm('Delete category?')) deleteMutation.mutate(cat.id) }}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab 3: Category Photos ─────────────────────────────────────────────────

function CategoryPhotosTab() {
  const { data: categories = [] } = useCategories()
  const [selectedCatId, setSelectedCatId] = useState<string>('')
  const selectedCat = categories.find(c => c.id === selectedCatId)

  return (
    <div className="space-y-4">
      <select className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
        value={selectedCatId} onChange={e => setSelectedCatId(e.target.value)}>
        <option value="">Select category…</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {selectedCat && <p className="text-gray-400 text-sm">Photo management for {selectedCat.name} — available when online.</p>}
    </div>
  )
}

// ─── Tab 4: About & Settings (with SEO section) ─────────────────────────────

function AboutSettingsTab() {
  const { data: settings } = useAboutSettings()
  const updateMutation = useUpdateAboutSettings()
  const uploadOgImageMutation = useUploadOgImage()
  const deleteOgImageMutation = useDeleteOgImage()
  const ogImageInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      tagline: settings?.tagline ?? '',
      bio: settings?.bio ?? '',
      instagram_url: settings?.instagram_url ?? '',
      facebook_url: settings?.facebook_url ?? '',
      contact_headline: settings?.contact_headline ?? '',
      contact_email: settings?.contact_email ?? '',
      meta_title: settings?.meta_title ?? '',
      meta_description: settings?.meta_description ?? '',
    },
  })

  return (
    <form onSubmit={handleSubmit((data) => updateMutation.mutate(
      Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v || null]))
    ))} className="space-y-4 max-w-lg">
      {[
        { name: 'tagline', label: 'Tagline' },
        { name: 'instagram_url', label: 'Instagram URL' },
        { name: 'facebook_url', label: 'Facebook URL' },
        { name: 'contact_headline', label: 'Contact Headline' },
        { name: 'contact_email', label: 'Contact Email' },
        { name: 'meta_title', label: 'Page Title (SEO)' },
      ].map(({ name, label }) => (
        <div key={name}>
          <label className="text-xs text-gray-400">{label}</label>
          <input className="mt-1 w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
            {...register(name as never)} />
        </div>
      ))}

      <div>
        <label className="text-xs text-gray-400">Bio</label>
        <textarea rows={3} className="mt-1 w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white resize-none"
          {...register('meta_description')} />
      </div>

      {/* og:image */}
      <div>
        <label className="text-xs text-gray-400">Social Sharing Image (1200×630)</label>
        <div className="flex gap-2 mt-1">
          {settings?.og_image_url && (
            <img src={settings.og_image_url} alt="OG" className="h-16 rounded border border-white/20" />
          )}
          <Button type="button" size="sm" variant="outline" className="border-white/20 text-white"
            onClick={() => ogImageInputRef.current?.click()}>
            {settings?.og_image_url ? 'Replace' : 'Upload'}
          </Button>
          {settings?.og_image_url && (
            <Button type="button" size="sm" variant="ghost" className="text-red-400"
              onClick={() => deleteOgImageMutation.mutate()}>
              Remove
            </Button>
          )}
          <input ref={ogImageInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadOgImageMutation.mutate(f); e.target.value = '' }} />
        </div>
      </div>

      <Button type="submit" className="bg-amber-500 text-black hover:bg-amber-400" disabled={updateMutation.isPending}>
        Save
      </Button>
    </form>
  )
}

// ─── Tab 5: Contact Submissions ──────────────────────────────────────────────

function ContactSubmissionsTab() {
  return (
    <div className="text-gray-400 text-sm">
      Contact submissions view — available when backend returns data.
    </div>
  )
}

// ─── Main Portfolio Page ─────────────────────────────────────────────────────

export default function Portfolio() {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Portfolio</h1>
      <Tabs defaultValue="hero">
        <TabsList className="mb-6 bg-white/5">
          <TabsTrigger value="hero">Hero Carousel</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="photos">Category Photos</TabsTrigger>
          <TabsTrigger value="about">About & Settings</TabsTrigger>
          <TabsTrigger value="contact">Contact Submissions</TabsTrigger>
        </TabsList>
        <TabsContent value="hero"><HeroTab /></TabsContent>
        <TabsContent value="categories">
          <CategoriesTab onSelectCategory={(c) => setSelectedCategory(c)} />
        </TabsContent>
        <TabsContent value="photos"><CategoryPhotosTab /></TabsContent>
        <TabsContent value="about"><AboutSettingsTab /></TabsContent>
        <TabsContent value="contact"><ContactSubmissionsTab /></TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 3: Write Portfolio page test**

```typescript
// frontend/src/pages/admin/__tests__/Portfolio.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Portfolio from '../Portfolio'

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter><QueryClientProvider client={qc}>{children}</QueryClientProvider></MemoryRouter>
)

describe('Portfolio admin page', () => {
  it('renders all 5 tabs', () => {
    render(<Portfolio />, { wrapper: Wrapper })
    expect(screen.getByRole('tab', { name: /Hero Carousel/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Categories/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Category Photos/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /About/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Contact Submissions/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Add routes to routes/index.tsx**

In `frontend/src/routes/index.tsx`, add public routes and admin portfolio:

```typescript
import Landing from '../pages/public/Landing'
import Gallery from '../pages/public/Gallery'
import Portfolio from '../pages/admin/Portfolio'

// Public routes (no auth guard needed — add before admin routes):
// <Route path="/" element={<Landing />} />
// <Route path="/portfolio/:slug" element={<Gallery />} />

// Inside admin route subtree:
// <Route path="/admin/portfolio" element={<Portfolio />} />
```

- [ ] **Step 5: Run all frontend tests**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm test -- --watchAll=false
```

Expected: All PASS.

- [ ] **Step 6: Commit everything**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add migrations/006_seo.sql frontend/src/
git commit -m "feat: implement portfolio frontend — Landing, Gallery, admin Portfolio management, SEO meta tags"
```
