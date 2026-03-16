# weCapture4U — Admin Module Design

## Overview

weCapture4U is a photography business management application. This spec covers the **Admin module** — the private dashboard used by the photographer (owner) to manage all aspects of the business: appointments, jobs, clients, and accounting.

The client portal (progress tracking, history, gallery) is a separate sub-project covered in its own spec. The image pipeline (AWS S3 upload/delivery) and subscriptions are out of scope for now. The frontend is a single React 18 + TypeScript (Vite) SPA serving both the admin and client portal at different routes.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 18 + TypeScript (Vite) |
| Routing | React Router v6 |
| Backend API | FastAPI (Python) |
| Database | Supabase (PostgreSQL + Storage — no Auth, no RLS, no Edge Functions) |
| ORM / DB Access | SQLAlchemy (async) + asyncpg |
| File Storage | Supabase Storage (avatar bucket) — accessed via `supabase-py` from FastAPI |
| Image Processing | Pillow — resize to 256×256, convert to WebP, compress before upload |
| Auth | JWT Bearer tokens — issued by FastAPI, stored in `localStorage`, sent as `Authorization: Bearer` header |
| Scheduled Jobs | APScheduler (runs within FastAPI process) |
| Email | Resend (called directly from FastAPI) |
| Data Validation (backend) | Pydantic v2 |
| UI Components | shadcn/ui + Tailwind CSS |
| Calendar | react-big-calendar |
| Drag-and-Drop | @dnd-kit/core |
| Charts | Recharts |
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
    index.tsx         ← React Router root: public + protected route tree
  pages/
    auth/
      AdminLogin.tsx        ← Admin login page (/login)
      ForgotPassword.tsx    ← Request password reset (/forgot-password)
      ResetPassword.tsx     ← Set new password (/reset-password?token=...)
      BiometricSetup.tsx    ← Post-login prompt to register device biometric (/admin/biometric/setup)
    admin/
      Dashboard.tsx         ← /admin
      Appointments.tsx      ← /admin/appointments
      Jobs.tsx              ← /admin/jobs
      JobDetail.tsx         ← /admin/jobs/:id
      Clients.tsx           ← /admin/clients
      ClientDetail.tsx      ← /admin/clients/:id
      Accounting.tsx        ← /admin/accounting
      Notifications.tsx     ← /admin/notifications
      Settings.tsx          ← /admin/settings
      Profile.tsx           ← /admin/profile
  components/
    layout/
      AdminShell.tsx        ← Top nav + outlet wrapper
    auth/
      AdminRoute.tsx        ← Protected route guard (role: admin)
```

### Auth Strategy

- FastAPI owns all authentication — no Supabase Auth, no RLS
- User credentials stored in a `users` table (`role: 'admin' | 'client'`, `hashed_password` via bcrypt)
- Login flow: `POST /api/auth/login` → FastAPI verifies credentials → generates opaque refresh token → stores SHA-256 hash in `refresh_tokens` table → returns `access_token` (JWT, 15 min expiry) + `refresh_token` (raw opaque token, expiry is role-dependent: **8 hours for admin, 24 hours for client**). Both stored in `localStorage`.
- Access token sent as `Authorization: Bearer <token>` on every API request via Axios interceptor
- When a request returns `401`, the Axios interceptor automatically calls `POST /api/auth/refresh` with the refresh token → FastAPI validates hash (not expired, not revoked) → rotates token (revokes old row, inserts new row) → returns new access token + new refresh token → retries the original request. If refresh fails (expired/revoked/invalid), clears both tokens and redirects to `/login`.
- **Logout:** `POST /api/auth/logout` (requires valid access token) → revokes current refresh token row → clears both tokens from `localStorage` on the client.
- All protected FastAPI endpoints require the Bearer token; `get_current_user()` dependency validates it and checks role
- `<AdminRoute>` component wraps all `/admin/*` routes — reads token from `localStorage`, decodes role, redirects to `/login` if missing or role !== `admin`
- Deactivated accounts (`users.is_active = false`) are rejected at login with `403` and the message "Your account has been deactivated. Contact support." On deactivation, all active `refresh_tokens` rows for that user are immediately revoked — existing sessions cannot obtain new access tokens.

### Password Reset Flow

1. Admin clicks "Forgot password?" on `/login` → enters email → `POST /api/auth/forgot-password`
2. FastAPI looks up the user by email → generates a secure random token → stores a hashed version in `password_reset_tokens` (expires in 1 hour) → sends a reset email via Resend. The reset URL is role-aware: `role = admin` → `/reset-password?token=...`; `role = client` → `/client/reset-password?token=...`. If no user exists for the email, the endpoint still returns `200` (prevent user enumeration) and no email is sent.
3. Admin clicks the link → `GET /reset-password?token=...` renders the reset form
4. Admin submits new password → `POST /api/auth/reset-password` → FastAPI validates token (not expired, not used), hashes new password, updates `users.hashed_password`, marks token as used
5. Admin redirected to `/login` with success message

### Biometric Authentication (WebAuthn / FIDO2)

Same WebAuthn implementation as the client portal — the `webauthn_credentials` table and all WebAuthn endpoints are shared between admin and client accounts. Role is determined from the JWT issued after successful biometric verification, so the same auth flow serves both roles without duplication.

**Admin-specific flow:**
1. Admin logs in with password on the first visit
2. Prompted on `/admin/biometric/setup`: *"Enable biometric login for this device?"*
3. Future logins: enter email → "Use Face ID / Fingerprint" button appears → biometric scan → JWT issued with `role: admin` → redirected to `/admin`
4. Registered devices are managed from the admin profile (top-nav avatar → Profile)

**HTTPS requirement:** WebAuthn only works on HTTPS origins (plus `localhost` during development). Production deployment must be served over HTTPS.

### Email Notifications — Scheduling

Scheduled notifications are triggered by **APScheduler** running inside the FastAPI process. A daily job runs at **08:00 UTC** and:
1. Queries for appointments starting within 24h → inserts notification rows + sends email via Resend
2. Queries for clients with birthday matching today → same flow
3. Queries for invoices past due date → same flow

FastAPI calls Resend directly (no Edge Functions). APScheduler handles scheduling within the same process. Missed runs (e.g., due to server downtime) are not recovered — accepted behavior for this iteration.

---

## Data Model

### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| email | text | UNIQUE |
| hashed_password | text | bcrypt via passlib |
| role | enum ('admin', 'client') | |
| full_name | text | |
| avatar_url | text | nullable — public URL of the optimized profile photo in Supabase Storage (`avatars/{user_id}.webp`). New upload overwrites the same path. |
| is_active | boolean | default true. Inactive users are rejected at login with 403. |
| created_at | timestamptz | |

> Managed entirely by FastAPI. No Supabase Auth involved. The `notifications` table references this table via `user_id`.

### `refresh_tokens`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid (FK → users) | |
| token_hash | text | UNIQUE — SHA-256 of raw token. Raw token never stored. |
| expires_at | timestamptz | Role-dependent: 8 hours for admin, 24 hours for client. Set at login time based on `users.role`. |
| revoked_at | timestamptz | nullable — set on logout or when the user's account is deactivated |
| created_at | timestamptz | |

> **Rotation:** On every `POST /api/auth/refresh` call — validate hash (not expired, not revoked) → set `revoked_at = now()` on the current row → issue a new access token + new refresh token → insert a new `refresh_tokens` row. If a stolen token is replayed after rotation, the legitimate user's next refresh fails (old token already revoked), surfacing the theft.

> **Deactivation:** When `users.is_active` is set to `false`, all active `refresh_tokens` rows for that user are immediately revoked (`revoked_at = now()`). This prevents deactivated accounts from silently obtaining new access tokens for up to 7 days after deactivation.

> **Logout:** Revokes the current refresh token row (`revoked_at = now()`). The short-lived access token (15 min) expires on its own — no access token blocklist needed.

### `password_reset_tokens`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid (FK → users) | |
| token_hash | text | UNIQUE — SHA-256 hash of the raw token sent by email. Raw token never stored. |
| expires_at | timestamptz | 1 hour from creation |
| used_at | timestamptz | nullable — set when the token is consumed. Used tokens are rejected even if not expired. |
| created_at | timestamptz | |

### `webauthn_credentials`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid (FK → users) | One user can register multiple devices |
| credential_id | text | UNIQUE — opaque identifier generated by the device |
| public_key | bytea | COSE-encoded public key stored at registration |
| sign_count | integer | Monotonically increasing counter — used to detect cloned authenticators |
| device_name | text | nullable — parsed from browser user-agent (e.g. "MacBook Pro · Chrome") for display |
| created_at | timestamptz | |

> Shared by both admin and client users. Role is determined from the JWT issued after verification — no role field needed here.

### `clients`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid (FK → users) | nullable — set when client is invited and creates a portal account |
| name | text | |
| email | text | UNIQUE |
| phone | text | nullable |
| address | text | nullable |
| tags | text[] | e.g. ['wedding', 'corporate'] |
| birthday | date | nullable |
| notes | text | nullable |
| created_at | timestamptz | |

### `session_types`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | UNIQUE — e.g. "Wedding", "Portrait", "Corporate Event" |
| created_at | timestamptz | |

> Admin-managed in Settings → Session Types tab. Deletion blocked if any appointments or booking requests reference the type. No default seed — admin creates their own list before use.

### `appointments`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| client_id | uuid (FK → clients) | |
| session_type_id | uuid (FK → session_types) | nullable — admin can leave untyped |
| title | text | |
| starts_at | timestamptz | Single field replaces separate date + time; timezone-aware |
| ends_at | timestamptz | nullable — required for calendar block rendering; defaults to starts_at + 1 hour in UI when null |
| location | text | nullable |
| status | enum | pending / confirmed / cancelled |
| addons | text[] | Fixed validated list: `album`, `thank_you_card`, `enlarged_photos`. Carried over from booking request on confirm. Empty array by default. |
| deposit_paid | boolean | default false |
| deposit_amount | numeric(10,2) | default 0 — amount received/expected as deposit. Used by accounting module for the deposit journal entry. |
| deposit_account_id | uuid (FK → accounts) | nullable — bank/cash account that received the deposit. Defaults to Business Bank Account when null. Set alongside the deposit_paid toggle. |
| contract_signed | boolean | default false |
| notes | text | nullable |
| created_at | timestamptz | |

> **Note on recurrence:** Recurring appointments are out of scope for this iteration (YAGNI — low real-world frequency for a solo photographer). This can be added in a future iteration with a proper materialization strategy.

### `job_stages`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | e.g. "Booked", "Shooting" |
| color | text | Hex color for Kanban column header, e.g. `#f59e0b` |
| position | integer | Display order; lower = leftmost column |
| is_terminal | boolean | default false — terminal stages are excluded from "active jobs" in the client portal. Seeded: Delivered and Archived have `is_terminal = true` |
| created_at | timestamptz | |

> Default stages seeded on first run: Booked (position 1), Shooting (2), Editing (3), Delivered (4, terminal), Archived (5, terminal). Deletion is blocked if any jobs are assigned to the stage — admin must reassign jobs first.

### `jobs`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| client_id | uuid (FK → clients) | |
| appointment_id | uuid (FK → appointments) | nullable |
| title | text | |
| stage_id | uuid (FK → job_stages) | replaces former `status` enum; references current stage |
| shoot_date | date | nullable |
| delivery_deadline | date | nullable |
| notes | text | nullable |
| created_at | timestamptz | |

### `invoices`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| job_id | uuid (FK → jobs) | nullable |
| client_id | uuid (FK → clients) | |
| status | enum | draft / sent / partially_paid / paid |
| subtotal | numeric(10,2) | Sum of all `invoice_items.amount` for this invoice. Stored for query performance; recalculated and persisted on every `invoice_item` create/update/delete. Application is sole authority for keeping it consistent. |
| discount | numeric(10,2) | default 0 |
| tax | numeric(10,2) | default 0; optional — not displayed or applied until the admin enables tax in settings (for users without Partita IVA) |
| total | numeric(10,2) | Application-layer computed: subtotal - discount + tax. Recalculated and persisted whenever `subtotal`, `discount`, or `tax` changes. Application is sole authority for keeping it consistent. |
| deposit_amount | numeric(10,2) | default 0 — display-only reference for the initial deposit. No longer drives balance calculations. |
| balance_due | numeric(10,2) | Computed as `total − SUM(invoice_payments.amount)`. Recalculated on every payment record/delete. |
| requires_review | boolean | default false — set when a posted payment journal entry is voided. Cleared on new payment post or manual dismiss. |
| due_date | date | nullable |
| sent_at | timestamptz | nullable |
| paid_at | timestamptz | nullable |
| created_at | timestamptz | |

> **Invoice → Payment flow:** Marking an invoice as `paid` is done by recording a payment via the accounting module (`invoice_payments` table). This triggers an auto-draft journal entry (Dr Bank · Cr AR) for admin review. See the accounting spec for the full payment recording flow.

### `invoice_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| invoice_id | uuid (FK → invoices) | |
| revenue_account_id | uuid (FK → accounts) | nullable — revenue account to credit on invoice-sent journal entry. Defaults to Session Fees (4000) when null. |
| description | text | e.g. "Session fee", "Print package" |
| quantity | numeric(10,2) | default 1 |
| unit_price | numeric(10,2) | |
| amount | numeric(10,2) | Application-layer computed: quantity × unit_price. Stored for query performance; recalculated and persisted on every `invoice_item` create/update/delete. Application is sole authority for keeping it consistent. |

> The `transactions` table has been removed and replaced by the double-entry accounting module. See `2026-03-14-accounting-design.md` for the full data model: `accounts`, `journal_entries`, `journal_lines`, `invoice_payments`, and `expenses`.

### `app_settings`
| Column | Type | Notes |
|---|---|---|
| id | integer | PK, always 1 — single-row config table |
| tax_enabled | boolean | default false |
| tax_rate | numeric(5,2) | default 0; percentage applied to invoice totals when tax is enabled |
| pdf_invoices_enabled | boolean | default false; when enabled, invoices can be exported as PDF from the invoice detail view |
| updated_at | timestamptz | |

> Single-row table (id = 1, always). Seeded on first run. Never deleted.

### `notifications`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid (FK → users) | |
| type | text | appointment_reminder, birthday, invoice_overdue, etc. |
| title | text | |
| body | text | |
| read | boolean | default false |
| sent_email | boolean | default false |
| created_at | timestamptz | |

---

## UI Design

### Visual Style
- **Theme:** Dark mode only
- **Base:** Pure black (`#0c0c0c`) backgrounds, dark cards (`#1a1a1a`)
- **Primary:** Amber (`#f59e0b`) — buttons, active states, primary charts
- **Accent:** Emerald (`#10b981`) — positive metrics, success states
- **Accent 2:** Orange (`#f97316`) — warnings, secondary highlights
- **Typography:** White (`#fafafa`) primary text, muted gray secondary

### Responsive Strategy — Desktop First
- Designed for desktop (primary use case). Responsive breakpoints added to ensure usability on tablet and mobile, but layout decisions are optimized for larger screens first.
- Complex views (Kanban, calendar, accounting tabs) prioritize desktop UX; mobile gets a usable but simplified fallback.

### Layout — Top Navigation + Split Dashboard
- **Top nav:** Logo left, nav links center (Dashboard, Appointments, Jobs, Clients, Accounting, Settings), notification bell + profile avatar right
- **Notifications** are accessible only via the bell icon in the top nav — not a top-level nav link. The bell renders a `<Popover>` dropdown (latest 5, "View all" link) inline in the nav. "View all" navigates to `/admin/notifications` — a full-page history view. The dropdown and the full page share the same data source (the `notifications` table) but are separate components.
- **Dashboard split:** Revenue chart (large, left) + stat cards stacked (right)

---

## Pages & Features

### Dashboard (`/admin`)
- Revenue chart: monthly bars, filterable by year
- Upcoming appointments: next 5, with client name, date, status badge
- Stat cards: revenue this month, active jobs, total clients, unpaid invoices total
- Job status donut chart: breakdown by status

### Appointments (`/admin/appointments`)
- Calendar view (monthly/weekly toggle via `react-big-calendar`) + list view toggle
- Create/edit modal: all fields (client, title, session type, starts_at, ends_at, location, status, add-ons, deposit paid, contract signed, notes)
- Status badges with color coding
- Quick filters: by status, by type, by date range
- Appointment reminders: in-app notification + email 24h before (triggered by APScheduler daily job)

### Jobs (`/admin/jobs`)
- Kanban board: one column per `job_stage`, ordered by `position`; column header color matches `job_stages.color`
- Drag-and-drop cards between columns to update `stage_id` (powered by @dnd-kit/core)
- Job detail page: linked appointment summary, client info, timeline, notes, linked invoice
- Create job from appointment (one click) or standalone

### Clients (`/admin/clients`)
- Searchable, filterable table: by tag, name
- Client detail page: contact info, tags, job history list, total spent (sum of posted journal lines on revenue accounts where the originating invoice's `client_id = X`), birthday, notes
- Inline tag management
- **Portal account creation:** The create-client form includes a "Portal Access" section with a temporary password field. On submit, FastAPI creates both the `users` row (`role = 'client'`) and the `clients` row atomically in one transaction, linking `clients.user_id` immediately. The client receives a "your account is ready" email with their login credentials. `clients.user_id` is never null for clients created this way; for clients imported or created before this feature existed, it remains nullable until the admin creates their account manually.
- **Account deactivation:** Client detail page has an "Deactivate portal access" toggle (shown only when `clients.user_id` is set). Toggling sets `users.is_active = false` — the client is immediately blocked from logging in (403). Their data is fully preserved. Admin can reactivate at any time. A confirmation dialog is shown before deactivating.

### Accounting (`/admin/accounting`)

Full double-entry accounting system. See `2026-03-14-accounting-design.md` for the complete UI spec. Summary of tabs:

- **Overview tab:** Key metrics (revenue, expenses, net profit, cash position, AR, loan balance) + revenue vs expenses chart + draft entries alert banner
- **Journal tab:** All journal entries (posted / draft / voided) with inline line expansion, manual entry creation, and void action
- **Accounts tab:** Chart of accounts with add/rename/archive and per-account ledger drill-down
- **Invoices tab:** Invoice list with payment recording, requires_review badge, PDF export
- **Expenses tab:** Expense log with paid/payable status, receipt upload, mark-as-paid action
- **Reports tab:** P&L, Balance Sheet, Trial Balance, Cash Flow, Tax Summary, AR Aging — all with CSV export. Tax Summary hidden when tax is disabled.

### Profile (`/admin/profile`)

Accessible via the top-nav avatar dropdown. Admin's own account management.

- **Avatar upload:** Same flow as client portal — Pillow resizes to 256×256 WebP → Supabase Storage → `users.avatar_url` updated → top-nav avatar refreshes immediately
- **Edit info:** Full name (required), email (requires current password confirmation to change)
- **Change password:** Current password + new password + confirm new password. Validated server-side — current password must match before update is accepted.
- **Biometric devices:** List of registered devices (device name + registration date) with "Remove" per device and "Add this device" button
- Email and role are read-only (displayed but not editable)

### Settings (`/admin/settings`)
- **Work Stages tab:** List of all `job_stages` ordered by `position`. Add new stage (name + color picker). Rename and recolor existing stages inline. Toggle `is_terminal` per stage — terminal stages are excluded from "active jobs" in the client portal (Delivered and Archived are terminal by default). Drag-and-drop to reorder. Delete — blocked with an error if any jobs are assigned to the stage ("X jobs are in this stage, reassign them first").
- **Session Types tab:** List of all `session_types`. Add new type (name only). Rename inline. Delete — blocked if any appointments or booking requests reference the type.
- **Tax tab:** Toggle to enable/disable tax on invoices. When disabled, the tax field is hidden on invoice forms and the tax line is omitted from invoice totals and the Reports tax summary. When enabled, a default tax rate (%) can be set and pre-filled on new invoices.
- **PDF Invoices tab:** Toggle to enable/disable PDF invoice export. When disabled, no PDF option is shown. When enabled, a "Download PDF" button appears on the invoice detail view, generating a formatted PDF of the invoice.
- **Profile / Security:** Accessible via the top-nav avatar. Shows registered biometric devices (device name + registration date) with a "Remove" button per device, and an "Add this device" button to register the current device if not yet enrolled.

### Notifications (`/admin/notifications`)
- Bell icon in top nav with unread count badge
- Dropdown: preview of latest 5 notifications, "View all" link
- Full notifications page (`/admin/notifications`): all history, mark as read, filter by type
- Auto-generated via APScheduler (daily at 08:00 UTC): appointment reminders (24h before `starts_at`), birthday alerts (day-of), invoice overdue (1 day after `due_date`)
- Event-driven notifications (created synchronously by FastAPI endpoint handlers, not APScheduler): `booking_request_received` — inserted when a client submits a booking request via `POST /api/booking-requests`
- Client-facing emails also sent synchronously by endpoint handlers: job stage update email on `PATCH /api/jobs/{id}` (stage change); "photos ready" email on `PATCH /api/jobs/{id}` (when `delivery_url` changes from null to non-null). See client portal spec for full email trigger table.

---

## FastAPI Endpoints

### Appointments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/appointments` | JWT (admin) | List appointments. Query params: `status`, `session_type_id`, `start_date`, `end_date`. |
| `POST` | `/api/appointments` | JWT (admin) | Create appointment. If `deposit_paid: true` + `deposit_amount > 0`: triggers deposit journal entry preview (slide-over panel). |
| `GET` | `/api/appointments/{id}` | JWT (admin) | Single appointment. |
| `PATCH` | `/api/appointments/{id}` | JWT (admin) | Update any field. If `deposit_paid` changes to `true` + `deposit_amount > 0`: triggers deposit auto-draft preview. If `deposit_paid` changes back to `false` on an appointment with a non-voided deposit entry: that entry is automatically voided. |
| `DELETE` | `/api/appointments/{id}` | JWT (admin) | Delete appointment. Blocked with `409` if a job is linked to it. |
| `GET` | `/api/booking-requests` | JWT (admin) | List booking requests. Query params: `status` (default `pending`). |
| `PATCH` | `/api/booking-requests/{id}` | JWT (admin) | Confirm (`status → confirmed`, optional `admin_notes`, triggers client email) or reject (`status → rejected`, optional `admin_notes`, triggers client email). |

### Notifications

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/notifications` | JWT (admin) | List notifications. Query params: `unread` (bool), `type`, `limit` (used with `limit=5` for bell dropdown). Ordered by `created_at` desc. |
| `PATCH` | `/api/notifications/{id}/read` | JWT (admin) | Mark single notification as read. |
| `POST` | `/api/notifications/read-all` | JWT (admin) | Mark all notifications as read. |

### Settings

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/settings` | JWT (admin) | Get current `app_settings` row (`tax_enabled`, `tax_rate`, `pdf_invoices_enabled`). |
| `PATCH` | `/api/settings` | JWT (admin) | Update `tax_enabled`, `tax_rate`, `pdf_invoices_enabled`. |
| `GET` | `/api/session-types` | None | List all session types. Used by both admin and client portal (booking form). |
| `POST` | `/api/session-types` | JWT (admin) | Create session type. |
| `PATCH` | `/api/session-types/{id}` | JWT (admin) | Rename session type. |
| `DELETE` | `/api/session-types/{id}` | JWT (admin) | Delete. Blocked with `409` if referenced by any appointment or booking request. |

### Invoices

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/invoices` | JWT (admin) | List invoices. Query params: `status`, `client_id`, `job_id`. |
| `POST` | `/api/invoices` | JWT (admin) | Create invoice (draft). If linked appointment has a posted deposit entry: triggers deposit-conversion auto-draft preview (Dr Deferred Revenue · Cr AR). |
| `GET` | `/api/invoices/{id}` | JWT (admin) | Single invoice with all items and payment list. |
| `PATCH` | `/api/invoices/{id}` | JWT (admin) | Update status, discount, tax, due_date, deposit_amount. Status → `sent`: triggers invoice-sent auto-draft preview. Status back to `draft` on a previously `sent` invoice: voids the existing non-voided entry and opens a fresh draft. |
| `DELETE` | `/api/invoices/{id}` | JWT (admin) | Delete invoice. Blocked with `409` if status is not `draft`. |
| `POST` | `/api/invoices/{id}/items` | JWT (admin) | Add invoice item. Recalculates and persists `subtotal`, `total`, and `balance_due`. |
| `PATCH` | `/api/invoices/{id}/items/{item_id}` | JWT (admin) | Update item. Recalculates and persists `subtotal`, `total`, and `balance_due`. |
| `DELETE` | `/api/invoices/{id}/items/{item_id}` | JWT (admin) | Delete item. Recalculates and persists `subtotal`, `total`, and `balance_due`. |

### Jobs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/jobs` | JWT (admin) | List all jobs. Query params: `stage_id`, `client_id`. |
| `POST` | `/api/jobs` | JWT (admin) | Create job (standalone or from appointment via `appointment_id`). |
| `GET` | `/api/jobs/{id}` | JWT (admin) | Single job with linked appointment summary, client info, and linked invoice. |
| `PATCH` | `/api/jobs/{id}` | JWT (admin) | Update any field. Stage change → sends client email if client has portal account. `delivery_url` set from null to non-null → sends "photos ready" email to client. |
| `DELETE` | `/api/jobs/{id}` | JWT (admin) | Delete job. Blocked with `409` if an invoice is linked to it. |
| `GET` | `/api/job-stages` | JWT (admin) | List all stages ordered by `position`. |
| `POST` | `/api/job-stages` | JWT (admin) | Create new stage (name, color, `is_terminal`). |
| `PATCH` | `/api/job-stages/{id}` | JWT (admin) | Update name, color, `is_terminal`. |
| `PATCH` | `/api/job-stages/positions` | JWT (admin) | Reorder stages. Same ID-set equality validation as portfolio reorder. |
| `DELETE` | `/api/job-stages/{id}` | JWT (admin) | Delete stage. Blocked with `409` if any jobs are assigned to it — returns count: "X jobs are in this stage, reassign them first." |

### Clients

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/clients` | JWT (admin) | List all clients. Query params: `search` (name/email), `tag`. |
| `POST` | `/api/clients` | JWT (admin) | Create client. If `portal_access: true` + `temp_password` provided: creates `users` row + `clients` row atomically, sends credentials email. |
| `GET` | `/api/clients/{id}` | JWT (admin) | Single client with job history list, total spent (sum of posted journal lines on revenue accounts for this client), tags. |
| `PATCH` | `/api/clients/{id}` | JWT (admin) | Update contact info, tags, birthday, notes. |
| `DELETE` | `/api/clients/{id}` | JWT (admin) | Delete client. Blocked with `409` if client has any jobs or invoices. |
| `POST` | `/api/clients/{id}/portal-access` | JWT (admin) | Create portal account for an existing client who has none. Creates `users` row, links `clients.user_id`, sends credentials email. Returns `409` if `clients.user_id` already set. |
| `PATCH` | `/api/clients/{id}/portal-access` | JWT (admin) | Toggle `users.is_active` (activate / deactivate portal access). On deactivate: revokes all active `refresh_tokens` rows for that user. Returns `200`. |

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | None | Credentials → access token + refresh token. Returns `403` if account deactivated. |
| `POST` | `/api/auth/refresh` | None | Validate refresh token hash (not expired, not revoked) → revoke old row → insert new row → return new access token + new refresh token. Returns `401` if token invalid/expired/revoked. |
| `POST` | `/api/auth/logout` | JWT | Revoke current refresh token row (`revoked_at = now()`). Returns `204`. |
| `POST` | `/api/auth/forgot-password` | None | Look up email → determine role → send reset email with role-appropriate URL (`/reset-password` for admin, `/client/reset-password` for client). Always returns `200` regardless of whether email exists (prevent user enumeration). |
| `POST` | `/api/auth/reset-password` | None | Validate token (not expired, not used) → hash new password → update `users.hashed_password` → mark token used. Returns `422` if token invalid/expired/used. |
| `GET` | `/api/auth/webauthn/device-check` | None | Returns `{has_credential: bool}` for email + device (User-Agent). |
| `POST` | `/api/auth/webauthn/register/options` | JWT | Generate and return registration challenge. |
| `POST` | `/api/auth/webauthn/register/verify` | JWT | Verify credential + store in `webauthn_credentials`. Returns `201`. |
| `POST` | `/api/auth/webauthn/authenticate/options` | None | Generate login challenge for given email. |
| `POST` | `/api/auth/webauthn/authenticate/verify` | None | Verify signature → return access token + refresh token. |
| `GET` | `/api/auth/webauthn/credentials` | JWT | List registered devices for the authenticated user. |
| `DELETE` | `/api/auth/webauthn/credentials/{credential_id}` | JWT | Remove a registered device. User can only delete their own credentials — returns `403` if credential belongs to another user. |

### Profile

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/profile` | JWT | Get current user's profile (`full_name`, `email`, `avatar_url`, `role`). |
| `PATCH` | `/api/profile` | JWT | Update `full_name`. Email change requires `current_password` field — returns `422` if password doesn't match. |
| `POST` | `/api/profile/change-password` | JWT | Validates `current_password` → updates `hashed_password`. Returns `422` if current password wrong. |
| `POST` | `/api/profile/avatar` | JWT | Multipart upload → Pillow resize to 256×256, convert to WebP → Supabase Storage at `avatars/{user_id}.webp` → update `users.avatar_url`. Returns `200 {avatar_url: string}`. |

---

## Error Handling

- All FastAPI responses validated with Zod schemas on the frontend at the API client layer
- All incoming request data validated with Pydantic v2 models on the FastAPI side
- Failed mutations show toast notifications (error message) — never expose raw API errors to UI
- Auth errors (401): Axios interceptor attempts token refresh automatically. If refresh fails, clears tokens and redirects to `/login`
- Deactivated account login attempt: `403` — "Your account has been deactivated. Contact support."
- Password reset token expired or already used: `422` — "This reset link is invalid or has expired. Request a new one."
- Email send failures (Resend) do not crash the app — logged server-side, graceful degradation. Resend sender address and verified domain configured via environment variables on the FastAPI side (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`). Same sender used for all outbound emails.
- Form validation client-side (Zod + react-hook-form) before any API call

---

## Testing Strategy

- **Unit tests (backend):** Pydantic schema validation, business logic helpers, computed field calculations (invoice totals, balance due)
- **Unit tests (frontend):** Zod schema validation, data transformation helpers
- **Integration tests (backend):** FastAPI endpoints via `pytest` + `httpx` against a test PostgreSQL database (no mocks for DB layer). Auth middleware tested from both authorized and unauthorized contexts. Notification pipeline: APScheduler job logic tested against test DB with manually set `starts_at` values in the near past. WebAuthn registration and authentication flows tested with `py_webauthn`'s test helpers (simulated authenticator).
- **Component tests:** Key UI components with React Testing Library
- **E2E tests (future):** Critical flows (login, create appointment, create job, create transaction)

---

## Out of Scope (This Iteration)

- Client portal (progress tracking, history, gallery)
- Image upload pipeline (AWS S3)
- Subscriptions / billing
- Multi-user admin (only one admin for now)
- Recurring appointments
- Mobile app
- Online payment collection (no Stripe/PayPal; payments recorded manually by admin)
- Calendar sync (no Google Calendar or iCal integration)
- Data import (no CSV or third-party tool migration)
- Contract / document generation (`contract_signed` is a boolean checkbox only; no PDF contracts or e-signature)
