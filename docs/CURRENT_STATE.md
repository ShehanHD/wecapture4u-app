# weCapture4U — Current State (2026-03-18)

> This document reflects the actual implemented state of the system. The original plan files in `docs/superpowers/plans/` describe the intended architecture; this file documents where we landed and what diverged.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI + SQLAlchemy 2 async + PostgreSQL (Supabase) |
| Auth | JWT (access + refresh) + WebAuthn |
| Email | Resend |
| Scheduler | APScheduler 3 (lifespan) |
| Frontend | React 18 + TypeScript + Vite + TanStack Query v5 + Tailwind + shadcn/ui |
| File storage | Supabase Storage |

---

## Database Tables (actual columns)

### `clients`
`id, user_id (nullable FK→users), name, email, phone, address, tags[], birthday, notes, created_at`

### `session_types`
`id, name, created_at`

### `appointments`
`id, client_id, session_type_ids (UUID[]), session_time (morning/afternoon/evening), title, starts_at, ends_at, location, status (pending/confirmed/cancelled), addons[], deposit_paid, deposit_amount, deposit_account_id, contract_signed, price, notes, created_at`

> **Note:** `session_type_ids` is an array (multi-select). `price` was added to drive auto-invoice creation.

### `job_stages`
`id, name, color (hex), position, is_terminal, created_at`

### `jobs`
`id, client_id, appointment_id (nullable), stage_id, delivery_url (nullable), created_at`

> **Divergence from plan:** `title`, `shoot_date`, `delivery_deadline`, `notes`, `price` were removed. All these are read from the linked appointment. `delivery_url` is the only job-specific editable field.

### `invoices`
`id, job_id (nullable), client_id, status (draft/sent/partially_paid/paid), subtotal, discount, tax, total, deposit_amount, balance_due, requires_review, due_date, sent_at, paid_at, created_at`

### `invoice_items`
`id, invoice_id, revenue_account_id (nullable), description, quantity, unit_price, amount`

### `invoice_payments`
`id, invoice_id, amount, paid_at, method, notes, created_at`

> **Divergence from plan:** Payments are recorded against invoices (not jobs). A draft invoice with one line item is auto-created when a confirmed appointment has a price > 0.

### `notifications`
`id, user_id, type, title, body, read, sent_email, created_at`

### `app_settings`
`id (always 1), tax_enabled, tax_rate, pdf_invoices_enabled, updated_at`

---

## API Endpoints

All routes are prefixed with `/api` and require admin JWT unless noted.

### Clients
```
GET    /api/clients                    list (search, tags filter)
POST   /api/clients                    create (with optional portal account)
GET    /api/clients/{id}               get with stats (total_spent, is_active)
PATCH  /api/clients/{id}               update
DELETE /api/clients/{id}               delete
POST   /api/clients/{id}/portal        create portal account
PATCH  /api/clients/{id}/portal        toggle portal active/inactive
```

### Appointments
```
GET    /api/appointments               list (status, session_type_id, date range)
POST   /api/appointments               create → auto-creates job if status=confirmed
GET    /api/appointments/{id}          get
PATCH  /api/appointments/{id}          update → auto-creates/removes job on status change
DELETE /api/appointments/{id}          delete (blocked if linked job exists)
```

**Key business logic:**
- Confirming an appointment → auto-creates a Job in "Booked" stage
- Un-confirming → deletes the linked job (unless an invoice exists)
- If `price > 0` on confirm → also auto-creates a draft invoice with one line item

### Jobs
```
GET    /api/jobs                       list (stage_id, client_id filter)
POST   /api/jobs                       create
GET    /api/jobs/{id}                  get detail (appointment + stage + session types eager loaded)
PATCH  /api/jobs/{id}                  update (stage_id, delivery_url only)
DELETE /api/jobs/{id}                  delete (blocked if invoice exists)
POST   /api/jobs/{id}/invoice          create draft invoice from appointment price (one-click)
```

### Job Stages
```
GET    /api/job-stages                 list
POST   /api/job-stages                 create
PATCH  /api/job-stages/positions       reorder
PATCH  /api/job-stages/{id}            update
DELETE /api/job-stages/{id}            delete (blocked if jobs assigned)
```

### Invoices
```
GET    /api/invoices                   list (status, client_id, job_id filter)
POST   /api/invoices                   create
GET    /api/invoices/{id}              get (items + payments eager loaded)
PATCH  /api/invoices/{id}              update (status, discount, tax, deposit_amount, due_date)
DELETE /api/invoices/{id}              delete (draft only)
POST   /api/invoices/{id}/items        add item → recalculates totals
PATCH  /api/invoices/{id}/items/{iid}  update item → recalculates totals
DELETE /api/invoices/{id}/items/{iid}  delete item → recalculates totals
POST   /api/invoices/{id}/payments     record payment → updates status (sent→partially_paid→paid)
DELETE /api/invoices/{id}/payments/{pid} delete payment → recalculates balance
```

### Notifications
```
GET    /api/notifications              list (unread filter)
PATCH  /api/notifications/{id}/read   mark read
POST   /api/notifications/read-all    mark all read
DELETE /api/notifications/{id}        delete
```

### Settings
```
GET    /api/settings                   get app settings
PATCH  /api/settings                   update app settings
GET    /api/settings/session-types     list session types
POST   /api/settings/session-types     create session type
PATCH  /api/settings/session-types/{id} update
DELETE /api/settings/session-types/{id} delete
```

### Portfolio (public + admin)
```
GET    /api/portfolio/categories       public
GET    /api/portfolio/settings         public
GET    /api/portfolio/photos           public
POST   /api/portfolio/photos           admin — upload
PATCH  /api/portfolio/photos/{id}      admin
DELETE /api/portfolio/photos/{id}      admin
PATCH  /api/portfolio/settings         admin
```

---

## Frontend Pages

```
/                          Landing / portfolio
/gallery                   Public gallery
/portfolio                 Portfolio admin
/admin/login               Admin login
/admin/dashboard           Dashboard (stats)
/admin/appointments        Appointments — list/calendar + create/edit modal
/admin/jobs                Jobs — Kanban board (drag-and-drop by stage)
/admin/jobs/:id            Job detail — stage selector, delivery URL, linked appointment data, payments
/admin/clients             Clients — searchable table
/admin/clients/:id         Client detail — info, portal access, linked jobs/invoices
```

---

## Key Business Logic

### Appointment → Job → Invoice flow
1. Create appointment with `price = 250`, `status = confirmed`
2. → Job auto-created in "Booked" stage
3. → Draft invoice auto-created with one line item (appointment title, €250)
4. Admin moves job to "Delivered" stage → delivery URL input appears
5. Admin records payment via job detail → payment saved against linked invoice
6. Invoice status: `draft → sent → partially_paid → paid`

### Invoice total calculation
`subtotal = sum(item.amount)` · `total = subtotal - discount + tax` · `balance_due = max(0, total - payments_sum)`
All recalculated in Python on every item/payment mutation and persisted.

### Job stage email notifications
When a job's stage changes and the client has a portal account → sends email via Resend.
When `delivery_url` is first set → sends "photos ready" email.

### APScheduler (daily at 08:00)
- Birthday reminders (7 days ahead)
- Appointment reminders (24h ahead)
- Overdue invoice notifications

---

## Migrations Applied
```
001_initial_schema.sql       Core tables
002_webauthn.sql             WebAuthn credentials
003_accounting.sql           Accounting / chart of accounts
004_client_portal.sql        Portal user fields
005_portfolio.sql            Portfolio photos + settings
006_seo.sql                  SEO / Open Graph settings
007_appointment_session_updates.sql  session_type_ids array, session_time, price on appointments
008_invoice_payments.sql     invoice_payments table (first pass)
009_job_payments.sql         Added price to appointments/jobs, added/dropped job_payments
010_simplify_jobs.sql        Dropped title/shoot_date/delivery_deadline/notes/price from jobs
```
