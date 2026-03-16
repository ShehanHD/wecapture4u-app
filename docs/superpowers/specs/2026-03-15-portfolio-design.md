# weCapture4U — Portfolio & Landing Page Design

## Overview

A public-facing portfolio and landing page for the photographer. Serves as the primary online presence — visitors browse work by category, learn about the photographer, and send booking enquiries. No authentication required for any public route.

The landing page is hosted on Hostinger as part of the React SPA. Categories and photos are managed entirely through the existing admin panel (new Portfolio section). Photos are stored in Supabase Storage.

---

## Tech Stack

Same as the rest of the project. No additional libraries required except:

| Addition | Purpose |
|---|---|
| CSS Columns (native) | Masonry photo grid on gallery pages |
| Supabase Storage (`portfolio` bucket — new, public read) | Photo storage |
| Pillow (already in backend) | Resize and compress uploaded photos to WebP before storage |
| Resend (already in backend) | Contact form email notification to photographer |
| slowapi (new backend package) | Rate limiting for `POST /api/contact` — in-memory, acceptable for single-instance Fly.io deployment |
| @dnd-kit/core (already in frontend) | Drag-and-drop reorder for hero photos, categories, gallery photos |

> **Fresh deploy checklist (portfolio additions):** (1) Run migration `005_portfolio.sql` via the Supabase SQL editor or `psql` (see deployment spec). (2) Verify `app_settings` row exists after migration (the migration seeds it; confirm the `ON CONFLICT DO NOTHING` insert succeeded if running against a pre-existing DB). (3) Create the `portfolio` Supabase Storage bucket with public read access (Supabase dashboard, one-time). (4) Ensure `SUPABASE_SERVICE_KEY` env var is set. The main deployment spec (`docs/superpowers/specs/2026-03-15-deployment-design.md`) covers the full pre-launch checklist.

> **Supabase Storage setup:** The `portfolio` bucket must be created manually in the Supabase dashboard with public read access before the first deploy. This is a one-time setup step, not a SQL migration. FastAPI performs a startup check on boot: it verifies the `portfolio` bucket is accessible via the Supabase Storage client. If the check fails, FastAPI logs a fatal warning `"FATAL: Supabase Storage 'portfolio' bucket not found or inaccessible — photo uploads will fail"` and continues booting (does not crash, to allow read-only endpoints to still work). Any upload attempt while the bucket is unavailable returns `503 "Photo storage is unavailable. Please contact the administrator."`.

---

## Routes

| Route | Page | Auth |
|---|---|---|
| `/` | Landing page | Public |
| `/portfolio/:slug` | Category gallery page | Public |
| `/admin/portfolio` | Portfolio management | Admin only |

---

## Data Model

### `hero_photos`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `image_url` | text | Full HTTPS public URL from Supabase Storage (e.g. `https://<project>.supabase.co/storage/v1/object/public/portfolio/hero/{uuid}.webp`). Path notation `portfolio/hero/{uuid}.webp` is the Storage-relative path only — the column stores the full URL. |
| `position` | integer | Display order in carousel. Lower = shown first. On insert: `COALESCE(MAX(position), 0) + 1`. |
| `created_at` | timestamptz | |

> Maximum 20 hero photos enforced at the API layer (`POST /api/portfolio/hero` returns `409` if count ≥ 20).

### `portfolio_categories`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | Display name (e.g. "Weddings") |
| `slug` | text | UNIQUE — URL-safe identifier (e.g. `weddings`). Auto-generated from name on create. **Immutable after creation** — cannot be changed via API to prevent Storage URL breakage. |
| `cover_url` | text | NOT NULL at DB level. Full HTTPS public URL from Supabase Storage (same format as `image_url`). Required at creation; the create form enforces a cover photo upload before submitting. |
| `position` | integer | Display order on the landing page. On insert: `COALESCE(MAX(position), 0) + 1`. |
| `created_at` | timestamptz | |

> `slug` is immutable after creation — enforced at the API layer only (the `PATCH` endpoint ignores any `slug` field in the request body). No DB-level trigger or generated column is used; this is a deliberate simplicity trade-off for V1. Direct DB edits bypassing the API would break photo URLs; this risk is accepted and noted in the testing requirements.

> **Slug generation algorithm:** lowercase → strip/transliterate accents (e.g. `é` → `e`) → replace spaces and non-alphanumeric characters with hyphens → collapse consecutive hyphens → strip leading/trailing hyphens → truncate to 80 characters. Example: `"Weddings & Portraits!"` → `"weddings-portraits"`. If the generated slug is empty after processing (e.g., a name consisting entirely of non-Latin characters that reduce to nothing), return `422` with "Category name must produce a valid URL slug (use letters, numbers, or hyphens)." Duplicate slug on create returns `409` with message `"A category with this slug already exists."`.

> If an admin wants a different slug, they must delete and recreate the category (which requires removing all photos first).

### `portfolio_photos`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `category_id` | uuid (FK → portfolio_categories) | |
| `image_url` | text | Full HTTPS public URL from Supabase Storage (e.g. `https://<project>.supabase.co/storage/v1/object/public/portfolio/{category_slug}/{uuid}.webp`). Slug used at upload time — safe because slugs are immutable. |
| `position` | integer | Display order within the category gallery. On insert: `COALESCE(MAX(position), 0) + 1` within the category. |
| `created_at` | timestamptz | |

### `contact_submissions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | |
| `email` | text | |
| `message` | text | |
| `created_at` | timestamptz | Indexed for sorted listing |

> Contact submissions are stored in the DB and visible in the admin Portfolio section (Contact Submissions sub-tab). They also trigger an email notification to the photographer via Resend. Email send failure does not crash the form — logged server-side, graceful degradation.

---

## Photo Storage

All portfolio photos stored in Supabase Storage under the `portfolio` bucket (public read):

| Type | Path |
|---|---|
| Hero carousel photos | `portfolio/hero/{uuid}.webp` |
| Category cover photo | `portfolio/covers/{uuid}.webp` |
| Category gallery photos | `portfolio/{category_slug}/{uuid}.webp` |

> Cover photos use a UUID filename (not slug) to avoid slug-collision overwrites if a category is deleted and recreated with the same slug. The canonical path is always derived from the `cover_url` column — never re-derived from the slug.

**Upload pipeline** (same pattern as avatar — already implemented in FastAPI):
1. Frontend sends file via `POST` multipart form to FastAPI
2. FastAPI validates: file must be an image (MIME type check), max size 10MB
3. FastAPI → Pillow: resize to max 1920px on longest side (preserving aspect ratio), convert to WebP, compress
4. FastAPI uploads to Supabase Storage at the appropriate path
5. FastAPI returns the public URL, stored in the relevant table column

**Cover photo replacement:** When `PATCH /api/portfolio/categories/:id` replaces the cover photo, the operation follows upload-first order to avoid the broken-cover failure window:
1. Fetch the category row (existence check) and capture the current `cover_url` value — the old file path is saved here, before any upload begins
2. Upload the new file to Storage → get new URL
3. Update `cover_url` in the DB (and `name` if provided in the same PATCH)
4. Delete the old file from Storage using the path captured in step 1 — extract the Storage-relative key from the full `cover_url` URL using the rule documented in the "Storage URL format and path extraction" note (strip everything up to and including `/object/public/portfolio/`)

If step 2 (upload) fails: return `503 "Failed to replace cover photo. Please try again."` — old cover unchanged.
If step 3 (DB write) fails after step 2 succeeds: return `500 "An error occurred. Please try again."` — the newly uploaded Storage file becomes an orphan (logged for manual cleanup). No Storage rollback is attempted.
If step 4 (old file delete) fails: log the orphan path and accept it — the DB already has the new URL, so the cover displays correctly.

The `cover_url` column is the single source of truth for the Storage path — never re-derived from slug.

**Photo deletion and Storage cleanup:**
- `DELETE /api/portfolio/hero/:id` — deletes the DB row, then deletes the file from Supabase Storage (path derived by parsing `image_url`). Remaining hero photos are renumbered (positions updated to 1..N) in the same transaction to keep positions contiguous. If Storage delete fails: log the error, proceed with DB delete, accept the orphan rather than leaving the admin blocked.
- `DELETE /api/portfolio/photos/:id` — same approach: DB row deleted, remaining photos in the same category renumbered to contiguous 1..N, then Storage file deleted (path from `image_url`), Storage failure logged and accepted.
- `DELETE /api/portfolio/categories/:id` — after verifying no photos remain, deletes `cover_url` file from Storage (path from `cover_url`), then deletes the DB row. Storage failure logged and accepted. The `portfolio/{category_slug}/` Storage "folder" does not need explicit deletion (Supabase Storage is object-based; the prefix disappears when all objects under it are gone).

> **Position renumbering on delete:** Both hero photo and gallery photo DELETE endpoints execute the row DELETE and position renumber (UPDATE remaining rows to 1..N) in a single DB transaction. If the transaction fails, it rolls back entirely — the row is not deleted and positions are unchanged — and the endpoint returns `500 "An error occurred. Please try again."`. The Storage file delete happens after the transaction commits (so the DB is always consistent before touching Storage).

> **Storage failure policy:** Orphaned files are preferable to a blocked admin UI. All Storage delete failures are logged server-side with the file path so they can be manually cleaned up. This includes compensating deletes during multi-file upload rollback — if a rollback Storage delete fails, the orphan path is logged (the `503` response is still returned to the client regardless). This is acceptable for V1 (low volume, solo photographer).

**Multi-file upload behaviour:** `POST /api/portfolio/categories/:id/photos` accepts multiple files. Request: `multipart/form-data`, field name `photos` (multiple files). Processing is all-or-nothing in two phases:

1. **Validation phase:** all files are validated (MIME type + size) before any upload begins. If any file fails, the entire request is rejected with `422` — no uploads occur.
2. **Upload + insert phase:** all files are uploaded to Storage sequentially (max 20 files per request — `422 "Maximum 20 files per upload"` if exceeded). If any Storage upload fails, all already-uploaded Storage objects from this request are deleted (best-effort), no DB rows are inserted, and `503 "Upload failed. Please try again."` is returned. Once all uploads succeed, all DB rows (`portfolio_photos`) are inserted in a single serializable DB transaction. To prevent concurrent upload races producing duplicate positions, acquire a row-level lock at the start of the transaction via `SELECT id FROM portfolio_categories WHERE id = :category_id FOR UPDATE`, then read `MAX(position)` and assign positions sequentially as `MAX+1, MAX+2, ... MAX+N` within the same transaction. This ensures the gallery never ends up in a partial state.

**Category gallery response size:** `GET /api/portfolio/categories/:slug` returns the category row plus all its photos inline. No pagination is applied — this is intentional for V1. Photo counts per category are expected to remain small (tens, not hundreds) for a solo photographer. If a category grows large, pagination can be added in a future iteration without a breaking API change.

**Storage URL format and path extraction:** `image_url` and `cover_url` always store the **full HTTPS public URL** returned by Supabase Storage after upload — never just the relative path. To delete a file, extract the Storage-relative key by stripping the prefix up to and including `/object/public/portfolio/`. Example: `https://<project>.supabase.co/storage/v1/object/public/portfolio/hero/uuid.webp` → key is `hero/uuid.webp`; pass this key to `storage.from_('portfolio').remove(['hero/uuid.webp'])`. The columns are the single source of truth — paths are never re-derived from slug or uuid.

---

## Landing Page (`/`)

### Nav
Sticky top bar. Transparent over the hero (text white), transitions to solid `#0c0c0c` background on scroll past the hero. Links: **Portfolio · About · Contact · Login · Book Now** (amber button).

- **Portfolio** → scrolls to the Categories section (anchor `#portfolio`)
- **About** → scrolls to the About section (anchor `#about`)
- **Contact** → scrolls to the Contact section (anchor `#contact`)
- **Login** → `/client/login` (always visible regardless of auth state — no session-aware logic in the public nav)
- **Book Now** → scrolls to the Contact section (anchor `#contact`)
- Mobile: hamburger menu (☰) collapses all links into a full-width drawer overlay

### Section 1 — Hero Carousel
- Full-width, full-height-viewport photo carousel
- Auto-advances every 5 seconds; pauses on hover, resumes immediately on mouse-leave (no additional delay)
- Prev / next arrow buttons on left and right edges
- Dot indicators bottom-right (active dot: amber, inactive: white at 35% opacity)
- **Bottom-anchored text overlay:**
  - Bottom-to-top gradient fade: `rgba(0,0,0,0)` → `rgba(0,0,0,0.85)`
  - Small uppercase label: "Photography" (muted, letter-spaced)
  - Tagline (from `app_settings.tagline`): e.g. *"Capturing moments that last forever"*. If `tagline` is null, this line is hidden.
  - **"Book a Session"** amber rounded CTA button — anchors to `#contact`
- Photos loaded from `hero_photos` ordered by `position`
- If `hero_photos` is empty (initial setup state — before the admin has uploaded any photo): show a solid dark `#0c0c0c` background with the tagline and CTA button, no broken image. Once the admin uploads the first hero photo, this state is no longer reachable via the API (the delete-last-photo block prevents returning to zero). The API enforces: if `hero_photos` has ≥ 1 row, `DELETE /api/portfolio/hero/:id` blocks deletion when count = 1 (`409`). Zero is only reachable on a fresh deploy before the first upload — deletion can never produce zero.

### Section 2 — Categories
- Section anchor: `id="portfolio"`
- Section label: "Browse by category" (uppercase, muted gray)
- **Desktop (≥ 768px):** 2-column CSS grid
- **Mobile (< 768px):** single-column full-width stack
- Each card: cover photo (`cover_url`) with `object-fit: cover`, fixed height (200px desktop / 180px mobile)
- Dark overlay: `rgba(0,0,0,0.45)` over the photo
- Category name centered: white, bold, uppercase, letter-spacing
- No photo count. No divider line.
- Entire card is a link → `/portfolio/[slug]`
- Cards ordered by `portfolio_categories.position`
- If no categories exist: section hidden entirely

### Section 3 — About
- Section anchor: `id="about"`
- Section label: "About"
- Circular avatar photo: from `users.avatar_url` WHERE `role = 'admin'` ORDER BY `created_at` ASC LIMIT 1 (the first-created admin account — the system supports only one admin per the project's Out of Scope)
- If `avatar_url` is null: show initials placeholder (same pattern as client portal)
- Admin name (from `users.full_name` of same user), bio text (from `app_settings.bio`), social links (`app_settings.instagram_url`, `app_settings.facebook_url`)
- Social links open in new tab. Hidden if null.
- If `bio` is null: section shows name and avatar only (no broken layout)

### Section 4 — Contact
- Section anchor: `id="contact"`
- Headline from `app_settings.contact_headline` (fallback: "Get in touch")
- Form fields: Name (required), Email (required, format-validated), Message (required, textarea)
- **Request body schema:** `{name: str (1–200 chars, trimmed), email: valid email format (1–254 chars), message: str (1–5000 chars, trimmed)}`. All three fields required. Server trims whitespace before validation.
- Submit → `POST /api/contact` → stored in `contact_submissions` + email sent to `app_settings.contact_email` (falls back to admin `users.email` if null)
- Success state: form replaced with "Thanks! I'll be in touch soon." message
- Error state (non-201 response including `429`, `5xx`): show inline error "Something went wrong. Please try again." without clearing form fields so the user does not lose their input
- Client-side validation: Zod + react-hook-form. Server-side: Pydantic v2.
- Rate limiting: max 3 submissions per IP per hour via `slowapi` (in-memory — resets on process restart, acceptable for single-instance V1 deployment; not suitable for multi-instance scale-out)

### Footer
- Copyright: "© [current year] [admin full_name] Photography". If `admin_name` is null, renders "© [current year] Photography" (name portion omitted).
- Client Login link → `/client/login`

---

## Gallery Page (`/portfolio/:slug`)

### Header
- Back link: "← Portfolio" → `/`
- Category name (large, bold)
- Photo count: "X photos"

### Photo Grid
- CSS columns masonry layout (3 columns desktop / 2 columns tablet / 1 column mobile)
- All photos loaded at once (no pagination — acceptable for V1; photo counts are expected to remain small for a solo photographer)
- Photos from `portfolio_photos` where `category_id` matches slug lookup, ordered by `position`
- Each photo: `object-fit: cover`, rounded corners, gap between items
- Hover: subtle scale transform (1.02) with smooth transition
- Click → opens lightbox

### Lightbox
- Full-screen dark overlay (`rgba(0,0,0,0.95)`)
- Selected photo centered, max-width constrained, preserves aspect ratio
- **Navigation:**
  - Left / right arrow buttons
  - Keyboard: `←` `→` to navigate, `ESC` to close
  - Click outside the photo to close
- Close button (×) top-right corner
- Photo counter: "3 / 12" bottom-center
- Swipe support on mobile (touch events: swipe left/right to navigate)

### 404 handling
- If `slug` does not match any `portfolio_categories.slug` → redirect to `/`

---

## Admin Panel — Portfolio Section (`/admin/portfolio`)

New item in the admin sidebar navigation. Five sub-sections rendered as tabs:

> **Reorder 422 recovery:** If any reorder endpoint returns `422` (stale client state from a concurrent create or delete in another tab), the frontend silently refetches the affected list and re-renders without showing an error message to the user. This applies to all three reorder endpoints: hero photos, categories, and gallery photos.

### Tab 1 — Hero Carousel
- Grid of current hero photos ordered by `position`, drag-and-drop reorder
- "Upload photo" button → file picker → upload pipeline → new `hero_photos` row
- Delete button per photo (confirmation dialog)
- Delete blocked if only 1 photo remains → `409` ("At least one hero photo is required.")
- Maximum 20 photos enforced — upload button disabled when count = 20

### Tab 2 — Categories
- List of all categories ordered by `position`, drag-and-drop reorder
- **Create category:** name field (slug shown as read-only preview, auto-generated) + cover photo upload (required before submit)
- **Rename** inline (name only — slug is immutable and shown as read-only)
- **Update cover photo** — replace cover image via file picker
- **Reorder** via drag-and-drop
- **Delete** — blocked with `409` if category has photos ("Remove X photos first"). If empty: confirmation dialog before delete.
- Click category row → navigates to Tab 3 filtered to that category

### Tab 3 — Category Photos
- Dropdown to select category (or pre-selected from Tab 2 click)
- Grid of all photos in the selected category, ordered by `position`
- Drag-and-drop reorder
- Upload: multi-file picker (all-or-nothing validation before any upload)
- Delete per photo (no confirmation — immediate delete, intentional product decision). No minimum photo count per category — a category may have zero photos. If delete returns `404` (photo already deleted in another tab), the frontend silently removes the item from the grid with no error shown. For any non-`204`/non-`404` response (e.g. `500`), show an inline error toast: "Failed to delete photo. Please try again." Once a category reaches zero photos, no "Delete category" shortcut is shown in Tab 3 — the user navigates to Tab 2 to delete it.

### Tab 4 — About & Settings
- **Tagline** — hero carousel bottom text (single line, optional)
- **Bio** — short paragraph shown in About section (optional)
- **Instagram URL** — optional; if present, must be a valid HTTP/HTTPS URL (server validates format, returns `422` if invalid)
- **Facebook URL** — optional; same URL format validation as Instagram URL
- **Contact headline** — heading above the contact form (optional, fallback: "Get in touch")
- **Contact email** — recipient of form submissions (optional, fallback: admin `users.email`)
- Save button → `PATCH /api/settings/about`

### Tab 5 — Contact Submissions
- Paginated list of all `contact_submissions` ordered by `created_at` desc
- Columns: date, name, email, message preview (client-side truncation to first 120 characters with ellipsis — server always returns full message text)
- Click row → expand full message inline
- No delete or reply actions (out of scope — view only)

---

## FastAPI Endpoints

### Public (no auth)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/portfolio/hero` | List hero photos ordered by position. Response: `[{id, image_url, position}]` |
| `GET` | `/api/portfolio/categories` | List all categories ordered by position. Response: `[{id, name, slug, cover_url, position}]` |
| `GET` | `/api/portfolio/categories/:slug` | Single category by slug with all photos inline, ordered by position. Response: `{id, name, slug, cover_url, position, photos: [{id, image_url, position}]}`. Returns 404 if slug not found (frontend redirects to `/`). |
| `GET` | `/api/settings/public` | Returns public-facing site settings and admin profile for the landing page. DB query: JOIN `app_settings` (tagline, bio, instagram_url, facebook_url, contact_headline) with `SELECT full_name, avatar_url FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`. If no `app_settings` row exists (migration not yet run), all settings fields are returned as `null`. If no admin user exists, `admin_name` and `admin_avatar_url` are returned as `null` — frontend hides the About section and renders a plain copyright line. DB error returns `500`. Response: `{tagline, bio, instagram_url, facebook_url, contact_headline, admin_name, admin_avatar_url}`. `contact_email` is not included (server-side only). All fields nullable. |
| `POST` | `/api/contact` | Submit contact form. Rate limited: 3/IP/hour via slowapi. Request body (JSON): `{name: str (1–200 chars, trimmed), email: valid email (1–254 chars), message: str (1–5000 chars, trimmed)}`. Success: `201 {id: uuid}` — `id` is for server-side correlation/debugging only; frontend checks status code only. A minimal inline response model (e.g. `ContactSubmissionResponse(id: UUID)`) is sufficient — no reuse with other schemas required. Validation failure: `422 {detail: [...Pydantic error list]}`. Rate limit exceeded: `429 {"error": "Too many requests. Please try again later."}`. |

### Admin (JWT required, role: admin)

> **Route ordering note:** In FastAPI, literal path segments must be registered before parameterised ones. `/api/portfolio/hero/positions` must be declared before `/api/portfolio/hero/:id`; `/api/portfolio/categories/positions` before `/api/portfolio/categories/:id`; and `/api/portfolio/categories/:id/photos/positions` before any conflicting parameterised route under `categories/:id`.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/portfolio/hero` | Upload hero photo. Request: `multipart/form-data`, field: `photo` (single file). Returns `201 {id, image_url, position}`. Returns `409` if count ≥ 20. Returns `503 "Failed to upload photo. Please try again."` if Storage upload fails. |
| `PATCH` | `/api/portfolio/hero/positions` | Reorder: body `[{id, position}]`. The server validates: (1) submitted `id` set exactly matches existing DB IDs (not just same count — wrong, extra, or missing IDs return `422`); (2) position values form a contiguous sequence starting at exactly `1` — valid: `[1,2,3]`; invalid: `[2,3,4]` or `[1,3,5]` (returns `422`). The server uses submitted position values as-is (does not re-normalize). Returns `200 {ok: true}`. Returns `422 "Position array must cover all existing items."` on any validation failure. |
| `DELETE` | `/api/portfolio/hero/:id` | Delete hero photo; renumbers remaining positions. Returns `204`. Returns `404` if photo not found. Returns `409` if last photo. |
| `POST` | `/api/portfolio/categories` | Create category. Request: `multipart/form-data`. Fields: `name` (str, required — `422 "name is required"` if absent/empty), `cover` (file, required — `422 "cover photo is required"` if absent). Slug auto-generated from name. Cover is uploaded to Storage before the DB row is inserted; if Storage upload fails, returns `503 "Failed to upload cover photo. Please try again."` and no DB row is created. Returns `201 {id, name, slug, cover_url, position}`. |
| `PATCH` | `/api/portfolio/categories/positions` | Reorder categories. Same ID-set equality validation rules as hero reorder. Returns `200 {ok: true}`. |
| `PATCH` | `/api/portfolio/categories/:id` | Rename (name only) or replace cover photo (or both). Any `slug` multipart field is silently ignored — not rejected. Request: `multipart/form-data`. Fields: `name` (str, optional), `cover` (file, optional). At least one must be present — `422 "At least one of 'name' or 'cover' must be provided."` if both absent. Category existence is verified before any file upload begins — a missing category returns `404` before any Storage write occurs. Returns `200 {id, name, slug, cover_url, position}`. Returns `404` if category not found. |
| `DELETE` | `/api/portfolio/categories/:id` | Delete. Returns `204`. Photo-count check + category DELETE execute in a single serializable DB transaction (no TOCTOU race). The FK constraint `ON DELETE RESTRICT` is the final guard: if a concurrent photo insert races through, the DELETE raises a FK violation which is caught and returned as `409 "Remove all photos from this category first."` — the same message as the pre-check `409`, intentionally. Returns `404` if category not found. Returns `409` if any photos exist. |
| `POST` | `/api/portfolio/categories/:id/photos` | Upload photos. Request: `multipart/form-data`, field: `photos` (multiple files, max 20). All-or-nothing (validation + Storage upload + DB insert). Returns `201 [{id, image_url, position}]`. Returns `404` if category not found. Returns `422 "Maximum 20 files per upload"` if more than 20 files submitted. Returns `503` on Storage upload failure. |
| `PATCH` | `/api/portfolio/categories/:id/photos/positions` | Reorder photos within category. Same ID-set equality validation rules as hero reorder. Returns `200 {ok: true}`. Returns `404` if category not found. If the submitted ID set no longer matches the DB (concurrent delete from another tab), returns `422` — the frontend silently refetches and re-renders the photo grid. |
| `DELETE` | `/api/portfolio/photos/:id` | Delete a single photo; renumbers remaining category positions. DB delete + renumber execute in a single DB transaction — if the transaction fails, it rolls back and returns `500 "An error occurred. Please try again."` (same contract as hero photo delete). Storage file delete follows transaction commit. Returns `204`. Returns `404` if photo not found. |
| `GET` | `/api/contact/submissions` | List contact submissions paginated. Query params: `page` (int ≥ 1, default 1 — `422` if < 1), `page_size` (int 1–100, default 20 — `422` if < 1 or > 100). Response: `{items: [{id, name, email, message, created_at}], total: int, page: int, page_size: int}`. Ordered by `created_at` desc. |
| `GET` | `/api/settings/about` | Load current about/settings values for the Tab 4 admin form. Response: `{tagline, bio, instagram_url, facebook_url, contact_headline, contact_email}`. |
| `PATCH` | `/api/settings/about` | Update tagline, bio, social links, contact headline, contact email. Request body: JSON. All fields optional (partial update). **Null semantics:** a field present with value `null` clears the column; a field absent is left unchanged. Implement with Pydantic v2 using `model.model_dump(exclude_unset=True)` so absent fields are not included in the update — this distinguishes "absent = no change" from "present as null = clear". `contact_email`, if present and non-null, must be a valid email format (max 254 chars) — returns `422 "contact_email must be a valid email address."` if invalid. `instagram_url`, if present and non-null, must be a valid HTTP/HTTPS URL — returns `422 "instagram_url must be a valid HTTP/HTTPS URL."` if invalid. `facebook_url`, same — returns `422 "facebook_url must be a valid HTTP/HTTPS URL."` if invalid. Returns `200` with all six fields. |

---

## `app_settings` — New Columns

Add to the existing single-row `app_settings` table.

> **Fresh deploy seeding:** Migration `005_portfolio.sql` inserts the `app_settings` row with all new columns set to `NULL` using `INSERT INTO app_settings (...) VALUES (...) ON CONFLICT DO NOTHING`. This ensures the row exists on a fresh database and is a no-op on an existing deployment that already has the row.

| Column | Type | Notes |
|---|---|---|
| `tagline` | text | nullable — hero carousel bottom text |
| `bio` | text | nullable — About section body text |
| `instagram_url` | text | nullable |
| `facebook_url` | text | nullable |
| `contact_headline` | text | nullable — fallback: "Get in touch" |
| `contact_email` | text | nullable — fallback: admin `users.email`. Max 254 chars (consistent with API validation). |

---

## Updated Folder Structure

```
frontend/src/
  pages/
    public/
      Landing.tsx          # /
      Gallery.tsx          # /portfolio/:slug
    admin/
      Portfolio.tsx        # /admin/portfolio (all 5 tabs)
  components/
    public/
      HeroCarousel.tsx
      CategoryGrid.tsx
      AboutSection.tsx
      ContactForm.tsx
      Lightbox.tsx
    layout/
      PublicNav.tsx        # Sticky nav with scroll + hamburger
      PublicFooter.tsx

backend/app/
  routers/
    portfolio.py           # All portfolio public + admin endpoints
    contact.py             # POST /api/contact (public) + GET /api/contact/submissions (admin). Auth is per-route — not router-level — because the router mixes public and protected endpoints.
  models/
    portfolio.py           # hero_photos, portfolio_categories, portfolio_photos, contact_submissions
  schemas/
    portfolio.py

migrations/
  005_portfolio.sql        # New tables + app_settings columns + indexes + FK constraints. Key indexes: CREATE INDEX ON contact_submissions (created_at DESC); CREATE INDEX ON hero_photos (position); CREATE INDEX ON portfolio_categories (position); CREATE INDEX ON portfolio_photos (category_id, position). FK: portfolio_photos.category_id ON DELETE RESTRICT. Seeding: INSERT INTO app_settings ON CONFLICT DO NOTHING.
```

---

## Error Handling

| Condition | Response |
|---|---|
| Gallery slug not found | `404` from API → frontend redirects to `/` |
| Contact form rate limit exceeded | `429` — "Too many requests. Please try again later." |
| Photo upload exceeds 10MB | `413` — "File too large. Maximum size is 10MB." |
| Invalid file type (not image) | `422` — "Only image files are accepted." |
| Multi-file upload: any file fails validation | `422` — all files rejected, none uploaded |
| Photo upload to non-existent category | `404 "Category not found."` (FK violation) |
| Delete last hero photo | `409` — "At least one hero photo is required." |
| Upload when hero photos = 20 | `409` — "Maximum of 20 hero photos reached." |
| Delete category with photos | `409` — "Remove all photos from this category first." |
| Reorder with incomplete position set | `422` — "Position array must cover all existing items." |
| Slug conflict on category create | `409` — "A category with this slug already exists." |
| Gallery photo delete failure (Storage error) | DB row deleted; Storage error logged; admin UI shows success (Storage orphan logged for manual cleanup) |
| Cover photo replacement — Storage upload fails | `503` — "Failed to replace cover photo. Please try again." Operation aborted; old cover unchanged. |
| Multi-file upload — Storage upload fails mid-sequence | `503` — "Upload failed. Please try again." DB rows and Storage objects for that request are rolled back (best-effort). |
| Contact email send failure | Logged server-side; submission still saved to DB; `201` returned to client |

---

## Testing Strategy

- **Unit tests (backend):** Slug auto-generation (special characters, accents, duplicates, truncation to 80 chars), photo upload pipeline (Pillow resize, WebP conversion), rate limiting logic, reorder validation (incomplete set rejection), Storage path parsing for deletion (cover_url and image_url round-trip), API-layer slug immutability (PATCH ignores slug field)
- **Integration tests (backend):** All public portfolio endpoints (no auth required, correct data shape), all admin portfolio endpoints (auth + role check), contact form (DB write + email send mock), multi-file upload all-or-nothing behaviour
- **Component tests:** HeroCarousel (auto-advance timer, pause on hover, prev/next), Lightbox (keyboard navigation, ESC close, swipe mock), CategoryGrid (responsive columns, empty state)
- **E2E (future):** Full visitor flow — landing → category → lightbox; contact form submit → success state

---

## Out of Scope (This Iteration)

- Video support in portfolio (photos only)
- Password-protected galleries
- Client-shareable private gallery links
- Photo captions or alt text
- Download button for photos
- SEO meta tags / Open Graph
- Analytics (page views, popular categories)
- Multiple photographers / multi-user portfolio
- Contact submission reply or delete from admin
- Slug editing after category creation (delete and recreate to change)
