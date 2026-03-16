# weCapture4U — SEO & Open Graph Design

## Overview

Adds SEO meta tags and Open Graph support to the public landing page (`/`). The photographer can edit the page title, description, and social sharing image from the admin panel (Portfolio → About & Settings, Tab 4). Meta tags are injected client-side via `react-helmet-async`.

**Scope:** Landing page only (`/`). No other pages in this iteration.

---

## Tech Stack

Same as the rest of the project. One new frontend dependency:

| Addition | Purpose |
|---|---|
| `react-helmet-async` | Client-side meta tag injection in React SPA |

---

## Data Model

### `app_settings` — New Columns

Add to the existing single-row `app_settings` table:

| Column | Type | Notes |
|---|---|---|
| `meta_title` | text | nullable — used as `<title>` and `og:title`. Fallback when null: `"{admin_name} Photography"` (see Fallback Behaviour below). |
| `meta_description` | text | nullable — used as `<meta name="description">` and `og:description`. Tag omitted entirely when null. |
| `og_image_url` | text | nullable — full HTTPS public URL in Supabase Storage at `portfolio/og-image/{uuid}.webp`. Enforced to 1200×630 by the upload pipeline (Pillow centre-crop) — not a DB or Storage constraint. Tag omitted entirely when null. |

> Migration: `006_seo.sql` — adds three nullable columns to `app_settings`. The `app_settings` row is created in `001_initial_schema.sql`; `005_portfolio.sql` adds portfolio columns to it. Run migrations in order.

---

## Photo Storage

og:image stored in Supabase Storage under the existing `portfolio` bucket (public read):

| Type | Path |
|---|---|
| Social sharing image | `portfolio/og-image/{uuid}.webp` |

**Upload pipeline:**
1. Frontend sends file via `POST /api/settings/og-image` (multipart)
2. FastAPI reads `Content-Length` header — if > 10MB, returns `413` before reading the body
3. FastAPI validates MIME type — if not an image, returns `422`
4. Pillow: centre-crop to 1200×630, convert to WebP, compress
5. Upload to Supabase Storage at `portfolio/og-image/{uuid}.webp`
6. Update `app_settings.og_image_url` with public URL
7. Delete old Storage file if one existed — extract Storage-relative key from the previous `og_image_url` by stripping everything up to and including `/object/public/portfolio/` (same extraction rule used for hero photos, category covers, and gallery photos in the portfolio spec). Pass the key to `storage.from_('portfolio').remove([key])`.

If Storage upload fails: return `503 "Failed to upload image. Please try again."` — `og_image_url` unchanged.
If old file delete fails: log orphan path, proceed — DB already has new URL.

---

## FastAPI Endpoints

### Extended (existing endpoints)

**`GET /api/settings/public`** — complete updated response shape (adds three fields to existing response):

```json
{
  "tagline": "string | null",
  "bio": "string | null",
  "instagram_url": "string | null",
  "facebook_url": "string | null",
  "contact_headline": "string | null",
  "admin_name": "string | null",
  "admin_avatar_url": "string | null",
  "meta_title": "string | null",
  "meta_description": "string | null",
  "og_image_url": "string | null"
}
```

**`GET /api/settings/about`** — complete updated response shape (adds three fields to existing response):

```json
{
  "tagline": "string | null",
  "bio": "string | null",
  "instagram_url": "string | null",
  "facebook_url": "string | null",
  "contact_headline": "string | null",
  "contact_email": "string | null",
  "meta_title": "string | null",
  "meta_description": "string | null",
  "og_image_url": "string | null"
}
```

**`PATCH /api/settings/about`** — complete request/response definition (extends existing endpoint):

Request body (JSON, all fields optional):

```json
{
  "tagline": "string | null",
  "bio": "string | null",
  "instagram_url": "string | null",
  "facebook_url": "string | null",
  "contact_headline": "string | null",
  "contact_email": "string | null",
  "meta_title": "string | null",
  "meta_description": "string | null"
}
```

Null semantics (applied via Pydantic v2 `model.model_dump(exclude_unset=True)`): absent = no change; present as `null` = clear column. `og_image_url` is **not** accepted in this endpoint — it is managed via the dedicated upload/delete endpoints below.

Validation: `contact_email` (if present and non-null) must be valid email format (max 254 chars). `instagram_url`, `facebook_url` (if present and non-null) must be valid HTTP/HTTPS URLs.

Response: `200` with the complete `GET /api/settings/about` response shape (all fields including the three new SEO fields).

### New Endpoints (Admin, JWT required, role: admin)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/settings/og-image` | Upload og:image. Request: `multipart/form-data`, field: `image` (single file). Size check via `Content-Length` header before body read. Pillow centre-crops to 1200×630, converts to WebP. Uploads to `portfolio/og-image/{uuid}.webp`. Deletes previous Storage file if one existed (using path extraction described in Photo Storage section). Updates `app_settings.og_image_url`. Returns `200 {og_image_url: string}`. Returns `422 "Only image files are accepted."` for non-image MIME. Returns `413 "File too large. Maximum size is 10MB."` if `Content-Length` > 10MB. Returns `503 "Failed to upload image. Please try again."` on Storage failure. |
| `DELETE` | `/api/settings/og-image` | Remove og:image. Extracts Storage path from `og_image_url` using same path extraction rule. Deletes file from Storage. Sets `app_settings.og_image_url = null`. Storage failure: log orphan path, proceed. Returns `204`. Returns `404` if `og_image_url` is already null. |

---

## Admin UI

### Portfolio → About & Settings (Tab 4) — New "SEO" Section

Added below the existing social links and contact fields. Contains:

- **Page title** — text input bound to `meta_title`. Placeholder: `"e.g. weCapture4U Photography — Wedding & Portrait Photographer"`. Character guidance: aim for under 60 characters.
- **Page description** — textarea bound to `meta_description`. Placeholder: `"e.g. Professional wedding and portrait photography."`. Character guidance: aim for under 160 characters.
- **Social sharing image** — file upload component.
  - Shows current image preview (thumbnail) when `og_image_url` is set, with dimensions note: "1200×630 recommended".
  - "Upload image" button → file picker → `POST /api/settings/og-image` → preview updates immediately.
  - "Remove" button (shown only when image is set) → `DELETE /api/settings/og-image` → preview cleared.
  - Upload and remove are immediate (their own API calls) — do not wait for the section's Save button.
- **Save button** (existing Tab 4 save) — saves `meta_title` and `meta_description` via `PATCH /api/settings/about`. `og_image_url` is managed separately via the upload/delete endpoints above.

---

## Frontend — Meta Tag Injection

`react-helmet-async` is added as a new dependency. `HelmetProvider` wraps the app root in `main.tsx`.

In `Landing.tsx`, after `GET /api/settings/public` resolves, the following tags are rendered:

```tsx
<Helmet>
  <title>{meta_title ?? (admin_name ? `${admin_name} Photography` : 'Photography')}</title>
  {meta_description && <meta name="description" content={meta_description} />}
  <meta property="og:type" content="website" />
  <meta property="og:title" content={meta_title ?? (admin_name ? `${admin_name} Photography` : 'Photography')} />
  {meta_description && <meta property="og:description" content={meta_description} />}
  {og_image_url && <meta property="og:image" content={og_image_url} />}
  <meta property="og:url" content={`${window.location.origin}/`} />
</Helmet>
```

**Fallback behaviour:**
- `meta_title` null + `admin_name` set → title: `"{admin_name} Photography"`
- `meta_title` null + `admin_name` null → title: `"Photography"`
- `meta_description` null → `<meta name="description">` and `og:description` tags omitted entirely
- `og_image_url` null → `og:image` tag omitted entirely

> `og:url` uses `window.location.origin + "/"` (not `window.location.href`) to produce a stable canonical URL without query parameters.

**Crawler limitation:** Meta tags are injected via JavaScript. Social sharing crawlers (Facebook, LinkedIn, WhatsApp, iMessage) execute JavaScript and will read the tags correctly. Google's basic crawler may not — this is an accepted trade-off for a React SPA without SSR. The primary use case is social sharing previews, which work correctly.

> **Twitter/X:** No `twitter:` card tags are added (out of scope). Twitter/X falls back to `og:` tags when no `twitter:` tags are present — social sharing previews on X will work via this fallback.

---

## Error Handling

| Condition | Response |
|---|---|
| og:image upload — non-image file | `422` — "Only image files are accepted." |
| og:image upload — file > 10MB (`Content-Length` check) | `413` — "File too large. Maximum size is 10MB." |
| og:image upload — Storage failure | `503` — "Failed to upload image. Please try again." |
| og:image delete — no image set (`og_image_url` is null) | `404` |
| og:image delete — Storage failure | Log orphan path; proceed; `204` returned |
| `meta_title` / `meta_description` save failure | Toast notification; raw error not exposed to UI |

---

## Migration

`006_seo.sql` (depends on `006_portfolio.sql` — run in order):

```sql
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text;
```

Run before deploying backend code that references these columns.

---

## Testing Strategy

- **Unit tests (backend):** Pillow 1200×630 centre-crop pipeline, `Content-Length` size rejection before body read, og:image Storage path extraction (URL round-trip: upload → extract key → delete)
- **Integration tests (backend):** `POST /api/settings/og-image` (upload + DB update + old file cleanup), `DELETE /api/settings/og-image` (DB null + Storage delete + 404 when already null), `GET /api/settings/public` returns all ten fields including new SEO fields, `PATCH /api/settings/about` null semantics for `meta_title` and `meta_description`
- **Component tests:** Tab 4 SEO section — upload preview updates on success, remove button visibility, save button triggers only `meta_title` and `meta_description` (not `og_image_url`)
- **Manual verification:** Share landing page URL on Facebook / WhatsApp to confirm og:image and og:title appear in social preview

---

## Out of Scope (This Iteration)

- SEO meta tags on portfolio gallery pages (`/portfolio/:slug`)
- Server-side rendering / prerendering for Googlebot
- Structured data (JSON-LD)
- Sitemap generation
- robots.txt
- Twitter/X card meta tags (`og:` tags serve as fallback for X — accepted for this iteration)
- Per-page SEO config beyond the landing page
