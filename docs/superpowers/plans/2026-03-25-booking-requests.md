# Booking Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-side booking requests: backend router + model, frontend data layer, and a "Requests" tab inside the existing Appointments page with confirm (pre-fill appointment modal) and reject (notes modal) flows.

**Architecture:** The `booking_requests` table and its enums (`time_slot`, `booking_request_status`) already exist in the DB — created by `migrations/004_client_portal.sql`. No new migration needed. Backend: SQLAlchemy model + Pydantic schemas + FastAPI router with inline queries (following the notifications router pattern — no separate service layer; the spec listed a service file but this codebase uses service layers only for complex multi-step logic, not simple CRUD). Frontend: Zod schema + API + hooks + Requests tab added to `Appointments.tsx`, with minimal non-breaking changes to `AppointmentModal` (add `prefill?` and `onCreated?` props).

**Notes on spec deviations:**
- The spec lists `backend/services/booking_requests.py` — omitted intentionally; the router is as simple as the notifications router (2 endpoints, inline queries).
- The spec mentions `starts_at` should default to a clock time by slot. The appointment form uses `type="date"` (date only, no time picker). The time-of-day preference is captured via the existing `session_time` radio (morning/afternoon/evening). `all_day` time_slot maps to `session_time: undefined` (no preference). This is the correct form behavior.
- The spec says unauthenticated requests return 401. FastAPI's `HTTPBearer()` scheme returns 403 when no Authorization header is present (confirmed by `tests/test_auth_dependency.py`). Tests assert 403.

**Tech Stack:** FastAPI, SQLAlchemy async, Pydantic v2, React 18, TypeScript strict, TanStack Query, shadcn/ui, Zod, date-fns

---

## File Map

| File | Change |
|---|---|
| `backend/models/booking_request.py` | New — SQLAlchemy model |
| `backend/schemas/booking_request.py` | New — Pydantic schemas |
| `backend/routers/booking_requests.py` | New — GET list + PATCH confirm/reject |
| `backend/main.py` | Mount booking requests router |
| `backend/tests/test_routers_booking_requests.py` | New — integration tests |
| `frontend/src/schemas/bookingRequests.ts` | New — Zod schema + type |
| `frontend/src/api/bookingRequests.ts` | New — API functions |
| `frontend/src/hooks/useBookingRequests.ts` | New — TanStack Query hooks |
| `frontend/src/pages/admin/Appointments.tsx` | Add Requests tab + AppointmentModal prefill support |

---

### Task 1: Backend model, schemas, router, and main.py wiring

**Files:**
- Create: `backend/models/booking_request.py`
- Create: `backend/schemas/booking_request.py`
- Create: `backend/routers/booking_requests.py`
- Modify: `backend/main.py`

> The `booking_requests` table, `time_slot` enum, and `booking_request_status` enum already exist in the database (migration `004_client_portal.sql`). Use `create_type=False` in SQLAlchemy enums to avoid re-creating them.

- [ ] **Step 1: Create the SQLAlchemy model**

Create `backend/models/booking_request.py`:

```python
import uuid
from sqlalchemy import Column, Text, ForeignKey, DateTime, Date, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from models.base import Base


class BookingRequest(Base):
    __tablename__ = "booking_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    preferred_date = Column(Date, nullable=False)
    time_slot = Column(
        SAEnum("morning", "afternoon", "evening", "all_day", name="time_slot", create_type=False),
        nullable=False,
    )
    session_type_id = Column(UUID(as_uuid=True), ForeignKey("session_types.id", ondelete="SET NULL"), nullable=True)
    addons = Column(ARRAY(Text), nullable=False, server_default="{}")
    message = Column(Text, nullable=True)
    status = Column(
        SAEnum("pending", "confirmed", "rejected", name="booking_request_status", create_type=False),
        nullable=False,
        server_default="pending",
    )
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    client = relationship("Client", lazy="select")
```

- [ ] **Step 2: Create Pydantic schemas**

Create `backend/schemas/booking_request.py`:

```python
import uuid
from datetime import date, datetime
from typing import Literal, Optional
from pydantic import BaseModel


class BookingRequestOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    preferred_date: date
    time_slot: str
    session_type_id: Optional[uuid.UUID]
    addons: list[str]
    message: Optional[str]
    status: str
    admin_notes: Optional[str]
    created_at: datetime
    updated_at: datetime


class BookingRequestUpdate(BaseModel):
    status: Literal["confirmed", "rejected"]
    admin_notes: Optional[str] = None
```

- [ ] **Step 3: Create the router**

Create `backend/routers/booking_requests.py`:

```python
import logging
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func as sqlfunc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from models.booking_request import BookingRequest
from models.client import Client
from schemas.booking_request import BookingRequestOut, BookingRequestUpdate
from services.email import send_email

logger = logging.getLogger(__name__)
router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


def _to_out(req: BookingRequest, client_name: str) -> BookingRequestOut:
    return BookingRequestOut(
        id=req.id,
        client_id=req.client_id,
        client_name=client_name,
        preferred_date=req.preferred_date,
        time_slot=req.time_slot,
        session_type_id=req.session_type_id,
        addons=req.addons or [],
        message=req.message,
        status=req.status,
        admin_notes=req.admin_notes,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )


@router.get("/booking-requests", response_model=list[BookingRequestOut])
async def list_booking_requests(
    db: DB,
    _: Admin,
    status: Optional[str] = Query("pending"),
):
    q = (
        select(BookingRequest, Client.name.label("client_name"))
        .join(Client, BookingRequest.client_id == Client.id)
        .order_by(BookingRequest.created_at.desc())
    )
    if status:
        q = q.where(BookingRequest.status == status)
    result = await db.execute(q)
    return [_to_out(req, name) for req, name in result.all()]


@router.patch("/booking-requests/{id}", response_model=BookingRequestOut)
async def update_booking_request(
    id: uuid.UUID,
    body: BookingRequestUpdate,
    db: DB,
    _: Admin,
):
    result = await db.execute(
        select(BookingRequest, Client.name.label("client_name"), Client.email.label("client_email"))
        .join(Client, BookingRequest.client_id == Client.id)
        .where(BookingRequest.id == id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Booking request not found")

    req, client_name, client_email = row
    req.status = body.status
    req.admin_notes = body.admin_notes
    req.updated_at = sqlfunc.now()
    await db.flush()

    # Send client email — log and continue on failure
    try:
        if body.status == "confirmed":
            await send_email(
                to=client_email,
                subject="Your booking request has been confirmed",
                html=(
                    f"<p>Hi {client_name},</p>"
                    f"<p>Your booking request for <strong>{req.preferred_date}</strong> has been confirmed.</p>"
                    + (f"<p>{body.admin_notes}</p>" if body.admin_notes else "")
                    + "<p>Log in to your portal to view your job details.</p>"
                ),
            )
        else:
            await send_email(
                to=client_email,
                subject="Update on your booking request",
                html=(
                    f"<p>Hi {client_name},</p>"
                    f"<p>Unfortunately your booking request for <strong>{req.preferred_date}</strong> could not be confirmed.</p>"
                    + (f"<p>{body.admin_notes}</p>" if body.admin_notes else "")
                    + "<p>Feel free to submit a new request at a different date.</p>"
                ),
            )
    except Exception:
        logger.warning("Failed to send booking %s email to %s", body.status, client_email)

    return _to_out(req, client_name)
```

- [ ] **Step 4: Mount the router in main.py**

In `backend/main.py`, add after the existing imports and `include_router` calls:

```python
from routers.booking_requests import router as booking_requests_router
```

And:
```python
app.include_router(booking_requests_router, prefix="/api", tags=["booking-requests"])
```

- [ ] **Step 5: Verify the backend starts without errors**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
source venv/bin/activate
python -c "from main import app; print('OK')"
```

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/models/booking_request.py backend/schemas/booking_request.py \
        backend/routers/booking_requests.py backend/main.py
git commit -m "feat: add booking requests backend (model, schema, router)"
```

---

### Task 2: Backend tests

**Files:**
- Create: `backend/tests/test_routers_booking_requests.py`

> Use the `test_client` + `admin_auth_headers` + `db_session` + `admin_user` fixtures from `conftest.py`. Create test data inline (same pattern as `test_routers_notifications.py`). The `test_client` fixture overrides `get_db` so the router uses the same transaction-isolated session.

- [ ] **Step 1: Write the tests**

Create `backend/tests/test_routers_booking_requests.py`:

```python
import uuid
import pytest
from models.client import Client
from models.booking_request import BookingRequest


async def make_client(db_session) -> Client:
    client = Client(
        name="Test Client",
        email=f"client_{uuid.uuid4().hex[:8]}@test.internal",
    )
    db_session.add(client)
    await db_session.flush()
    return client


async def make_request(db_session, client_id, status="pending") -> BookingRequest:
    req = BookingRequest(
        client_id=client_id,
        preferred_date="2026-06-15",
        time_slot="morning",
        addons=[],
        status=status,
    )
    db_session.add(req)
    await db_session.flush()
    return req


@pytest.mark.asyncio
async def test_list_booking_requests_empty(test_client, admin_auth_headers):
    resp = await test_client.get("/api/booking-requests", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_booking_requests_returns_pending(test_client, admin_auth_headers, db_session):
    client = await make_client(db_session)
    await make_request(db_session, client.id, status="pending")
    await make_request(db_session, client.id, status="confirmed")

    resp = await test_client.get("/api/booking-requests?status=pending", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["status"] == "pending"
    assert data[0]["client_name"] == "Test Client"


@pytest.mark.asyncio
async def test_list_booking_requests_status_filter(test_client, admin_auth_headers, db_session):
    client = await make_client(db_session)
    await make_request(db_session, client.id, status="confirmed")

    resp = await test_client.get("/api/booking-requests?status=confirmed", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_confirm_booking_request(test_client, admin_auth_headers, db_session):
    client = await make_client(db_session)
    req = await make_request(db_session, client.id)

    resp = await test_client.patch(
        f"/api/booking-requests/{req.id}",
        json={"status": "confirmed", "admin_notes": "See you at 9am!"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "confirmed"
    assert data["admin_notes"] == "See you at 9am!"


@pytest.mark.asyncio
async def test_reject_booking_request(test_client, admin_auth_headers, db_session):
    client = await make_client(db_session)
    req = await make_request(db_session, client.id)

    resp = await test_client.patch(
        f"/api/booking-requests/{req.id}",
        json={"status": "rejected", "admin_notes": "Fully booked that week"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "rejected"
    assert data["admin_notes"] == "Fully booked that week"


@pytest.mark.asyncio
async def test_update_booking_request_not_found(test_client, admin_auth_headers):
    resp = await test_client.patch(
        f"/api/booking-requests/{uuid.uuid4()}",
        json={"status": "confirmed"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_booking_requests_unauthenticated(test_client):
    resp = await test_client.get("/api/booking-requests")
    assert resp.status_code == 403
```

- [ ] **Step 2: Run the tests to verify they pass**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
source venv/bin/activate
python -m pytest tests/test_routers_booking_requests.py -v --tb=short 2>&1
```

Expected: 7 tests PASSED (email calls will fail gracefully in tests — the endpoint still returns 200)

> **Note:** If email send attempts cause test failures (Resend not configured in test env), the router already catches all exceptions and logs them. Tests should pass regardless.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_routers_booking_requests.py
git commit -m "test: add booking requests router integration tests"
```

---

### Task 3: Frontend data layer

**Files:**
- Create: `frontend/src/schemas/bookingRequests.ts`
- Create: `frontend/src/api/bookingRequests.ts`
- Create: `frontend/src/hooks/useBookingRequests.ts`

- [ ] **Step 1: Create the Zod schema**

Create `frontend/src/schemas/bookingRequests.ts`:

```ts
import { z } from 'zod'

export const BookingRequestSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  client_name: z.string(),
  preferred_date: z.string(),
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

- [ ] **Step 2: Create the API functions**

Create `frontend/src/api/bookingRequests.ts`:

```ts
import { api } from '@/lib/axios'
import {
  BookingRequestSchema,
  BookingRequestListSchema,
  type BookingRequest,
} from '@/schemas/bookingRequests'

export async function fetchBookingRequests(status = 'pending'): Promise<BookingRequest[]> {
  const { data } = await api.get('/api/booking-requests', { params: { status } })
  return BookingRequestListSchema.parse(data)
}

export async function updateBookingRequest(
  id: string,
  payload: { status: 'confirmed' | 'rejected'; admin_notes?: string },
): Promise<BookingRequest> {
  const { data } = await api.patch(`/api/booking-requests/${id}`, payload)
  return BookingRequestSchema.parse(data)
}
```

- [ ] **Step 3: Create the hooks**

Create `frontend/src/hooks/useBookingRequests.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchBookingRequests, updateBookingRequest } from '@/api/bookingRequests'

export function useBookingRequests(status = 'pending') {
  return useQuery({
    queryKey: ['booking-requests', status],
    queryFn: () => fetchBookingRequests(status),
  })
}

export function useUpdateBookingRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; status: 'confirmed' | 'rejected'; admin_notes?: string }) =>
      updateBookingRequest(id, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] })
      toast.success(vars.status === 'confirmed' ? 'Booking confirmed' : 'Booking rejected')
    },
    onError: () => toast.error('Failed to update booking request'),
  })
}
```

- [ ] **Step 4: Lint check**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm run lint 2>&1 | grep -E "bookingRequest|BookingRequest" | head -10
```

Expected: no errors for the new files.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/schemas/bookingRequests.ts \
        frontend/src/api/bookingRequests.ts \
        frontend/src/hooks/useBookingRequests.ts
git commit -m "feat: add booking requests frontend data layer (schema, api, hooks)"
```

---

### Task 4: Requests tab in Appointments.tsx

**Files:**
- Modify: `frontend/src/pages/admin/Appointments.tsx`

This task makes two independent changes to `Appointments.tsx`:
1. Add `prefill?` and `onCreated?` props to `AppointmentModal` so it can be opened pre-filled from a booking request confirm action.
2. Add the `Requests` tab with a table, confirm flow, and reject modal.

> Read the full file before editing. The `AppointmentModal` interface is at line 114. The `Appointments` export is at line 418.

- [ ] **Step 1: Add prefill + onCreated support to AppointmentModal**

The `AppointmentModal` interface (currently at line ~114) only has `open`, `onClose`, `appointment?`. Extend it:

```tsx
interface AppointmentModalProps {
  open: boolean
  onClose: () => void
  appointment?: Appointment | null
  prefill?: Partial<AppointmentFormValues>
  onCreated?: () => void
}
```

Update the function signature to accept the new props:
```tsx
function AppointmentModal({ open, onClose, appointment, prefill, onCreated }: AppointmentModalProps) {
```

In the `useEffect` that resets the form (the `else` branch for new appointments, currently around line 173):
```tsx
} else {
  reset({
    status: 'pending',
    multi_day: false,
    session_type_ids: [],
    addon_album: false,
    addon_thank_you_card: false,
    addon_enlarged_photos: false,
    deposit_paid: false,
    contract_signed: false,
    ...prefill,
  })
}
```

In `onSubmit`, after `createMutation.mutateAsync(payload)` succeeds (around line 202):
```tsx
} else {
  await createMutation.mutateAsync(payload)
  onCreated?.()
}
```

Also add a read-only "Time slot preference" label inside the modal form — only rendered when `prefill?.session_time` is set. Place it below the session time radio buttons:
```tsx
{prefill?.session_time && (
  <p className="text-xs text-muted-foreground mt-1">
    Client preference: <span className="capitalize">{prefill.session_time}</span>
  </p>
)}
```

- [ ] **Step 2: Add imports, state, and tab logic to Appointments component**

At the top of the file, add imports:
```tsx
import { formatDistanceToNow, parseISO as parseDateISO } from 'date-fns'
import { useBookingRequests, useUpdateBookingRequest } from '@/hooks/useBookingRequests'
import type { BookingRequest } from '@/schemas/bookingRequests'
```

Inside `export function Appointments()`, add new state after existing state declarations:
```tsx
const [activeTab, setActiveTab] = useState<'appointments' | 'requests'>('appointments')
const [confirmingRequest, setConfirmingRequest] = useState<BookingRequest | null>(null)
const updateBookingRequest = useUpdateBookingRequest()
```

Add a memoized prefill derived from `confirmingRequest`:
```tsx
const requestPrefill = useMemo(() => {
  if (!confirmingRequest) return undefined
  return {
    starts_at: confirmingRequest.preferred_date,
    session_type_ids: confirmingRequest.session_type_id ? [confirmingRequest.session_type_id] : [],
    addon_album: confirmingRequest.addons.includes('album'),
    addon_thank_you_card: confirmingRequest.addons.includes('thank_you_card'),
    addon_enlarged_photos: confirmingRequest.addons.includes('enlarged_photos'),
    notes: confirmingRequest.message ?? undefined,
    session_time: confirmingRequest.time_slot === 'all_day'
      ? undefined
      : (confirmingRequest.time_slot as 'morning' | 'afternoon' | 'evening'),
    status: 'confirmed' as const,
  }
}, [confirmingRequest])
```

Add `useMemo` to the import from React:
```tsx
import { useState, useRef, useEffect, useMemo } from 'react'
```

Add handler for after appointment is created from a booking request. Import `toast` from `sonner` if not already imported in `Appointments.tsx`:
```tsx
const handleAppointmentCreated = () => {
  if (!confirmingRequest) return
  updateBookingRequest.mutate(
    { id: confirmingRequest.id, status: 'confirmed' },
    { onError: () => toast.error('Appointment created but could not confirm booking request') },
  )
  setConfirmingRequest(null)
}
```

Add confirm handler passed to the Requests tab:
```tsx
const handleConfirmRequest = (request: BookingRequest) => {
  setConfirmingRequest(request)
  setEditingAppointment(null)
  setModalOpen(true)
}
```

- [ ] **Step 3: Update the JSX — header, tab selector, conditional content**

In the return JSX, modify the header row so the Calendar/List toggle and New Appointment button only show on the appointments tab:

```tsx
<div className="flex items-center gap-3 flex-wrap">
  {activeTab === 'appointments' && (
    <>
      <div className="flex rounded-lg overflow-hidden border">
        <button onClick={() => setView('calendar')} className={...}>Calendar</button>
        <button onClick={() => setView('list')} className={...}>List</button>
      </div>
      <Button onClick={openCreate}>
        <Plus className="h-4 w-4 mr-1" />
        New Appointment
      </Button>
    </>
  )}
</div>
```

Add a tab selector row after the header `<div>` and before the calendar/list content:

```tsx
<div className="flex rounded-lg overflow-hidden border w-fit">
  <button
    onClick={() => setActiveTab('appointments')}
    className={`px-3 py-1.5 text-sm ${activeTab === 'appointments' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
  >
    Appointments
  </button>
  <button
    onClick={() => setActiveTab('requests')}
    className={`px-3 py-1.5 text-sm ${activeTab === 'requests' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
  >
    Requests
  </button>
</div>
```

Wrap the existing calendar/list content in `{activeTab === 'appointments' && (...)}` and add the requests tab below:

```tsx
{activeTab === 'appointments' ? (
  <>
    {/* existing calendar + list view JSX unchanged */}
  </>
) : (
  <RequestsTab onConfirm={handleConfirmRequest} />
)}
```

Update `AppointmentModal` usage to pass new props:

```tsx
<AppointmentModal
  open={modalOpen}
  onClose={() => { setModalOpen(false); setConfirmingRequest(null) }}
  appointment={editingAppointment}
  prefill={requestPrefill}
  onCreated={confirmingRequest ? handleAppointmentCreated : undefined}
/>
```

- [ ] **Step 4: Add the RequestsTab component**

Add this component **before** the `Appointments` export function (alongside `AppointmentModal` and `ClientCombobox`):

```tsx
const STATUS_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  all_day: 'All Day',
}

const ADDON_LABELS: Record<string, string> = {
  album: 'Album',
  thank_you_card: 'Thank You Card',
  enlarged_photos: 'Enlarged Photos',
}

function RequestsTab({ onConfirm }: { onConfirm: (r: BookingRequest) => void }) {
  const [statusFilter, setStatusFilter] = useState<'pending' | 'confirmed' | 'rejected'>('pending')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const { data: requests = [], isLoading } = useBookingRequests(statusFilter)
  const { data: sessionTypes = [] } = useSessionTypes()
  const updateRequest = useUpdateBookingRequest()

  const sessionTypeName = (id: string | null) =>
    id ? (sessionTypes.find(st => st.id === id)?.name ?? '—') : '—'

  const handleReject = () => {
    if (!rejectingId) return
    updateRequest.mutate(
      { id: rejectingId, status: 'rejected', admin_notes: rejectNotes || undefined },
      {
        onSettled: () => {
          setRejectingId(null)
          setRejectNotes('')
        },
      },
    )
  }

  const FILTERS = ['pending', 'confirmed', 'rejected'] as const

  if (isLoading) return null

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex rounded-lg overflow-hidden border w-fit">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 text-sm capitalize ${statusFilter === f ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl bg-card border overflow-hidden">
        {requests.length === 0 ? (
          <p className="p-6 text-sm text-center text-muted-foreground">No {statusFilter} requests.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border">
              <tr className="text-left">
                <th className="px-4 py-3 text-muted-foreground font-medium">Client</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Preferred Date</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Time Slot</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Session Type</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Add-ons</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Message</th>
                <th className="px-4 py-3 text-muted-foreground font-medium">Submitted</th>
                {statusFilter === 'pending' && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map(r => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{r.client_name}</td>
                  <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">
                    {format(parseDateISO(r.preferred_date + 'T00:00:00'), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-foreground/80">{STATUS_LABELS[r.time_slot] ?? r.time_slot}</td>
                  <td className="px-4 py-3 text-muted-foreground">{sessionTypeName(r.session_type_id)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.addons.length > 0 ? r.addons.map(a => ADDON_LABELS[a] ?? a).join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px]">
                    {r.message
                      ? <span title={r.message}>{r.message.length > 60 ? r.message.slice(0, 60) + '…' : r.message}</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </td>
                  {statusFilter === 'pending' && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => onConfirm(r)}>Confirm</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setRejectingId(r.id); setRejectNotes('') }}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject modal */}
      <Dialog open={!!rejectingId} onOpenChange={(o) => { if (!o) { setRejectingId(null); setRejectNotes('') } }}>
        <DialogContent className="bg-card border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject booking request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reject-notes">Notes to client (optional)</Label>
              <textarea
                id="reject-notes"
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                rows={3}
                placeholder="Reason for rejection…"
                className="w-full mt-1 rounded-md bg-input border text-foreground px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => { setRejectingId(null); setRejectNotes('') }}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={updateRequest.isPending}
                onClick={handleReject}
              >
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 5: Lint check**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm run lint 2>&1 | grep -E "Appointments|error" | grep -v "node_modules" | head -20
```

Expected: No new errors introduced by the changes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/Appointments.tsx
git commit -m "feat: add Requests tab to Appointments page with confirm/reject booking flow"
```
