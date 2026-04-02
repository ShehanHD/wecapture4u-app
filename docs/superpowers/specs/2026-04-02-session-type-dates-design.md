# Session Type Available Days & Per-Slot Scheduling

**Date:** 2026-04-02
**Status:** Approved

## Problem

Currently, an appointment or booking request has a single date and a single time-of-day. Session types have no day restrictions. This doesn't work when different session types are only available on certain days of the week — e.g. "Newborn" only on Mon/Wed, "Wedding" only on Sat/Sun.

## Solution

Each session type gets a configurable list of available days (Mon–Sun). Appointments and booking requests are restructured from a single date+time into a list of **session slots** — one per session type — each with its own date and time of day.

---

## Data Model

### Approach: JSONB session_slots (Option A)

Add `session_slots` JSONB to `appointments` and `booking_requests`. Keep `starts_at` on appointments (set to earliest slot date) so the calendar and scheduler continue to work unchanged.

### Migration 015

```sql
ALTER TABLE session_types ADD COLUMN available_days INTEGER[] NOT NULL DEFAULT '{}';
-- 0=Monday, 1=Tuesday, ..., 6=Sunday. Empty array = no restriction (all days allowed).

ALTER TABLE appointments ADD COLUMN session_slots JSONB NOT NULL DEFAULT '[]';
-- Each element: { "session_type_id": "uuid", "date": "YYYY-MM-DD", "time_slot": "morning|afternoon|evening|all_day" }

ALTER TABLE booking_requests ADD COLUMN session_slots JSONB NOT NULL DEFAULT '[]';
-- Same shape as appointments.
```

### Slot shape

```json
{
  "session_type_id": "uuid",
  "date": "YYYY-MM-DD",
  "time_slot": "morning" | "afternoon" | "evening" | "all_day"
}
```

### Backwards compatibility

- `appointments.starts_at` — kept, computed as min date across all slots on every write
- `appointments.session_type_ids` — kept, derived from slot IDs on every write (calendar still uses it)
- `appointments.session_time` — no longer written by new code; kept nullable in DB for existing rows
- `booking_requests.session_type_id` — no longer written by new code; kept nullable for existing rows
- `booking_requests.preferred_date` — kept, computed as min slot date on every write
- `booking_requests.time_slot` — no longer written by new code; kept nullable for existing rows

---

## Backend Changes

### 1. Session Types

**Model (`models/session_type.py`):**
- Add `available_days: list[int]` mapped to `ARRAY(Integer)`

**Schemas (`schemas/settings.py`):**
- `SessionTypeOut` — add `available_days: list[int]`
- `SessionTypeCreate` — add `available_days: list[int] = []`
- `SessionTypeUpdate` — add `available_days: Optional[list[int]] = None`

**Service (`services/settings.py`):**
- `create_session_type` — accept and store `available_days`
- `update_session_type` — accept and patch `available_days`

### 2. Appointments

**Model (`models/appointment.py`):**
- Add `session_slots: list[dict]` mapped to `JSON` column

**Schemas (`schemas/appointments.py`):**
- `AppointmentCreate` — replace `session_time: Optional[str]` with `session_slots: list[SessionSlot]`; remove `session_type_ids` (derived from slots)
- `AppointmentUpdate` — same replacement
- `AppointmentOut` — add `session_slots: list[SessionSlot]`
- Add `SessionSlot` pydantic model: `session_type_id: UUID`, `date: date`, `time_slot: Literal['morning','afternoon','evening','all_day']`

**Service (`services/appointments.py`):**
- On create/update: compute `starts_at` = min slot date, `session_type_ids` = [s.session_type_id for s in slots]
- Store `session_slots` as list of dicts

### 3. Booking Requests

**Model (`models/booking_request.py`):**
- Add `session_slots: list[dict]` mapped to `JSON` column

**Schemas (`schemas/booking_request.py`):**
- `BookingRequestCreate` (client portal) — replace `session_type_id`, `preferred_date`, `time_slot` with `session_slots: list[SessionSlot]`
- `BookingRequestOut` — add `session_slots: list[SessionSlot]`

**Service / router (`routers/client_portal.py`):**
- On create: compute `preferred_date` = min slot date, store `session_slots`
- `GET /session-types` response must include `available_days`

---

## Frontend Changes

### 1. Schemas

- `frontend/src/schemas/settings.ts` — `SessionTypeSchema` add `available_days: z.array(z.number())`
- `frontend/src/schemas/appointments.ts` — add `SessionSlotSchema`; replace `session_time`/`session_type_ids` with `session_slots`
- `frontend/src/schemas/bookingRequests.ts` — add `session_slots`
- `frontend/src/schemas/clientPortal.ts` — `SessionTypeSchema` add `available_days`; `ClientBookingRequestSchema` add `session_slots`

### 2. Settings — Session Type Row

`SessionTypeRow` in `Settings.tsx`:
- Add 7 day-toggle buttons (Mon–Sun) below the name field
- Active days highlighted; toggling adds/removes the day index from `available_days`
- Saves via `useUpdateSessionType` on change

### 3. Admin Appointment Form (`Appointments.tsx`)

Replace:
- Session type multi-select (`session_type_ids`)
- Single start date input (`starts_at`)
- Multi-day checkbox + end date
- Session time select (`session_time`)

With a **slot builder**:
- One slot row per session type: [Session Type dropdown] [Date input — filtered to available_days] [Time of Day select]
- "Add session type" button appends a new slot (default date = first slot's date)
- "×" button on each row removes that slot (minimum 1 slot required)
- Date input uses `min` attribute and JS to disable unavailable weekdays

### 4. Client Booking Form (`BookSession.tsx`)

Same slot builder as admin form. Available days filtering applied per session type. First selected date propagates as default to any subsequently added slots.

---

## Filtering Available Days (Frontend)

```ts
function isDateAllowed(dateStr: string, availableDays: number[]): boolean {
  if (availableDays.length === 0) return true // no restriction
  const day = getDay(parseISO(dateStr)) // 0=Sun in date-fns
  // Convert: date-fns 0=Sun → our 0=Mon
  const normalized = day === 0 ? 6 : day - 1
  return availableDays.includes(normalized)
}
```

The date `<input type="date">` does not natively support disabling weekdays. We use the `onChange` handler to reject invalid selections and show an inline error: *"This session type is not available on [day]. Available days: Mon, Wed, Fri."*

---

## What Does NOT Change

- Calendar view (`react-big-calendar`) — still reads `starts_at`
- Scheduler reminders — still use `starts_at` / `preferred_date`
- Admin booking request confirm flow — prefill still works (uses first slot's date/time)
- Invoice auto-creation — triggered by appointment creation, unaffected
