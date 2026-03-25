# Admin Booking Requests — Design Spec

**Goal:** Build the admin-side booking requests feature: backend router/service/model + a "Requests" tab inside the existing Appointments page.

**Date:** 2026-03-25

---

## Architecture

Full-stack feature. The `booking_requests` table, backend, and frontend are all unbuilt.

### New Files

| File | Purpose |
|---|---|
| `backend/migrations/012_booking_requests.sql` | Create `booking_requests` table |
| `backend/models/booking_request.py` | SQLAlchemy ORM model |
| `backend/schemas/booking_request.py` | Pydantic request/response schemas |
| `backend/services/booking_requests.py` | Business logic |
| `backend/routers/booking_requests.py` | FastAPI endpoints |
| `frontend/src/schemas/bookingRequests.ts` | Zod schema + TypeScript type |
| `frontend/src/api/bookingRequests.ts` | API functions |
| `frontend/src/hooks/useBookingRequests.ts` | TanStack Query hooks |

### Modified Files

| File | Change |
|---|---|
| `backend/main.py` | Mount booking requests router |
| `frontend/src/pages/admin/Appointments.tsx` | Add "Requests" tab |

---

## Database

### Migration: `backend/migrations/012_booking_requests.sql`

```sql
CREATE TYPE time_slot_enum AS ENUM ('morning', 'afternoon', 'evening', 'all_day');
CREATE TYPE booking_request_status AS ENUM ('pending', 'confirmed', 'rejected');

CREATE TABLE booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  preferred_date DATE NOT NULL,
  time_slot time_slot_enum NOT NULL,
  session_type_id UUID REFERENCES session_types(id),
  addons TEXT[] NOT NULL DEFAULT '{}',
  message TEXT,
  status booking_request_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Backend

### Model: `backend/models/booking_request.py`

SQLAlchemy model for `booking_requests`. Columns: `id`, `client_id`, `preferred_date`, `time_slot` (Enum), `session_type_id` (nullable FK), `addons` (ARRAY(Text)), `message` (nullable), `status` (Enum, default `pending`), `admin_notes` (nullable), `created_at`, `updated_at`.

### Schemas: `backend/schemas/booking_request.py`

- `BookingRequestResponse` — full row for API responses. Includes nested `client_name: str` (joined from `clients.name`). Fields: `id`, `client_id`, `client_name`, `preferred_date`, `time_slot`, `session_type_id`, `addons`, `message`, `status`, `admin_notes`, `created_at`, `updated_at`.
- `BookingRequestUpdateRequest` — for `PATCH /api/booking-requests/{id}`. Fields: `status: Literal['confirmed', 'rejected']`, `admin_notes: str | None`.

### Service: `backend/services/booking_requests.py`

- `list_booking_requests(db, status)` — query all booking requests filtered by status, joined with `clients` for `client_name`, ordered by `created_at` desc.
- `update_booking_request(db, id, data)` — set `status`, `admin_notes`, `updated_at = now()`. Return updated row. Raises `404` if not found.

Email sending on status change is handled in the router layer (calls `services/email.py`) — not in the service — to keep the service pure and testable.

### Router: `backend/routers/booking_requests.py`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/booking-requests` | JWT (admin) | List booking requests. Query param: `status` (default: `pending`). Returns `list[BookingRequestResponse]`. |
| `PATCH` | `/api/booking-requests/{id}` | JWT (admin) | Confirm or reject. Updates `status` + `admin_notes`. Sends client email (confirm or reject). Returns updated `BookingRequestResponse`. |

**Email triggers (in router, after successful DB update):**
- `status → confirmed`: send booking confirmed email to client (client name + preferred date + admin_notes if set + portal link)
- `status → rejected`: send booking rejected email to client (admin_notes as reason if set + invitation to submit new request)

Email send failures are caught and logged — they do not cause the endpoint to return an error (graceful degradation, consistent with rest of app).

### `backend/main.py`

Add:
```python
from routers.booking_requests import router as booking_requests_router
app.include_router(booking_requests_router)
```

---

## Frontend

### Zod Schema: `frontend/src/schemas/bookingRequests.ts`

```ts
export const BookingRequestSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  client_name: z.string(),
  preferred_date: z.string(),       // 'YYYY-MM-DD'
  time_slot: z.enum(['morning', 'afternoon', 'evening', 'all_day']),
  session_type_id: z.string().uuid().nullable(),
  addons: z.array(z.string()),
  message: z.string().nullable(),
  status: z.enum(['pending', 'confirmed', 'rejected']),
  admin_notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type BookingRequest = z.infer<typeof BookingRequestSchema>
export const BookingRequestListSchema = z.array(BookingRequestSchema)
```

### API: `frontend/src/api/bookingRequests.ts`

- `fetchBookingRequests(status?: string)` — `GET /api/booking-requests?status=...` — parses with `BookingRequestListSchema`
- `updateBookingRequest(id, data: { status: 'confirmed' | 'rejected'; admin_notes?: string })` — `PATCH /api/booking-requests/{id}` — parses with `BookingRequestSchema`

### Hooks: `frontend/src/hooks/useBookingRequests.ts`

- `useBookingRequests(status?: string)` — TanStack Query, queryKey `['booking-requests', status]`, calls `fetchBookingRequests`
- `useUpdateBookingRequest()` — mutation, on success invalidates `['booking-requests']`, `toast.success` on confirm/reject, `toast.error` on failure

---

## Frontend — Requests Tab in Appointments.tsx

The Appointments page gains a second top-level tab: **Appointments** | **Requests**. The existing calendar/list UI is unchanged inside the Appointments tab.

### Requests tab layout

- **Status filter:** Three buttons (`Pending` / `Confirmed` / `Rejected`), default `Pending`. Drives the `status` param passed to `useBookingRequests`.
- **Table:** one row per booking request.

| Column | Value |
|---|---|
| Client | `client_name` |
| Preferred Date | formatted `preferred_date` (e.g. "Mar 28, 2026") |
| Time Slot | capitalized enum label ("Morning", "All Day") |
| Session Type | name looked up from `useSessionTypes()` by `session_type_id` (or "—" if null) |
| Add-ons | comma-joined list (or "—" if empty) |
| Message | truncated to ~60 chars, full text on hover title attr |
| Submitted | relative timestamp via `formatDistanceToNow` |
| Actions | Confirm + Reject buttons — only rendered when `status === 'pending'` |

- **Empty state:** "No pending requests" (or "No confirmed requests" etc.) centered muted text.
- **Loading state:** render nothing (consistent with other pages).

### Confirm flow

1. Admin clicks **Confirm** on a pending request.
2. The existing appointment create modal opens, pre-filled:
   - `starts_at`: `preferred_date` + default time by slot (`morning`/`all_day` → 09:00, `afternoon` → 14:00, `evening` → 18:00)
   - `session_type_id`: from request
   - `addons`: from request
   - `notes`: from request `message`
   - A read-only label "Time slot preference: Morning" shown below the date/time field in the modal
3. Admin edits as needed, saves → `POST /api/appointments`.
4. On appointment save success → `PATCH /api/booking-requests/{id}` with `status: 'confirmed'`.
5. Both query caches invalidated. Success toast: "Booking confirmed".

### Reject flow

1. Admin clicks **Reject** → small modal appears with:
   - Heading: "Reject booking request"
   - Optional textarea: "Notes to client (optional)"
   - Buttons: Cancel | Reject
2. On Reject → `PATCH /api/booking-requests/{id}` with `status: 'rejected'`, `admin_notes`.
3. Query cache invalidated. Success toast: "Booking rejected".

---

## Error Handling

- `useUpdateBookingRequest` handles errors with `toast.error('Failed to update booking request')` — no additional error handling needed in the page component.
- Email send failures on the backend are caught and logged; the API still returns `200`.
- Appointment creation failure during confirm flow: the booking request is **not** confirmed (the PATCH only fires on appointment save success). User sees appointment form error toast.

---

## Testing

**Backend:**
- `tests/test_routers_booking_requests.py` — integration tests using real DB (savepoint rollback pattern):
  - `GET /api/booking-requests` returns pending requests
  - `GET /api/booking-requests?status=confirmed` returns confirmed
  - `PATCH` confirm updates status, returns updated row
  - `PATCH` reject updates status + admin_notes, returns updated row
  - `PATCH` on non-existent id returns 404
  - Unauthenticated requests return 401

**Frontend:** No unit tests needed — pure UI composition on top of already-tested hooks pattern.
