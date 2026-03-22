# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

weCapture4U is a photography studio management platform. A single admin (the photographer) manages clients, bookings, jobs, and invoicing. Clients optionally get a portal account to view their job status and photos.

## Commands

### Backend (run from `backend/`)

```bash
# Install dependencies
pip install -r requirements.txt

# Run dev server
uvicorn main:app --reload

# Run all tests
pytest

# Run a single test file
pytest tests/test_routers_appointments.py

# Run a single test by name
pytest tests/test_routers_appointments.py::test_create_appointment -v
```

Backend tests hit a real Supabase database (transaction-isolated via savepoints — all data is rolled back after each test). There is no mock DB.

### Frontend (run from `frontend/`)

```bash
npm install
npm run dev        # Vite dev server on :5173
npm run build      # tsc -b && vite build
npm run lint       # ESLint
npm run test       # vitest run (single-pass)
```

Frontend env var: `VITE_API_URL` must point to the backend (e.g. `http://localhost:8000`).

## Architecture

### Backend

```
backend/
  main.py           # FastAPI app, mounts all routers, CORS
  scheduler.py      # APScheduler lifespan (daily job at 08:00 UTC)
  database.py       # Async SQLAlchemy engine + session factory (NullPool for pgbouncer)
  config.py         # Pydantic Settings (reads .env)
  dependencies/
    auth.py         # FastAPI auth dependencies (get_current_admin, get_current_client)
  models/           # SQLAlchemy ORM models
  schemas/          # Pydantic request/response schemas
  routers/          # Route handlers (thin — delegate to services)
  services/         # Business logic layer
  tests/
    conftest.py     # Shared fixtures: db_session (savepoint rollback), admin_user, admin_auth_headers
```

Pattern: **router → service → model**. Routers validate input and call services. Services own all business logic and DB queries. Models are ORM-only.

All DB sessions are async (`AsyncSession`). The engine uses `NullPool` + `prepared_statement_cache_size=0` because Supabase uses pgbouncer in transaction mode.

### Frontend

```
frontend/src/
  App.tsx           # React Router v6 route tree
  lib/
    axios.ts        # Axios instance with JWT interceptors + refresh-token retry
    auth.ts         # Token storage helpers
  api/              # One file per domain (clients, jobs, appointments, invoices…)
  hooks/            # TanStack Query hooks wrapping the api layer
  schemas/          # Zod schemas for API response validation
  pages/
    admin/          # Dashboard, Appointments, Jobs, JobDetail, Clients, ClientDetail, Accounting, Portfolio
    auth/           # Admin login (password + WebAuthn), client login
  components/
    auth/           # AdminRoute, ClientRoute (route guards)
    layout/         # AdminShell (sidebar nav), PublicNav
    ui/             # shadcn/ui components + custom (StatusBadge, ConfirmDialog, GradientCards)
    public/         # Landing page sections (HeroCarousel, AboutSection, ContactForm)
```

Path alias: `@` resolves to `frontend/src/`.

Data fetching pattern: **page → custom hook (TanStack Query) → api function (axios) → Zod-validated response**.

### Authentication

Two separate user roles with separate token flows:

- **Admin**: Password (bcrypt) + optional WebAuthn. JWT access (15 min) + refresh (8h). Routes protected by `get_current_admin` dependency.
- **Client portal**: Password only. JWT access (15 min) + refresh (24h). Routes protected by `get_current_client` dependency.

Tokens are stored in `localStorage` via `lib/auth.ts`. The axios instance automatically retries once on 401 using the refresh token.

WebAuthn RP config: `WEBAUTHN_RP_ID` / `WEBAUTHN_RP_NAME` in `.env`.

### Core Business Flow

1. Admin creates an **Appointment** (`status=confirmed`, `price > 0`)
2. Backend auto-creates a **Job** in the "Booked" stage
3. Backend auto-creates a **draft Invoice** with one line item (appointment title, price)
4. Admin moves job through Kanban **stages** (drag-and-drop via @dnd-kit)
5. When `delivery_url` is set → email sent to client (if portal account exists)
6. Admin records **payments** against the invoice → status transitions `draft → sent → partially_paid → paid`

Invoice total = sum of line item amounts. Payments reduce balance. Payments are on `invoice_payments`, not jobs.

### Scheduler (APScheduler 3)

Runs as a FastAPI lifespan task. Daily at 08:00 UTC:
- Appointment reminders (24h ahead)
- Birthday reminders (7 days ahead)
- Overdue invoice notifications

### Database

PostgreSQL on Supabase. Migrations are plain `.sql` files in `migrations/` — applied manually in order (001 → 011). No ORM migration tool.

Key tables: `clients`, `appointments`, `session_types`, `job_stages`, `jobs`, `invoices`, `invoice_items`, `invoice_payments`, `notifications`, `app_settings`.

Notable column: `appointments.session_type_ids` is a `UUID[]` array (multi-select). `appointments.price` drives auto-invoice creation.

### Required Environment Variables (backend)

```
DATABASE_URL
JWT_SECRET_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
SUPABASE_URL
SUPABASE_SERVICE_KEY
WEBAUTHN_RP_ID
WEBAUTHN_RP_NAME
ALLOWED_ORIGINS        # comma-separated, e.g. https://wecapture4u.com
ENVIRONMENT            # development | production
```

See `backend/.env.example` for a full template.
