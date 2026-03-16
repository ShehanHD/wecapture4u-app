# weCapture4U — Client Portal Design

## Overview

The client portal is the private dashboard used by photography clients to track their job progress, access delivered photos, and submit booking requests. It is a separate sub-project from the admin module, sharing the same FastAPI backend, PostgreSQL database, and JWT auth system.

- **Mobile-first** — base styles target mobile (`< 768px`); tablet and desktop via `min-width` breakpoints. Intentionally differs from the admin module which is desktop-first.
- **Visual theme** — Dark base (`#0c0c0c`) with Amber-tinted cards and borders (elevated variant of the admin theme)
- **Role:** `client` (enforced by FastAPI authorization on all endpoints)

---

## Tech Stack

Same as admin module:

| Layer | Technology |
|---|---|
| Frontend Framework | React 18 + TypeScript (Vite) — same project as admin |
| Routing | React Router v6 |
| Backend API | FastAPI (Python) — shared with admin |
| Database | Supabase (PostgreSQL + Storage) |
| File Storage | Supabase Storage (avatar bucket) — accessed via `supabase-py` from FastAPI |
| Image Processing | Pillow — resize to 256×256, convert to WebP, compress before upload |
| Auth | JWT Bearer tokens — issued by FastAPI, stored in `localStorage`, sent as `Authorization: Bearer` header |
| Email | Resend (called directly from FastAPI) |
| Data Validation (backend) | Pydantic v2 |
| UI Components | shadcn/ui + Tailwind CSS |
| Validation (frontend) | Zod |
| Forms | react-hook-form |
| Data Fetching | React Query (TanStack Query) — calls FastAPI endpoints |
| Biometric Auth | `@simplewebauthn/browser` (frontend) + `py_webauthn` (backend) |

---

## Architecture

### Route Structure

```
src/
  routes/
    index.tsx           ← React Router root (shared with admin)
  pages/
    auth/
      ClientLogin.tsx         ← Client login page (/client/login)
      ForgotPassword.tsx      ← Request password reset (/client/forgot-password)
      ResetPassword.tsx       ← Set new password (/client/reset-password?token=...)
      BiometricSetup.tsx      ← Post-login prompt to register device biometric (/client/biometric/setup)
    client/
      Dashboard.tsx     ← /client
      JobList.tsx       ← /client/jobs
      JobDetail.tsx     ← /client/jobs/:id
      Bookings.tsx      ← /client/bookings
      NewBooking.tsx    ← /client/bookings/new
      Profile.tsx       ← /client/profile
  components/
    layout/
      ClientShell.tsx   ← Top bar + bottom nav + outlet wrapper
    auth/
      ClientRoute.tsx   ← Protected route guard (role: client)
```

### Auth Strategy

- Same FastAPI JWT system used by admin — same `POST /api/auth/login` endpoint, role determined from `users.role`
- Client accounts are created by the admin (not self-registration). When the admin creates a client with portal access, both the `users` row and `clients` row are created atomically; the client receives an email with their login credentials.
- Login returns `access_token` (JWT, 15 min expiry) + `refresh_token` (opaque, 7 days). Both stored in `localStorage`.
- Access token sent as `Authorization: Bearer <token>` via the shared Axios interceptor. On 401, interceptor calls `POST /api/auth/refresh` automatically → retries the request. If refresh fails, clears tokens and redirects to `/client/login`.
- `<ClientRoute>` component wraps all `/client/*` routes — reads token from `localStorage`, decodes role, redirects to `/client/login` if missing or role !== `client`
- All FastAPI client endpoints check `role == 'client'` via `get_current_user()` dependency
- Clients can only read their own data — enforced in FastAPI by filtering all queries by `client_id` derived from the authenticated user (`users` → `clients` via `clients.user_id = current_user.id`)
- Deactivated accounts (`users.is_active = false`) receive `403` at login — "Your account has been deactivated. Contact your photographer."

### Password Reset Flow

Same flow as admin — shared endpoints:
1. "Forgot password?" link on `/client/login` → `/client/forgot-password` page → enter email → `POST /api/auth/forgot-password`
2. FastAPI sends reset email with link to `/client/reset-password?token=...`
3. Client sets new password → `POST /api/auth/reset-password` → redirected to `/client/login`

### Biometric Authentication (WebAuthn / FIDO2)

Biometric login is an **optional second login method** layered on top of the existing JWT flow. It uses the W3C WebAuthn standard — the device biometric (Face ID, Touch ID, fingerprint) never leaves the device. The server only stores a public key.

**How it works:**

1. **Registration** — client logs in with username/password → prompted: *"Enable Face ID / fingerprint for faster login?"* → browser calls `navigator.credentials.create()` → device generates a key pair in its secure enclave → public key + credential ID sent to server → stored in `webauthn_credentials` table
2. **Login** — client enters email on login page → "Use biometric" button appears if a credential exists for that device → server sends a random challenge → `navigator.credentials.get()` → device signs challenge using biometric → signature sent to server → FastAPI verifies with stored public key → JWT issued

**Frontend flow:**

- `@simplewebauthn/browser` package wraps the browser WebAuthn API
- On login page: after user types email, `GET /api/auth/webauthn/device-check?email=...` returns `has_credential: bool`. If true, a "Use Face ID / Fingerprint" button is shown alongside the standard password form
- After first successful password login: `BiometricSetup.tsx` page shown with "Enable biometric login" / "Skip" options
- Biometric setup state stored in `localStorage` as `biometric_setup_dismissed` to avoid re-prompting on every login after skip

**Backend endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/webauthn/device-check` | Returns whether a credential exists for email+device (no auth required) |
| `POST` | `/api/auth/webauthn/register/options` | Generates registration challenge (requires valid JWT) |
| `POST` | `/api/auth/webauthn/register/verify` | Verifies credential and stores public key (requires valid JWT) |
| `POST` | `/api/auth/webauthn/authenticate/options` | Generates login challenge for a given email (no auth required) |
| `POST` | `/api/auth/webauthn/authenticate/verify` | Verifies signature → returns JWT (no auth required) |
| `GET` | `/api/auth/webauthn/credentials` | List registered devices for the authenticated user (requires JWT) |
| `DELETE` | `/api/auth/webauthn/credentials/{credential_id}` | Remove a registered device (requires JWT — user can only delete their own credentials) |

**HTTPS requirement:** WebAuthn only works on HTTPS origins (plus `localhost` for development). The production deployment must be served over HTTPS.

---

## Data Model Changes

### `users` table (existing)

No changes. When the admin invites a client, a `users` row is created with `role = 'client'` and linked to `clients.user_id`.

### `webauthn_credentials` (shared)

Defined in the admin spec (`2026-03-14-admin-design.md`) — shared by both admin and client users. A client can register multiple devices (e.g. iPhone + iPad); each gets its own row. The client can view and remove registered devices from the Profile page.

### `clients` table (existing)

The `user_id` FK (nullable, → `users`) already defined in the admin spec is the join path used by all client portal authorization logic: `clients.user_id = auth_user.id`.

### `jobs` table — add column

| Column | Type | Notes |
|---|---|---|
| `delivery_url` | text | nullable — external gallery link (Google Drive, Dropbox, WeTransfer, etc.) added by admin when photos are ready. Validated as a URL at the application layer (Pydantic on backend, Zod on frontend). |

### New table: `booking_requests`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `client_id` | uuid (FK → clients) | |
| `preferred_date` | date | Client's preferred shoot date |
| `time_slot` | enum | `morning` / `afternoon` / `evening` / `all_day` — client preference; admin sets exact time when creating the appointment |
| `session_type_id` | uuid (FK → session_types) | Session type chosen by client — populated from admin-managed list |
| `addons` | text[] | Fixed validated list: `album`, `thank_you_card`, `enlarged_photos`. Empty array if none selected. |
| `message` | text | nullable — any notes from the client |
| `status` | enum | `pending` / `confirmed` / `rejected` |
| `admin_notes` | text | nullable — confirmation details or rejection reason from admin |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | updated on every status change — present here specifically to track the confirm/reject lifecycle; intentionally omitted from other tables where mutation history is not needed |

> On confirm: admin creates an appointment manually, pre-filled from request data (`preferred_date` → `starts_at`, `session_type` → `type`, `message` → `notes`). The `booking_requests` row stays as a permanent record. On reject: `status` → `rejected`, `admin_notes` stores the reason.

---

## UI Design

### Visual Style

- **Theme:** Dark mode only
- **Base:** Pure black (`#0c0c0c`) backgrounds
- **Cards:** Amber-tinted (`rgba(245,158,11,0.08)` background, `rgba(245,158,11,0.2)` border) for primary info cards; standard dark (`#1a1a1a`) for secondary cards
- **Primary:** Amber (`#f59e0b`) — CTAs, active states, current stage indicator
- **Accent:** Emerald (`#10b981`) — positive states (deposit paid, completed stages)
- **Typography:** White (`#fafafa`) primary, muted gray (`#9ca3af`) labels and secondary text

### Layout

- **Top bar:** Logo left, client avatar (or initials if no photo) right — tapping avatar navigates to `/client/profile`
- **Bottom navigation (mobile):** Home · My Jobs · Bookings · Profile
- **Desktop (`≥ 768px`):** Top nav with same links inline

---

## Pages & Features

### Dashboard (`/client`)

- **Active job card:** Most recent job where `job_stages.is_terminal = false` (ordered by `created_at` desc). Shows job title, current stage name + amber dot, visual progress bar across all non-terminal stages. If the client has more than one active job, a "You have X active jobs — see all" link is shown below the card.
- **Deposit status card:** Shows `appointments.deposit_paid` from the job's linked appointment. Hidden if the job has no linked appointment.
- **Next appointment:** Nearest future `appointments` row linked to the client — shows date, time slot, location (if set).
- **Book a New Session CTA:** Amber button → `/client/bookings/new`

### My Jobs (`/client/jobs`)

- List of all jobs linked to the authenticated client, ordered by `created_at` descending
- Each row: job title, session type, current stage badge, delivery link indicator
- No pagination for now (load all); revisit if list grows large
- Tap → Job Detail

### Job Detail (`/client/jobs/[id]`)

- **Progress timeline:** Vertical list of all `job_stages` ordered by `position`. Completed stages (position < current stage's position) → emerald checkmark. Current stage → amber dot. Future stages → dimmed. Terminal stages shown but clearly labeled. Note: completion is position-based (not history-based) — if an admin skips a stage, intermediate stages still show as completed. This is intentional (simplest approach; stage history log is out of scope).
- **Gallery section:**
  - If `delivery_url` is set: "View Your Photos →" button linking to the external URL (opens in new tab)
  - If empty: "Your photos will appear here once delivered" placeholder
- **Deposit status:** Pulled from linked appointment's `deposit_paid`. Hidden if no appointment linked.

### Bookings (`/client/bookings`)

- List of all booking requests for the authenticated client, ordered by `created_at` descending
- Each row: preferred date, time slot, session type, status badge (pending / confirmed / rejected)
- Pending requests show "Your request is being reviewed" — no admin notes visible yet
- Confirmed and rejected requests show `admin_notes` if present
- "New Booking" button → `/client/bookings/new`

### New Booking (`/client/bookings/new`)

- **Session type:** Dropdown populated from `GET /api/session-types` (admin-managed list)
- **Preferred date:** Date picker (future dates only)
- **Time slot:** 2×2 tap grid — Morning / Afternoon / Evening / All Day
- **Add-ons:** Multi-select — Album / Thank You Card / Enlarged Photos (all optional, none required)
- **Message:** Optional textarea
- **Submit:** "Send Request" → `POST /api/booking-requests` → creates row with `status: pending` → triggers admin in-app notification + client confirmation email

### Profile (`/client/profile`)

- **Avatar upload:** Circular photo preview (shows current avatar or initials placeholder). "Change photo" tap opens file picker (accepts image/*). On select:
  1. Frontend sends file to `POST /api/profile/avatar` (multipart)
  2. FastAPI receives file → Pillow resizes to 256×256 (centre-crop), converts to WebP, compresses
  3. FastAPI uploads to Supabase Storage at `avatars/{user_id}.webp` (overwrites previous — no orphan files)
  4. FastAPI updates `users.avatar_url` with the public URL
  5. Frontend invalidates React Query cache → avatar updates everywhere instantly
- **Personal info form:** Editable fields — full name, phone, address, birthday, notes. Submitted via `PATCH /api/profile`. Email and role are read-only (displayed but not editable).
- Validation: Zod on frontend, Pydantic on backend. All fields optional except full name.
- **Biometric devices section:** List of registered devices (credential `device_name` + `created_at`). Each row has a "Remove" button → `DELETE /api/auth/webauthn/credentials/{credential_id}` (requires JWT). An "Add this device" button triggers the registration flow for the current device if not already registered.

---

## Admin Additions

### Appointments page — new "Requests" tab

- Table of booking requests filtered by status. Default view: `pending`. Toggle to view `confirmed` / `rejected` history.
- Columns: client name, preferred date, time slot, session type, add-ons, message, submitted date
- **Confirm action:** Opens pre-filled create-appointment modal (`preferred_date` → `starts_at`, `session_type_id` carried over, `addons` carried over, `message` → `notes`, time slot shown as reference). On save: appointment created, `booking_requests.status` → `confirmed`, `admin_notes` optionally set, client email sent.
- **Reject action:** Modal with optional `admin_notes` field. On submit: `booking_requests.status` → `rejected`, client email sent.

### Job detail / edit form

- New `delivery_url` text field — admin pastes external gallery link when photos are ready
- Validated as URL format before saving
- When saved with a URL: client portal immediately shows the "View Your Photos →" button

### Work Stages settings

- `is_terminal` toggle per stage — admin can mark custom stages as terminal (excluded from client "active jobs" view)
- Default: Delivered and Archived are terminal; all others are not

---

## Client-Facing Emails

Triggered by FastAPI endpoint handlers on admin actions. All emails sent via Resend.

| Trigger | Recipient | Sent by | Content |
|---|---|---|---|
| Booking request submitted | Client | `POST /api/booking-requests` handler | Confirmation that request was received, summary of request details |
| Booking confirmed | Client | `PATCH /api/booking-requests/{id}` handler | Confirmation, preferred date, time slot, `admin_notes` if set, link to portal |
| Booking rejected | Client | `PATCH /api/booking-requests/{id}` handler | Rejection notice, `admin_notes` (reason) if set, invitation to submit a new request |
| Job stage updated | Client | `PATCH /api/jobs/{id}` handler (synchronous) | "Your [job title] has moved to [stage name]" + link to job detail in portal. If the new stage is terminal and `delivery_url` is set, the gallery link is included. |
| Gallery link added | Client | `PATCH /api/jobs/{id}` handler (synchronous) | Sent when `delivery_url` changes from null to a non-null value, regardless of current stage. Content: "Your photos are ready — view them here" + gallery link. Ensures clients receive the link even if the job was already in a terminal stage when the URL was added. |

---

## Error Handling

- All FastAPI responses validated with Zod schemas on the frontend at the API client layer
- All incoming request data validated with Pydantic v2 on the FastAPI side
- Failed mutations show toast notifications — raw API errors never exposed to UI
- Auth errors (401): Axios interceptor attempts token refresh automatically. If refresh fails, clears tokens and redirects to `/client/login`
- Deactivated account: `403` — "Your account has been deactivated. Contact your photographer."
- Expired/used password reset token: `422` — "This reset link is invalid or has expired. Request a new one."
- Email send failures do not crash the app — logged server-side, graceful degradation
- Form validation client-side (Zod + react-hook-form) before any API call
- Clients cannot access jobs or data belonging to other clients — FastAPI filters all queries by authenticated `client_id`; attempts to access another client's resource return 403

---

## Testing Strategy

- **Unit tests (backend):** Pydantic schema validation, booking request business logic
- **Unit tests (frontend):** Zod schema validation, data transformation helpers
- **Integration tests (backend):** FastAPI client endpoints via `pytest` + `httpx` against test DB. Authorization tested from both client and admin roles — client must not be able to access other clients' data or admin endpoints. WebAuthn registration and authentication flows tested with `py_webauthn`'s test helpers (simulated authenticator).
- **Component tests:** Key UI components with React Testing Library
- **E2E tests (future):** Booking request flow, job progress view, gallery link display

---

## Out of Scope (This Iteration)

- Image upload pipeline (AWS S3) — job gallery is external link only; avatar upload via Supabase Storage is in scope
- Client cancelling a confirmed appointment (must contact admin directly)
- In-app notifications for clients (email only, no in-app bell)
- Payment / invoice management beyond deposit status
- Client-to-admin messaging / chat
- Multiple simultaneous active jobs on dashboard (most recent active shown; full list in My Jobs)
