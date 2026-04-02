# Appointment Precise Time per Slot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the admin to optionally enter a precise HH:MM time per appointment slot; `starts_at` incorporates the time and `time_slot` is auto-derived.

**Architecture:** Add optional `time: Optional[str]` to the `SessionSlot` Pydantic model and Zod schema. The backend derives `time_slot` and computes `starts_at` with the correct time on every create/update. The admin form shows a time input per slot; when filled, the `time_slot` dropdown is hidden and replaced by a derived label. An inline overlap warning fires when another appointment shares the same date + time_slot.

**Tech Stack:** Python/FastAPI/Pydantic (backend), React/TypeScript/react-hook-form/Zod (frontend)

---

## File Map

**Modify (backend):**
- `backend/schemas/appointments.py` — add `time: Optional[str]` + HH:MM validator to `SessionSlot`
- `backend/services/appointments.py` — add `_derive_time_slot`, update `_compute_starts_at` + `create_appointment` + `update_appointment`
- `backend/tests/test_routers_appointments.py` — add precise-time tests

**Modify (frontend):**
- `frontend/src/schemas/appointments.ts` — add `time` to `SessionSlotSchema`
- `frontend/src/pages/admin/Appointments.tsx` — time input, conditional time_slot display, overlap warning

---

## Task 1: Backend — `time` field on `SessionSlot` + service helpers

**Files:**
- Modify: `backend/schemas/appointments.py`
- Modify: `backend/services/appointments.py`
- Test: `backend/tests/test_routers_appointments.py`

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_routers_appointments.py`:

```python
@pytest.mark.asyncio
async def test_create_appointment_with_precise_time(test_client, admin_auth_headers, db_session):
    client = await _make_client(db_session, "TimeTest")
    st = await _make_session_type(db_session, "Portrait")

    resp = await test_client.post(
        "/api/appointments",
        json={
            "client_id": str(client.id),
            "title": "10am Portrait",
            "session_slots": [
                {
                    "session_type_id": str(st.id),
                    "date": "2026-08-10",
                    "time": "10:30",
                    "time_slot": "morning",  # should be derived — passing anything here is fine
                }
            ],
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    # starts_at must include the precise time
    assert data["starts_at"].startswith("2026-08-10T10:30")
    # time_slot derived from 10:30 → morning
    assert data["session_slots"][0]["time_slot"] == "morning"
    assert data["session_slots"][0]["time"] == "10:30"


@pytest.mark.asyncio
async def test_time_slot_derived_from_time(test_client, admin_auth_headers, db_session):
    """Verify derivation: afternoon boundary at 12:00, evening at 17:00."""
    client = await _make_client(db_session, "Derive")
    st = await _make_session_type(db_session, "Wedding")

    cases = [
        ("09:00", "morning"),
        ("12:00", "afternoon"),
        ("16:59", "afternoon"),
        ("17:00", "evening"),
        ("23:30", "evening"),
    ]
    for time_str, expected_slot in cases:
        resp = await test_client.post(
            "/api/appointments",
            json={
                "client_id": str(client.id),
                "title": f"Session at {time_str}",
                "session_slots": [
                    {
                        "session_type_id": str(st.id),
                        "date": "2026-09-01",
                        "time": time_str,
                        "time_slot": "all_day",  # should be overridden
                    }
                ],
            },
            headers=admin_auth_headers,
        )
        assert resp.status_code == 201, f"Failed for {time_str}: {resp.json()}"
        data = resp.json()
        assert data["session_slots"][0]["time_slot"] == expected_slot, (
            f"time={time_str}: expected {expected_slot}, got {data['session_slots'][0]['time_slot']}"
        )


@pytest.mark.asyncio
async def test_starts_at_without_time_is_midnight(test_client, admin_auth_headers, db_session):
    """When no time is given, starts_at stays at midnight (existing behaviour)."""
    client = await _make_client(db_session, "NoTime")
    st = await _make_session_type(db_session)

    resp = await test_client.post(
        "/api/appointments",
        json={
            "client_id": str(client.id),
            "title": "No time",
            "session_slots": [
                {"session_type_id": str(st.id), "date": "2026-08-15", "time_slot": "afternoon"}
            ],
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["starts_at"].startswith("2026-08-15T00:00")


@pytest.mark.asyncio
async def test_invalid_time_format_rejected(test_client, admin_auth_headers, db_session):
    client = await _make_client(db_session, "BadTime")
    st = await _make_session_type(db_session)

    resp = await test_client.post(
        "/api/appointments",
        json={
            "client_id": str(client.id),
            "title": "Bad time",
            "session_slots": [
                {
                    "session_type_id": str(st.id),
                    "date": "2026-08-15",
                    "time": "25:00",  # invalid
                    "time_slot": "morning",
                }
            ],
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 422
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend && source venv/bin/activate && pytest tests/test_routers_appointments.py::test_create_appointment_with_precise_time tests/test_routers_appointments.py::test_time_slot_derived_from_time tests/test_routers_appointments.py::test_starts_at_without_time_is_midnight tests/test_routers_appointments.py::test_invalid_time_format_rejected -v 2>&1 | tail -20
```

Expected: 4 FAILED (field `time` not recognised yet)

- [ ] **Step 3: Update `backend/schemas/appointments.py` — add `time` to `SessionSlot`**

```python
import re
import uuid
from datetime import datetime, date as date_type
from decimal import Decimal
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, field_validator

VALID_STATUSES = {"pending", "confirmed", "cancelled"}
VALID_ADDONS = {"album", "thank_you_card", "enlarged_photos"}


class SessionSlot(BaseModel):
    session_type_id: uuid.UUID
    date: date_type
    time_slot: Literal["morning", "afternoon", "evening", "all_day"]
    time: Optional[str] = None

    @field_validator("time")
    @classmethod
    def time_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", v):
            raise ValueError("time must be HH:MM (00:00–23:59)")
        return v
```

Keep the rest of the file (`AppointmentCreate`, `AppointmentUpdate`, `AppointmentOut`, etc.) exactly as-is.

- [ ] **Step 4: Update `backend/services/appointments.py` — add `_derive_time_slot`, update helpers**

Add `_derive_time_slot` after the existing `_compute_session_type_ids` function:

```python
def _derive_time_slot(time: str) -> str:
    """Derive morning/afternoon/evening from HH:MM."""
    h = int(time.split(":")[0])
    if h < 12:
        return "morning"
    if h < 17:
        return "afternoon"
    return "evening"
```

Replace `_compute_starts_at` with:

```python
def _compute_starts_at(slots: list[dict]) -> datetime:
    """Return the earliest slot date+time as a UTC datetime."""
    if not slots:
        return datetime.now(tz=timezone.utc)
    earliest = sorted(slots, key=lambda s: s["date"])[0]
    date_str = earliest["date"]
    time_str = earliest.get("time") or "00:00"
    return datetime.fromisoformat(f"{date_str}T{time_str}:00+00:00")
```

In `create_appointment`, after `slots_dicts = _slots_to_dicts(slots_raw)`, add derivation:

```python
async def create_appointment(db: AsyncSession, *, data: dict) -> AppointmentOut:
    slots_raw = data.pop("session_slots", [])
    slots_dicts = _slots_to_dicts(slots_raw)
    # Derive time_slot from precise time when present
    for slot in slots_dicts:
        if slot.get("time"):
            slot["time_slot"] = _derive_time_slot(slot["time"])
    data["session_slots"] = slots_dicts
    data["starts_at"] = _compute_starts_at(slots_dicts)
    data["session_type_ids"] = _compute_session_type_ids(slots_dicts)
    data.pop("session_time", None)
    data.pop("ends_at", None)

    appt = Appointment(**data)
    db.add(appt)
    await db.flush()
    if appt.status == "confirmed":
        await _auto_create_job(db, appt)
    return await _to_out(db, appt)
```

In `update_appointment`, add the same derivation inside the `if "session_slots" in data` block:

```python
    if "session_slots" in data and data["session_slots"] is not None:
        slots_dicts = _slots_to_dicts(data["session_slots"])
        # Derive time_slot from precise time when present
        for slot in slots_dicts:
            if slot.get("time"):
                slot["time_slot"] = _derive_time_slot(slot["time"])
        appt.session_slots = slots_dicts
        appt.starts_at = _compute_starts_at(slots_dicts)
        appt.session_type_ids = _compute_session_type_ids(slots_dicts)
        data.pop("session_slots")
        data.pop("starts_at", None)
        data.pop("session_type_ids", None)
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend && source venv/bin/activate && pytest tests/test_routers_appointments.py -v 2>&1 | tail -20
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app && git add backend/schemas/appointments.py backend/services/appointments.py backend/tests/test_routers_appointments.py
git commit -m "feat(appointments): optional precise time per slot, derives time_slot and starts_at"
```

---

## Task 2: Frontend — Schema + slot builder time input + overlap warning

**Files:**
- Modify: `frontend/src/schemas/appointments.ts`
- Modify: `frontend/src/pages/admin/Appointments.tsx`

- [ ] **Step 1: Update `frontend/src/schemas/appointments.ts`**

Add `time` to `SessionSlotSchema`:

```typescript
import { z } from 'zod'

const VALID_STATUSES = ['pending', 'confirmed', 'cancelled'] as const
const VALID_ADDONS = ['album', 'thank_you_card', 'enlarged_photos'] as const
const VALID_TIME_SLOTS = ['morning', 'afternoon', 'evening', 'all_day'] as const

export const SessionSlotSchema = z.object({
  session_type_id: z.string().uuid(),
  date: z.string(),           // "YYYY-MM-DD"
  time_slot: z.enum(VALID_TIME_SLOTS),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),  // HH:MM
})

export type SessionSlot = z.infer<typeof SessionSlotSchema>

export const SessionTypeSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

export const AppointmentSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  session_slots: z.array(SessionSlotSchema),
  session_type_ids: z.array(z.string().uuid()),
  session_time: z.string().nullable(),
  session_types: z.array(SessionTypeSummarySchema),
  title: z.string(),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
  location: z.string().nullable(),
  status: z.enum(VALID_STATUSES),
  addons: z.array(z.enum(VALID_ADDONS)),
  deposit_paid: z.boolean(),
  deposit_amount: z.string(),
  deposit_account_id: z.string().uuid().nullable(),
  contract_signed: z.boolean(),
  price: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
})

export type Appointment = z.infer<typeof AppointmentSchema>

export const AppointmentListSchema = z.array(AppointmentSchema)
```

- [ ] **Step 2: Read `frontend/src/pages/admin/Appointments.tsx`**

Read the full file before making any changes. Locate:
1. `SessionSlotFormSchema` — the per-slot Zod schema used in the form
2. The `slotFields.map(...)` JSX block — the slot builder rows
3. `useFieldArray` call and helpers (`isDateAllowed`, `getAvailableDays`, `DAY_NAMES`)
4. Where `useAppointments` (or `useAdminAppointments`) is called at the top of the component

- [ ] **Step 3: Update `SessionSlotFormSchema` in `Appointments.tsx`**

Add `time` to the slot schema (find and update — do NOT change anything else):

```tsx
const SessionSlotFormSchema = z.object({
  session_type_id: z.string().uuid('Select a session type'),
  date: z.string().min(1, 'Date is required'),
  time_slot: z.enum(['morning', 'afternoon', 'evening', 'all_day']),
  time: z.string().optional(),
})
```

- [ ] **Step 4: Add `deriveTimeSlot` helper in `Appointments.tsx`**

Add this function just above or just below `isDateAllowed` (both are module-level or component-level helpers — keep them together):

```tsx
function deriveTimeSlot(time: string): 'morning' | 'afternoon' | 'evening' {
  const h = parseInt(time.split(':')[0], 10)
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
```

- [ ] **Step 5: Add `useAppointments` data access inside the modal**

Inside the modal component (where `useFieldArray` is called), add:

```tsx
const { data: allAppointments = [] } = useAppointments()
```

This uses the TanStack Query cache — no extra network request if the appointments page already loaded them.

Check that `useAppointments` is already imported from the hooks file. If the hook is named differently (e.g. `useAdminAppointments`), use the correct name.

- [ ] **Step 6: Update slot builder JSX — add time input and conditional time_slot display**

Inside `slotFields.map((field, index) => { ... })`, after the existing variables (`slotTypeId`, `slotDate`, `availDays`, `dateAllowed`), add:

```tsx
const slotTime = watch(`session_slots.${index}.time`) ?? ''
const slotTimeSlot = watch(`session_slots.${index}.time_slot`)

// Overlap: another appointment (not the one being edited) has a slot on the same date+time_slot
const overlappingAppts = slotDate && slotTimeSlot
  ? allAppointments.filter(a =>
      a.id !== appointment?.id &&
      a.session_slots.some(s => s.date === slotDate && s.time_slot === slotTimeSlot)
    )
  : []
```

In the slot row JSX, add the time input **between the date input div and the time_slot Select div**:

```tsx
{/* Precise time (optional) */}
<div className="w-[120px]">
  <Input
    type="time"
    value={slotTime}
    onChange={(e) => {
      const t = e.target.value
      setValue(`session_slots.${index}.time`, t || undefined)
      if (t) {
        setValue(`session_slots.${index}.time_slot`, deriveTimeSlot(t))
      }
    }}
    className="bg-input border text-foreground h-9 text-sm"
  />
</div>
```

Replace the existing time_slot Select div with a conditional:

```tsx
{/* Time of day — hidden when precise time is set */}
{!slotTime ? (
  <div className="w-[130px]">
    <Select
      value={slotTimeSlot}
      onValueChange={(v) => setValue(`session_slots.${index}.time_slot`, v as 'morning' | 'afternoon' | 'evening' | 'all_day')}
    >
      <SelectTrigger className="bg-input border text-foreground h-9 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-popover border text-popover-foreground">
        <SelectItem value="morning">Morning</SelectItem>
        <SelectItem value="afternoon">Afternoon</SelectItem>
        <SelectItem value="evening">Evening</SelectItem>
        <SelectItem value="all_day">All Day</SelectItem>
      </SelectContent>
    </Select>
  </div>
) : (
  <div className="w-[130px] h-9 flex items-center px-2 rounded-md border border-border bg-muted/30 text-sm text-muted-foreground capitalize">
    {deriveTimeSlot(slotTime)}
  </div>
)}
```

Add the overlap warning **below the slot row div** (after the remove button, before the closing `</div>` of the row):

```tsx
{overlappingAppts.length > 0 && (
  <p className="text-xs text-yellow-500 mt-1 px-1">
    ⚠ Overlaps with: {overlappingAppts.map(a => `"${a.title}"`).join(', ')} ({slotTimeSlot}, {slotDate})
  </p>
)}
```

- [ ] **Step 7: Update `defaultValues` and `reset()` to include `time`**

In the `defaultValues` for edit mode, include `time` from existing slots:

```tsx
session_slots: appointment.session_slots.length > 0
  ? appointment.session_slots.map(s => ({
      session_type_id: s.session_type_id,
      date: s.date,
      time_slot: s.time_slot as 'morning' | 'afternoon' | 'evening' | 'all_day',
      time: s.time ?? undefined,
    }))
  : [{ session_type_id: '', date: '', time_slot: 'morning' as const, time: undefined }],
```

In the `reset()` for new appointment:
```tsx
session_slots: [{ session_type_id: '', date: '', time_slot: 'morning' as const, time: undefined }],
```

In the `appendSlot` call (the "Add session type" button):
```tsx
appendSlot({ session_type_id: '', date: firstDate, time_slot: 'morning', time: undefined })
```

- [ ] **Step 8: Build check**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend && npm run build 2>&1 | grep "error TS" | head -20
```

Expected: 0 TypeScript errors. Fix any that appear in `Appointments.tsx` or `appointments.ts`.

- [ ] **Step 9: Run frontend tests**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend && npm run test 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 10: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app && git add frontend/src/schemas/appointments.ts frontend/src/pages/admin/Appointments.tsx
git commit -m "feat(appointments-form): optional precise time input per slot with overlap warning"
```

---

## Self-Review

**Spec coverage:**
- ✅ `time: Optional[str]` added to `SessionSlot` with HH:MM validator
- ✅ `_derive_time_slot` helper, called on create + update
- ✅ `_compute_starts_at` uses slot time when present
- ✅ Frontend schema updated
- ✅ Time input in slot builder, hides time_slot Select when filled
- ✅ Overlap warning shown inline
- ✅ Client portal / `BookSession.tsx` unchanged
- ✅ Calendar/scheduler benefit automatically via correct `starts_at`

**Type consistency:**
- `deriveTimeSlot` returns `'morning' | 'afternoon' | 'evening'` — compatible with `time_slot` field (which also accepts `'all_day'`; setting to derived value is always safe)
- `time: undefined` used consistently in `appendSlot`, `defaultValues`, `reset()` — correct for optional Zod field
