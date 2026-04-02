# Appointment Precise Time per Slot

**Date:** 2026-04-02
**Status:** Approved

## Problem

The admin appointment form only allows selecting a time-of-day category (morning / afternoon / evening / all_day) per slot. There is no way to record the exact start time of a session, which means `starts_at` is always midnight and the calendar shows all appointments at the wrong time.

## Solution

Add an optional `time` field (HH:MM) to each session slot on admin appointments. When a precise time is set, `time_slot` is auto-derived from it and `starts_at` is computed with the actual time instead of midnight. The `time_slot` dropdown stays visible as a fallback when no precise time is given. An inline overlap warning is shown in the form if another appointment already occupies the same date + time_slot.

---

## Data Model

### Slot shape (admin appointments only)

```json
{
  "session_type_id": "uuid",
  "date": "YYYY-MM-DD",
  "time": "10:30",
  "time_slot": "morning"
}
```

- `time` — optional HH:MM string. When present, `time_slot` is derived from it.
- `time_slot` — always set. Derived automatically when `time` is provided; manually selected otherwise.

### `time_slot` derivation

```
00:00–11:59 → morning
12:00–16:59 → afternoon
17:00–23:59 → evening
```

### `starts_at` computation

- With `time`: `f"{earliest_slot_date}T{time}:00+00:00"`
- Without `time`: `f"{earliest_slot_date}T00:00:00+00:00"` (current behavior)

### What does NOT change

- `booking_requests.session_slots` — client portal slots have no `time` field; `ClientBookingRequestSlot` schema is unchanged.
- Calendar (`react-big-calendar`) — reads `starts_at`, benefits automatically.
- Scheduler reminders — read `starts_at`, benefit automatically.

---

## Backend Changes

### `backend/schemas/appointments.py`

`SessionSlot` — add:
```python
time: Optional[str] = None

@field_validator("time")
@classmethod
def time_format(cls, v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    import re
    if not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", v):
        raise ValueError("time must be HH:MM (00:00–23:59)")
    return v
```

### `backend/services/appointments.py`

Add `_derive_time_slot`:
```python
def _derive_time_slot(time: str) -> str:
    h = int(time.split(":")[0])
    if h < 12:
        return "morning"
    if h < 17:
        return "afternoon"
    return "evening"
```

Update `_compute_starts_at` — use slot time when present:
```python
def _compute_starts_at(slots: list[dict]) -> datetime:
    if not slots:
        return datetime.now(tz=timezone.utc)
    earliest = sorted(slots, key=lambda s: s["date"])[0]
    date_str = earliest["date"]
    time_str = earliest.get("time") or "00:00"
    return datetime.fromisoformat(f"{date_str}T{time_str}:00+00:00")
```

Update `_slots_to_dicts` — include `time` when present:
```python
d["time"] = str(d["time"]) if d.get("time") else None
```

Update `_compute_session_slots` (called on create/update) — derive `time_slot` when `time` is set:
```python
for slot in slots_dicts:
    if slot.get("time"):
        slot["time_slot"] = _derive_time_slot(slot["time"])
```

---

## Frontend Changes

### `frontend/src/schemas/appointments.ts`

`SessionSlotSchema` — add:
```typescript
time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
```

### `frontend/src/pages/admin/Appointments.tsx`

#### Slot form schema
`SessionSlotFormSchema` — add `time: z.string().optional()`.

#### `deriveTimeSlot` helper
```typescript
function deriveTimeSlot(time: string): 'morning' | 'afternoon' | 'evening' {
  const h = parseInt(time.split(':')[0])
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
```

#### Slot builder JSX
Each slot row gets an `<input type="time">` between the date input and the time_slot Select:

- When `time` is filled: auto-call `setValue('session_slots.N.time_slot', deriveTimeSlot(time))` and hide the `time_slot` Select, replacing it with a read-only derived label (e.g. `"Morning"`).
- When `time` is cleared: show the `time_slot` Select again.

#### Overlap detection
After slot builder renders, compare each slot's `date + time_slot` against all existing appointments loaded on the page (TanStack Query cache). Show a yellow inline warning below the affected slot row:

```
⚠ Overlaps with "Wedding – Sarah" (morning, Jul 1)
```

Warning only — does not block saving.

Overlap logic:
```typescript
const appointmentsOnDay = appointments.filter(a =>
  a.id !== editingAppointmentId &&
  a.session_slots.some(s => s.date === slotDate && s.time_slot === slotTimeSlot)
)
```

---

## What Does NOT Change

- `BookSession.tsx` — client portal form, no time input
- `ClientBookingRequestSlot` schema — unchanged
- Calendar and scheduler — automatically benefit from correct `starts_at`
- Booking request confirm flow — prefill still works
