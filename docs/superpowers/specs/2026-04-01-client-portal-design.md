# Client Portal — Design Spec

**Date:** 2026-04-01
**Status:** Approved

---

## Overview

The client portal is a separate authenticated area of the app where a client logs in to check their job status, view delivered photos, request new bookings, and update their profile. It is read-only except for booking requests and profile edits. Invoices and billing are admin-only for now.

---

## Pages & Navigation

The portal uses a `ClientShell` layout component: **bottom tab bar on mobile, horizontal top nav bar on desktop**. Four tabs:

| Tab label | Route | Page component |
|-----------|-------|----------------|
| Home | `/client` | `Dashboard.tsx` |
| My Jobs | `/client/jobs` | `Jobs.tsx` (list) + `/client/jobs/:id` → `JobDetail.tsx` |
| Book | `/client/book` | `BookSession.tsx` |
| Profile | `/client/profile` | `Profile.tsx` |

All routes are protected by the existing `ClientRoute` guard (checks token + `role === 'client'`).

---

## Page Specifications

### Dashboard (`/client`)

- Shows the client's next 1–3 upcoming jobs, sorted by appointment date ascending.
- Each job card: appointment title, formatted date, current stage badge, "View Photos" button if `delivery_url` is set.
- If the client has no upcoming jobs: empty state with a "Book a session" CTA linking to `/client/book`.

### Jobs List (`/client/jobs`)

- Full list of all the client's jobs, sorted newest first.
- Each row: appointment title, appointment date, stage badge.
- Tapping/clicking a row navigates to Job Detail.

### Job Detail (`/client/jobs/:id`)

- Appointment title and date.
- Session type name (if set).
- Stage progress indicator: all stages listed in order, current stage highlighted.
- "View Photos" button (links to `delivery_url`) shown only when `delivery_url` is set.
- Admin notes / message field is not shown (admin-only).
- If the client tries to access a job that doesn't belong to them, return 403 and show an error page.

### Book a Session (`/client/book`)

Form fields:
- **Preferred date** — date picker, required
- **Time slot** — select: Morning / Afternoon / Evening / All Day, required
- **Session type** — select from available session types, optional
- **Message** — textarea for any notes, optional

On submit: creates a booking request via `POST /client/booking-requests`. Shows a success confirmation message.

Below the form: list of the client's existing booking requests showing date, time slot, status badge (pending / confirmed / rejected) and admin notes if any. Sorted newest first.

### Profile (`/client/profile`)

Editable fields:
- Name (required)
- Phone (optional)

Read-only display:
- Email (shown but not editable — note: "Contact us to change your email address")

Save button calls `PATCH /client/me`. Shows toast on success or error.

---

## Backend

New file: `backend/routers/client_portal.py`
Router prefix: `/client`
All endpoints use the `require_client` dependency. Client identity is resolved from the JWT `sub` field (which is the `user_id`). The `client_id` is resolved by joining `clients.user_id = current_user.id`.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/client/me` | Return own profile: `id`, `name`, `email`, `phone` |
| PATCH | `/client/me` | Update `name` and/or `phone` |
| GET | `/client/jobs` | List own jobs with appointment + stage info |
| GET | `/client/jobs/{id}` | Job detail with all stages and `delivery_url` |
| GET | `/client/booking-requests` | List own booking requests, newest first |
| POST | `/client/booking-requests` | Create a new booking request |

### Response shapes (backend schemas)

`GET /client/me` → `{ id, name, email, phone }`

`GET /client/jobs` → list of `{ id, delivery_url, appointment: { title, date }, stage: { name, color } }`

`GET /client/jobs/{id}` → `{ id, delivery_url, appointment: { title, date, session_type_name }, stage: { id, name }, all_stages: [{ id, name, position }] }`

`GET /client/booking-requests` → list of `{ id, preferred_date, time_slot, session_type: { name } | null, message, status, admin_notes, created_at }`

`POST /client/booking-requests` body: `{ preferred_date, time_slot, session_type_id?, message? }`

### Authorization rules

- A client can only read their own jobs. If `job.client_id != client.id`, return 404 (not 403, to avoid enumeration).
- A client can only read their own booking requests.
- Email is never updatable via the client portal.

---

## Frontend Architecture

Follows the existing pattern: `api/ → hooks/ → pages/`.

### New files

```
frontend/src/
  api/clientPortal.ts          ← axios calls to /client/* endpoints
  hooks/useClientPortal.ts     ← TanStack Query hooks
  schemas/clientPortal.ts      ← Zod schemas for all client portal responses
  components/layout/ClientShell.tsx
  pages/client/
    Dashboard.tsx
    Jobs.tsx
    JobDetail.tsx
    BookSession.tsx
    Profile.tsx
```

### Updated files

- `frontend/src/routes/index.tsx` — add client portal routes under `ClientRoute` guard

### ClientShell layout

- On mobile (< `md`): fixed bottom tab bar with 4 icon+label tabs; main content fills the rest of the screen.
- On desktop (`md+`): sticky top nav bar with logo on the left, nav links in the center, user name + logout on the right.
- Tabs: Home (House icon), My Jobs (Images icon), Book (CalendarPlus icon), Profile (User icon).
- Uses the same dark theme tokens as the admin shell.

### Zod schemas

All API responses are validated at the boundary in `schemas/clientPortal.ts`. The hooks in `useClientPortal.ts` wrap query results in Zod `.parse()` calls.

---

## No New Migrations Required

The `booking_requests` table (created in migration `004_client_portal.sql`) already has `client_id UUID NOT NULL REFERENCES clients(id)`, `preferred_date`, `time_slot` (enum), `session_type_id`, `message`, `status`, and `admin_notes`. No schema changes needed.

---

## Out of Scope (for now)

- Invoice / payment visibility for clients
- Client-side photo gallery or download
- Real-time notifications in the portal
- Clients changing their email address
