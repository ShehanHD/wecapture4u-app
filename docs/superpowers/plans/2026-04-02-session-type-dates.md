# Session Type Available Days & Per-Slot Scheduling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow each session type to have configurable available days, and restructure appointments + booking requests to hold one slot (date + time of day) per session type instead of a single shared date.

**Architecture:** Add `available_days INTEGER[]` to `session_types`. Add `session_slots JSONB` to `appointments` and `booking_requests`. The service layer derives `starts_at` and `session_type_ids` from slots on every write so the calendar and scheduler keep working unchanged.

**Tech Stack:** Python/FastAPI/SQLAlchemy (backend), React/TypeScript/TanStack Query/react-hook-form/Zod (frontend)

---

## File Map

**Create:**
- `migrations/015_session_type_slots.sql`

**Modify (backend):**
- `backend/models/session_type.py` — add `available_days`
- `backend/models/appointment.py` — add `session_slots`
- `backend/models/booking_request.py` — add `session_slots`
- `backend/schemas/appointments.py` — add `SessionSlot`, update `AppointmentCreate/Update/Out`
- `backend/schemas/settings.py` — add `available_days` to session type schemas
- `backend/schemas/booking_request.py` — add `session_slots` to `BookingRequestOut`
- `backend/schemas/client_portal.py` — update `SessionTypeOut`, `ClientBookingRequestCreate/Out`
- `backend/services/settings.py` — pass `available_days` on create/update
- `backend/services/appointments.py` — derive `starts_at` + `session_type_ids` from slots
- `backend/routers/settings.py` — pass `available_days` to service
- `backend/routers/client_portal.py` — expose `available_days` on session types; use slots for booking requests
- `backend/tests/test_routers_appointments.py` — update existing tests + add slot tests

**Modify (frontend):**
- `frontend/src/schemas/settings.ts` — add `available_days` to `SessionTypeSchema`
- `frontend/src/schemas/appointments.ts` — add `SessionSlotSchema`, update `AppointmentSchema`
- `frontend/src/schemas/bookingRequests.ts` — add `session_slots` to `BookingRequestSchema`
- `frontend/src/schemas/clientPortal.ts` — update `SessionTypeSchema` and `ClientBookingRequestSchema`
- `frontend/src/api/settings.ts` — update `updateSessionType` signature
- `frontend/src/hooks/useSettings.ts` — update `useUpdateSessionType` mutation
- `frontend/src/pages/admin/Settings.tsx` — add day toggles to `SessionTypeRow`
- `frontend/src/pages/admin/Appointments.tsx` — replace date/session fields with slot builder
- `frontend/src/pages/client/BookSession.tsx` — replace single-slot form with slot builder
- `frontend/src/pages/client/Dashboard.tsx` — update `RequestCard` to show slots

---

## Task 1: DB Migration

**Files:**
- Create: `migrations/015_session_type_slots.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- migrations/015_session_type_slots.sql

-- Session types: which days of the week are available
-- 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday
-- Empty array means no restriction (all days allowed)
ALTER TABLE session_types
  ADD COLUMN IF NOT EXISTS available_days INTEGER[] NOT NULL DEFAULT '{}';

-- Appointments: per-session-type slots
-- Each element: {"session_type_id": "uuid", "date": "YYYY-MM-DD", "time_slot": "morning|afternoon|evening|all_day"}
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS session_slots JSONB NOT NULL DEFAULT '[]';

-- Booking requests: per-session-type slots (same shape as appointments)
ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS session_slots JSONB NOT NULL DEFAULT '[]';
```

- [ ] **Step 2: Apply the migration**

Run in your Supabase SQL editor or via psql:
```
psql $DATABASE_URL -f migrations/015_session_type_slots.sql
```

Expected: no errors, three `ALTER TABLE` statements complete.

- [ ] **Step 3: Commit**

```bash
git add migrations/015_session_type_slots.sql
git commit -m "feat(db): add session_slots to appointments/booking_requests, available_days to session_types"
```

---

## Task 2: Backend — SessionType available_days

**Files:**
- Modify: `backend/models/session_type.py`
- Modify: `backend/schemas/settings.py`
- Modify: `backend/services/settings.py`
- Modify: `backend/routers/settings.py`

- [ ] **Step 1: Write failing test**

Add to `backend/tests/test_routers_settings.py` (create if it doesn't exist):

```python
import pytest

@pytest.mark.asyncio
async def test_session_type_available_days(test_client, admin_auth_headers):
    resp = await test_client.post(
        "/api/session-types",
        json={"name": "Newborn", "available_days": [0, 2, 4]},  # Mon, Wed, Fri
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["available_days"] == [0, 2, 4]

    # Update available_days only
    resp2 = await test_client.patch(
        f"/api/session-types/{data['id']}",
        json={"available_days": [5, 6]},  # Sat, Sun
        headers=admin_auth_headers,
    )
    assert resp2.status_code == 200
    assert resp2.json()["available_days"] == [5, 6]

    # List returns available_days
    resp3 = await test_client.get("/api/session-types", headers=admin_auth_headers)
    assert resp3.status_code == 200
    match = next((t for t in resp3.json() if t["id"] == data["id"]), None)
    assert match is not None
    assert match["available_days"] == [5, 6]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_routers_settings.py::test_session_type_available_days -v
```

Expected: FAIL (422 or field not in response)

- [ ] **Step 3: Update `backend/models/session_type.py`**

```python
import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID, ARRAY, INTEGER
from sqlalchemy.sql import func
from models.base import Base


class SessionType(Base):
    __tablename__ = "session_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    available_days = Column(ARRAY(INTEGER), nullable=False, server_default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

- [ ] **Step 4: Update `backend/schemas/settings.py`**

```python
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AppSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tax_enabled: bool
    tax_rate: str
    pdf_invoices_enabled: bool
    updated_at: datetime


class AppSettingsUpdate(BaseModel):
    tax_enabled: Optional[bool] = None
    tax_rate: Optional[str] = None
    pdf_invoices_enabled: Optional[bool] = None


class SessionTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    available_days: list[int]
    created_at: datetime


class SessionTypeCreate(BaseModel):
    name: str
    available_days: list[int] = []


class SessionTypeUpdate(BaseModel):
    name: Optional[str] = None
    available_days: Optional[list[int]] = None
```

- [ ] **Step 5: Update `backend/services/settings.py` — session type functions**

Replace the three session type service functions:

```python
async def create_session_type(
    db: AsyncSession, *, name: str, available_days: list[int] | None = None
) -> SessionType:
    st = SessionType(name=name, available_days=available_days or [])
    db.add(st)
    await db.flush()
    await db.refresh(st)
    return st


async def update_session_type(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    name: str | None = None,
    available_days: list[int] | None = None,
) -> SessionType:
    result = await db.execute(select(SessionType).where(SessionType.id == id))
    st = result.scalar_one_or_none()
    if st is None:
        raise HTTPException(status_code=404, detail="Session type not found")
    if name is not None:
        st.name = name
    if available_days is not None:
        st.available_days = available_days
    await db.flush()
    await db.refresh(st)
    return st
```

- [ ] **Step 6: Update `backend/routers/settings.py` — session type routes**

```python
@router.post("/session-types", response_model=SessionTypeOut, status_code=201)
async def create_session_type(body: SessionTypeCreate, db: DbDep, _: AdminDep):
    return await settings_svc.create_session_type(
        db, name=body.name, available_days=body.available_days
    )


@router.patch("/session-types/{id}", response_model=SessionTypeOut)
async def update_session_type(id: uuid.UUID, body: SessionTypeUpdate, db: DbDep, _: AdminDep):
    return await settings_svc.update_session_type(
        db, id=id, name=body.name, available_days=body.available_days
    )
```

- [ ] **Step 7: Run test to verify it passes**

```bash
cd backend && pytest tests/test_routers_settings.py::test_session_type_available_days -v
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/models/session_type.py backend/schemas/settings.py \
        backend/services/settings.py backend/routers/settings.py \
        backend/tests/test_routers_settings.py
git commit -m "feat(session-types): add available_days field"
```

---

## Task 3: Backend — Appointment session_slots

**Files:**
- Modify: `backend/models/appointment.py`
- Modify: `backend/schemas/appointments.py`
- Modify: `backend/services/appointments.py`
- Modify: `backend/tests/test_routers_appointments.py`

- [ ] **Step 1: Write failing tests**

Replace existing test body and add slot tests in `backend/tests/test_routers_appointments.py`:

```python
import pytest
from datetime import datetime, timezone
from uuid import uuid4


async def _make_client(db_session, name="Test"):
    from models.client import Client
    c = Client(name=name, email=f"{name.lower()}_{uuid4().hex[:8]}@example.com", tags=[])
    db_session.add(c)
    await db_session.flush()
    return c


async def _make_session_type(db_session, name="Portrait"):
    from models.session_type import SessionType
    st = SessionType(name=name, available_days=[])
    db_session.add(st)
    await db_session.flush()
    return st


@pytest.mark.asyncio
async def test_create_appointment_with_slots(test_client, admin_auth_headers, db_session):
    client = await _make_client(db_session)
    st = await _make_session_type(db_session)

    resp = await test_client.post(
        "/api/appointments",
        json={
            "client_id": str(client.id),
            "title": "Portrait session",
            "session_slots": [
                {"session_type_id": str(st.id), "date": "2026-07-01", "time_slot": "morning"}
            ],
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Portrait session"
    assert data["status"] == "pending"
    assert len(data["session_slots"]) == 1
    assert data["session_slots"][0]["date"] == "2026-07-01"
    assert data["session_slots"][0]["time_slot"] == "morning"
    # starts_at computed from slot date
    assert data["starts_at"].startswith("2026-07-01")
    # session_type_ids derived from slots
    assert str(st.id) in data["session_type_ids"]


@pytest.mark.asyncio
async def test_create_appointment_multiple_slots(test_client, admin_auth_headers, db_session):
    client = await _make_client(db_session, "Multi")
    st1 = await _make_session_type(db_session, "Newborn")
    st2 = await _make_session_type(db_session, "Maternity")

    resp = await test_client.post(
        "/api/appointments",
        json={
            "client_id": str(client.id),
            "title": "Bundle",
            "session_slots": [
                {"session_type_id": str(st1.id), "date": "2026-07-05", "time_slot": "morning"},
                {"session_type_id": str(st2.id), "date": "2026-07-03", "time_slot": "afternoon"},
            ],
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    # starts_at = earliest slot date (July 3)
    assert data["starts_at"].startswith("2026-07-03")
    assert len(data["session_slots"]) == 2


@pytest.mark.asyncio
async def test_delete_appointment_blocked_with_job(test_client, admin_auth_headers, db_session):
    from models.appointment import Appointment
    from models.job import Job, JobStage

    client = await _make_client(db_session, "Frank")
    stage = JobStage(name="Booked", color="#000", position=98)
    db_session.add(stage)
    await db_session.flush()

    appt = Appointment(
        client_id=client.id,
        title="Wedding",
        starts_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
        session_slots=[],
    )
    db_session.add(appt)
    await db_session.flush()

    job = Job(client_id=client.id, appointment_id=appt.id, stage_id=stage.id)
    db_session.add(job)
    await db_session.flush()

    resp = await test_client.delete(
        f"/api/appointments/{appt.id}", headers=admin_auth_headers
    )
    assert resp.status_code == 409
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_routers_appointments.py -v
```

Expected: FAIL on slot tests (422 unprocessable entity — `session_slots` not in schema yet)

- [ ] **Step 3: Update `backend/models/appointment.py`**

Add the `session_slots` column (add after `session_type_ids`):

```python
from sqlalchemy import JSON
# ... existing imports ...

class Appointment(Base):
    # ... existing columns ...
    session_slots = Column(JSON, nullable=False, server_default="'[]'::jsonb")
```

Full file — find the existing `session_type_ids` column line and add after it:
```python
session_slots = Column(JSON, nullable=False, server_default="'[]'::jsonb")
```

- [ ] **Step 4: Update `backend/schemas/appointments.py`**

Add `SessionSlot` model and update `AppointmentCreate`, `AppointmentUpdate`, `AppointmentOut`:

```python
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


class AppointmentCreate(BaseModel):
    client_id: uuid.UUID
    title: str
    session_slots: list[SessionSlot] = []
    location: Optional[str] = None
    status: str = "pending"
    addons: list[str] = []
    deposit_paid: bool = False
    deposit_amount: Decimal = Decimal("0")
    deposit_account_id: Optional[uuid.UUID] = None
    contract_signed: bool = False
    price: Decimal = Decimal("0")
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {VALID_STATUSES}")
        return v

    @field_validator("addons")
    @classmethod
    def addons_must_be_valid(cls, v: list[str]) -> list[str]:
        invalid = set(v) - VALID_ADDONS
        if invalid:
            raise ValueError(f"invalid addons: {invalid}. Must be subset of {VALID_ADDONS}")
        return v


class AppointmentUpdate(BaseModel):
    session_slots: Optional[list[SessionSlot]] = None
    title: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    addons: Optional[list[str]] = None
    deposit_paid: Optional[bool] = None
    deposit_amount: Optional[Decimal] = None
    deposit_account_id: Optional[uuid.UUID] = None
    contract_signed: Optional[bool] = None
    price: Optional[Decimal] = None
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {VALID_STATUSES}")
        return v


class SessionTypeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    session_slots: list[SessionSlot]
    session_type_ids: list[uuid.UUID]       # derived from slots, kept for calendar compat
    session_time: Optional[str]             # kept nullable for legacy rows
    session_types: list[SessionTypeSummary] # resolved by service
    title: str
    starts_at: datetime
    ends_at: Optional[datetime]
    location: Optional[str]
    status: str
    addons: list[str]
    deposit_paid: bool
    deposit_amount: str
    deposit_account_id: Optional[uuid.UUID]
    contract_signed: bool
    price: str
    notes: Optional[str]
    created_at: datetime
```

- [ ] **Step 5: Update `backend/services/appointments.py` — slot helpers + create/update**

Add two helper functions at the top of the file (after imports):

```python
from datetime import datetime, timezone

def _compute_starts_at(slots: list[dict]) -> datetime:
    """Return the earliest slot date as a UTC midnight datetime."""
    if not slots:
        return datetime.now(tz=timezone.utc)
    dates = sorted(slot["date"] for slot in slots)
    d = dates[0]  # "YYYY-MM-DD" string
    return datetime.fromisoformat(f"{d}T00:00:00+00:00")


def _compute_session_type_ids(slots: list[dict]) -> list[uuid.UUID]:
    return [uuid.UUID(str(slot["session_type_id"])) for slot in slots]


def _slots_to_dicts(slots: list) -> list[dict]:
    """Convert SessionSlot pydantic models or dicts to JSON-serialisable dicts."""
    result = []
    for s in slots:
        if hasattr(s, "model_dump"):
            d = s.model_dump()
            d["session_type_id"] = str(d["session_type_id"])
            d["date"] = str(d["date"])
        else:
            d = dict(s)
            d["session_type_id"] = str(d["session_type_id"])
            d["date"] = str(d["date"])
        result.append(d)
    return result
```

Update `create_appointment`:

```python
async def create_appointment(db: AsyncSession, *, data: dict) -> AppointmentOut:
    slots_raw = data.pop("session_slots", [])
    slots_dicts = _slots_to_dicts(slots_raw)
    data["session_slots"] = slots_dicts
    data["starts_at"] = _compute_starts_at(slots_dicts)
    data["session_type_ids"] = _compute_session_type_ids(slots_dicts)
    # Remove legacy fields that may come from old clients
    data.pop("session_time", None)
    data.pop("ends_at", None)

    appt = Appointment(**data)
    db.add(appt)
    await db.flush()
    if appt.status == "confirmed":
        await _auto_create_job(db, appt)
    return await _to_out(db, appt)
```

Update `update_appointment` — add slot recomputation before the `setattr` loop:

```python
async def update_appointment(db: AsyncSession, *, id: uuid.UUID, data: dict) -> AppointmentOut:
    # ... existing setup code ...

    if "session_slots" in data and data["session_slots"] is not None:
        slots_dicts = _slots_to_dicts(data["session_slots"])
        data["session_slots"] = slots_dicts
        data["starts_at"] = _compute_starts_at(slots_dicts)
        data["session_type_ids"] = _compute_session_type_ids(slots_dicts)

    for key, value in data.items():
        if value is not None:
            setattr(appt, key, value)
    # ... rest of existing logic unchanged ...
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_routers_appointments.py -v
```

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add backend/models/appointment.py backend/schemas/appointments.py \
        backend/services/appointments.py backend/tests/test_routers_appointments.py
git commit -m "feat(appointments): replace single date/time with per-slot session_slots"
```

---

## Task 4: Backend — Booking Request session_slots (client portal)

**Files:**
- Modify: `backend/models/booking_request.py`
- Modify: `backend/schemas/client_portal.py`
- Modify: `backend/routers/client_portal.py`

- [ ] **Step 1: Write failing test**

Add to `backend/tests/test_routers_client_portal.py` (create if it doesn't exist):

```python
import pytest
from uuid import uuid4


async def _make_client_user(db_session):
    from models.client import Client
    from models.user import User
    import bcrypt
    pw = bcrypt.hashpw(b"pass123", bcrypt.gensalt()).decode()
    user = User(email=f"client_{uuid4().hex[:8]}@test.com", hashed_password=pw, role="client")
    db_session.add(user)
    await db_session.flush()
    client = Client(name="Portal User", email=user.email, user_id=user.id, tags=[])
    db_session.add(client)
    await db_session.flush()
    return user, client


async def _client_token(test_client, email):
    resp = await test_client.post("/api/auth/client/login", json={"email": email, "password": "pass123"})
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_create_booking_request_with_slots(test_client, db_session):
    from models.session_type import SessionType
    user, _ = await _make_client_user(db_session)
    st = SessionType(name="Wedding", available_days=[5, 6])
    db_session.add(st)
    await db_session.flush()

    token = await _client_token(test_client, user.email)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await test_client.post(
        "/api/client/booking-requests",
        json={
            "session_slots": [
                {"session_type_id": str(st.id), "date": "2026-08-15", "time_slot": "morning"}
            ],
            "message": "Looking forward to it",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["session_slots"]) == 1
    assert data["session_slots"][0]["session_type_name"] == "Wedding"
    assert data["session_slots"][0]["date"] == "2026-08-15"
    # preferred_date computed from slot
    assert str(data["preferred_date"]) == "2026-08-15"


@pytest.mark.asyncio
async def test_session_types_include_available_days(test_client, db_session):
    from models.session_type import SessionType
    user, _ = await _make_client_user(db_session)
    st = SessionType(name="AvailTest", available_days=[1, 3])
    db_session.add(st)
    await db_session.flush()

    token = await _client_token(test_client, user.email)
    resp = await test_client.get(
        "/api/client/session-types",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    match = next((t for t in resp.json() if t["id"] == str(st.id)), None)
    assert match is not None
    assert 1 in match["available_days"]
    assert 3 in match["available_days"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_routers_client_portal.py -v
```

Expected: FAIL

- [ ] **Step 3: Update `backend/models/booking_request.py`**

Add `session_slots` column after `admin_notes`:

```python
from sqlalchemy import JSON
# ... existing imports ...

class BookingRequest(Base):
    # ... existing columns ...
    session_slots = Column(JSON, nullable=False, server_default="'[]'::jsonb")
```

- [ ] **Step 4: Update `backend/schemas/client_portal.py`**

```python
import uuid
from datetime import date, datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


class ClientProfileOut(BaseModel):
    name: str
    email: str
    phone: Optional[str]


class ClientProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    phone: Optional[str] = None


class ClientJobStageOut(BaseModel):
    id: uuid.UUID
    name: str
    color: str
    position: int


class ClientJobOut(BaseModel):
    id: uuid.UUID
    delivery_url: Optional[str]
    appointment_title: str
    appointment_starts_at: str
    stage_name: str
    stage_color: str


class ClientJobDetailOut(BaseModel):
    id: uuid.UUID
    delivery_url: Optional[str]
    appointment_title: str
    appointment_starts_at: str
    appointment_session_types: list[str]
    stage_id: uuid.UUID
    stage_name: str
    all_stages: list[ClientJobStageOut]


class SessionTypeOut(BaseModel):
    id: uuid.UUID
    name: str
    available_days: list[int]


class ClientBookingRequestSlot(BaseModel):
    session_type_id: uuid.UUID
    session_type_name: Optional[str]
    date: date
    time_slot: Literal["morning", "afternoon", "evening", "all_day"]


class ClientBookingRequestOut(BaseModel):
    id: uuid.UUID
    preferred_date: date
    session_slots: list[ClientBookingRequestSlot]
    # Legacy fields — kept for backwards compat, not written by new code
    time_slot: Optional[Literal["morning", "afternoon", "evening", "all_day"]]
    session_type_name: Optional[str]
    message: Optional[str]
    status: Literal["pending", "confirmed", "rejected"]
    admin_notes: Optional[str]
    created_at: datetime


class ClientBookingRequestCreate(BaseModel):
    session_slots: list["ClientBookingRequestSlotCreate"]
    message: Optional[str] = None


class ClientBookingRequestSlotCreate(BaseModel):
    session_type_id: uuid.UUID
    date: date
    time_slot: Literal["morning", "afternoon", "evening", "all_day"]
```

- [ ] **Step 5: Update `backend/routers/client_portal.py` — session types + booking requests**

Update `list_session_types`:

```python
@router.get("/session-types", response_model=list[SessionTypeOut])
async def list_session_types(db: DB, current_user: ClientUser) -> list[SessionTypeOut]:
    result = await db.execute(select(SessionType).order_by(SessionType.name))
    return [
        SessionTypeOut(id=st.id, name=st.name, available_days=st.available_days or [])
        for st in result.scalars().all()
    ]
```

Update `list_my_booking_requests`:

```python
@router.get("/booking-requests", response_model=list[ClientBookingRequestOut])
async def list_my_booking_requests(db: DB, current_user: ClientUser) -> list[ClientBookingRequestOut]:
    client = await _get_client(db, current_user.id)
    result = await db.execute(
        select(BookingRequest)
        .where(BookingRequest.client_id == client.id)
        .order_by(BookingRequest.created_at.desc())
    )
    requests = result.scalars().all()

    # Resolve session type names for all slots
    all_st_ids = {
        uuid.UUID(str(s["session_type_id"]))
        for req in requests
        for s in (req.session_slots or [])
    }
    st_map: dict[uuid.UUID, str] = {}
    if all_st_ids:
        st_result = await db.execute(
            select(SessionType).where(SessionType.id.in_(all_st_ids))
        )
        st_map = {st.id: st.name for st in st_result.scalars().all()}

    out = []
    for req in requests:
        slots = [
            ClientBookingRequestSlot(
                session_type_id=uuid.UUID(str(s["session_type_id"])),
                session_type_name=st_map.get(uuid.UUID(str(s["session_type_id"]))),
                date=s["date"],
                time_slot=s["time_slot"],
            )
            for s in (req.session_slots or [])
        ]
        out.append(ClientBookingRequestOut(
            id=req.id,
            preferred_date=req.preferred_date,
            session_slots=slots,
            time_slot=req.time_slot,
            session_type_name=None,
            message=req.message,
            status=req.status,
            admin_notes=req.admin_notes,
            created_at=req.created_at,
        ))
    return out
```

Update `create_booking_request`:

```python
@router.post("/booking-requests", response_model=ClientBookingRequestOut, status_code=201)
async def create_booking_request(
    body: ClientBookingRequestCreate, db: DB, current_user: ClientUser
) -> ClientBookingRequestOut:
    client = await _get_client(db, current_user.id)

    slots_dicts = [
        {
            "session_type_id": str(slot.session_type_id),
            "date": str(slot.date),
            "time_slot": slot.time_slot,
        }
        for slot in body.session_slots
    ]
    # preferred_date = earliest slot date (legacy column, kept for scheduler)
    preferred_date = min(slot.date for slot in body.session_slots)
    # time_slot = first slot's time_slot (legacy column)
    first_time_slot = body.session_slots[0].time_slot if body.session_slots else "morning"

    req = BookingRequest(
        client_id=client.id,
        preferred_date=preferred_date,
        time_slot=first_time_slot,
        session_type_id=None,
        session_slots=slots_dicts,
        message=body.message,
    )
    db.add(req)
    await db.flush()
    await db.refresh(req)

    # Resolve session type names
    st_ids = {uuid.UUID(str(s["session_type_id"])) for s in slots_dicts}
    st_result = await db.execute(select(SessionType).where(SessionType.id.in_(st_ids)))
    st_map = {st.id: st.name for st in st_result.scalars().all()}

    slots_out = [
        ClientBookingRequestSlot(
            session_type_id=uuid.UUID(str(s["session_type_id"])),
            session_type_name=st_map.get(uuid.UUID(str(s["session_type_id"]))),
            date=s["date"],
            time_slot=s["time_slot"],
        )
        for s in slots_dicts
    ]

    return ClientBookingRequestOut(
        id=req.id,
        preferred_date=req.preferred_date,
        session_slots=slots_out,
        time_slot=req.time_slot,
        session_type_name=None,
        message=req.message,
        status=req.status,
        admin_notes=req.admin_notes,
        created_at=req.created_at,
    )
```

Also add missing imports at the top of `client_portal.py`:
```python
from schemas.client_portal import (
    ClientBookingRequestCreate,
    ClientBookingRequestOut,
    ClientBookingRequestSlot,   # add this
    ...
)
```

- [ ] **Step 6: Run tests**

```bash
cd backend && pytest tests/test_routers_client_portal.py -v
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/models/booking_request.py backend/schemas/client_portal.py \
        backend/routers/client_portal.py backend/tests/test_routers_client_portal.py
git commit -m "feat(client-portal): booking requests and session types support session_slots"
```

---

## Task 5: Backend — Admin BookingRequest schema + router

**Files:**
- Modify: `backend/schemas/booking_request.py`
- Modify: `backend/routers/booking_requests.py`

- [ ] **Step 1: Update `backend/schemas/booking_request.py`**

```python
import uuid
from datetime import date, datetime
from typing import Literal, Optional
from pydantic import BaseModel
from schemas.appointments import SessionSlot


class BookingRequestOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    preferred_date: date
    time_slot: Literal["morning", "afternoon", "evening", "all_day"]
    session_type_id: Optional[uuid.UUID]
    session_slots: list[SessionSlot]
    addons: list[str]
    message: Optional[str]
    status: Literal["pending", "confirmed", "rejected"]
    admin_notes: Optional[str]
    created_at: datetime
    updated_at: datetime


class BookingRequestUpdate(BaseModel):
    status: Literal["confirmed", "rejected"]
    admin_notes: Optional[str] = None
```

- [ ] **Step 2: Update `_to_out` in `backend/routers/booking_requests.py`**

```python
def _to_out(req: BookingRequest, client_name: str) -> BookingRequestOut:
    from schemas.appointments import SessionSlot
    slots = [
        SessionSlot(
            session_type_id=s["session_type_id"],
            date=s["date"],
            time_slot=s["time_slot"],
        )
        for s in (req.session_slots or [])
    ]
    return BookingRequestOut(
        id=req.id,
        client_id=req.client_id,
        client_name=client_name,
        preferred_date=req.preferred_date,
        time_slot=req.time_slot,
        session_type_id=req.session_type_id,
        session_slots=slots,
        addons=req.addons or [],
        message=req.message,
        status=req.status,
        admin_notes=req.admin_notes,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )
```

- [ ] **Step 3: Run the full backend test suite**

```bash
cd backend && pytest -v
```

Expected: all existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/schemas/booking_request.py backend/routers/booking_requests.py
git commit -m "feat(booking-requests): expose session_slots in admin BookingRequestOut"
```

---

## Task 6: Frontend — Schema Updates

**Files:**
- Modify: `frontend/src/schemas/settings.ts`
- Modify: `frontend/src/schemas/appointments.ts`
- Modify: `frontend/src/schemas/bookingRequests.ts`
- Modify: `frontend/src/schemas/clientPortal.ts`

- [ ] **Step 1: Update `frontend/src/schemas/settings.ts`**

```typescript
import { z } from 'zod'
import { numericString } from '@/lib/zod'

export const AppSettingsSchema = z.object({
  id: z.number(),
  tax_enabled: z.boolean(),
  tax_rate: numericString,
  pdf_invoices_enabled: z.boolean(),
  updated_at: z.string(),
})

export type AppSettings = z.infer<typeof AppSettingsSchema>

export const SessionTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  available_days: z.array(z.number().int().min(0).max(6)),
  created_at: z.string(),
})

export type SessionType = z.infer<typeof SessionTypeSchema>

export const SessionTypeListSchema = z.array(SessionTypeSchema)
```

- [ ] **Step 2: Update `frontend/src/schemas/appointments.ts`**

```typescript
import { z } from 'zod'

const VALID_STATUSES = ['pending', 'confirmed', 'cancelled'] as const
const VALID_ADDONS = ['album', 'thank_you_card', 'enlarged_photos'] as const
const VALID_TIME_SLOTS = ['morning', 'afternoon', 'evening', 'all_day'] as const

export const SessionSlotSchema = z.object({
  session_type_id: z.string().uuid(),
  date: z.string(),           // "YYYY-MM-DD"
  time_slot: z.enum(VALID_TIME_SLOTS),
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
  session_type_ids: z.array(z.string().uuid()),   // derived, kept for calendar
  session_time: z.enum(['morning', 'afternoon', 'evening']).nullable(),  // legacy
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

- [ ] **Step 3: Update `frontend/src/schemas/bookingRequests.ts`**

Read the file first, then add `session_slots`. The file currently has a `BookingRequestSchema`. Add `SessionSlotSchema` import and `session_slots` field:

```typescript
import { z } from 'zod'
import { SessionSlotSchema } from '@/schemas/appointments'

export const BookingRequestSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  client_name: z.string(),
  preferred_date: z.string(),
  time_slot: z.enum(['morning', 'afternoon', 'evening', 'all_day']),
  session_type_id: z.string().uuid().nullable(),
  session_slots: z.array(SessionSlotSchema),
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

- [ ] **Step 4: Update `frontend/src/schemas/clientPortal.ts`**

```typescript
import { z } from 'zod'

export const ClientProfileSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
})
export type ClientProfile = z.infer<typeof ClientProfileSchema>

export const ClientJobSchema = z.object({
  id: z.string().uuid(),
  delivery_url: z.string().nullable(),
  appointment_title: z.string(),
  appointment_starts_at: z.string(),
  stage_name: z.string(),
  stage_color: z.string(),
})
export type ClientJob = z.infer<typeof ClientJobSchema>
export const ClientJobListSchema = z.array(ClientJobSchema)

export const ClientJobStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  position: z.number().int(),
})
export type ClientJobStage = z.infer<typeof ClientJobStageSchema>

export const ClientJobDetailSchema = z.object({
  id: z.string().uuid(),
  delivery_url: z.string().nullable(),
  appointment_title: z.string(),
  appointment_starts_at: z.string(),
  appointment_session_types: z.array(z.string()),
  stage_id: z.string().uuid(),
  stage_name: z.string(),
  all_stages: z.array(ClientJobStageSchema),
})
export type ClientJobDetail = z.infer<typeof ClientJobDetailSchema>

export const SessionTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  available_days: z.array(z.number().int().min(0).max(6)),
})
export type SessionType = z.infer<typeof SessionTypeSchema>
export const SessionTypeListSchema = z.array(SessionTypeSchema)

export const ClientBookingRequestSlotSchema = z.object({
  session_type_id: z.string().uuid(),
  session_type_name: z.string().nullable(),
  date: z.string(),
  time_slot: z.enum(['morning', 'afternoon', 'evening', 'all_day']),
})
export type ClientBookingRequestSlot = z.infer<typeof ClientBookingRequestSlotSchema>

export const ClientBookingRequestSchema = z.object({
  id: z.string().uuid(),
  preferred_date: z.string(),
  session_slots: z.array(ClientBookingRequestSlotSchema),
  time_slot: z.enum(['morning', 'afternoon', 'evening', 'all_day']).nullable(),
  session_type_name: z.string().nullable(),
  message: z.string().nullable(),
  status: z.enum(['pending', 'confirmed', 'rejected']),
  admin_notes: z.string().nullable(),
  created_at: z.string(),
})
export type ClientBookingRequest = z.infer<typeof ClientBookingRequestSchema>
export const ClientBookingRequestListSchema = z.array(ClientBookingRequestSchema)
```

- [ ] **Step 5: Run TypeScript check**

```bash
cd frontend && npm run build 2>&1 | head -60
```

Expected: type errors only in files that still reference old fields (`session_type_ids` on forms, `session_time` etc) — those will be fixed in later tasks.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/schemas/
git commit -m "feat(frontend-schemas): add session_slots and available_days to all schemas"
```

---

## Task 7: Frontend — Settings API, Hook, and Session Type Day Toggles

**Files:**
- Modify: `frontend/src/api/settings.ts`
- Modify: `frontend/src/hooks/useSettings.ts`
- Modify: `frontend/src/pages/admin/Settings.tsx`

- [ ] **Step 1: Update `frontend/src/api/settings.ts` — `updateSessionType`**

```typescript
export async function updateSessionType(
  id: string,
  payload: { name?: string; available_days?: number[] },
): Promise<SessionType> {
  const { data } = await api.patch(`/api/session-types/${id}`, payload)
  return SessionTypeSchema.parse(data)
}
```

- [ ] **Step 2: Update `frontend/src/hooks/useSettings.ts` — `useUpdateSessionType`**

```typescript
export function useUpdateSessionType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; available_days?: number[] }) =>
      updateSessionType(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-types'] })
      toast.success('Session type updated')
    },
    onError: () => toast.error('Failed to update session type'),
  })
}
```

- [ ] **Step 3: Update `SessionTypeRow` in `frontend/src/pages/admin/Settings.tsx`**

Change the component signature and add day toggles. Replace the entire `SessionTypeRow` function:

```tsx
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function SessionTypeRow({ id, name, available_days }: { id: string; name: string; available_days: number[] }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const update = useUpdateSessionType()
  const del = useDeleteSessionType()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  useEffect(() => { if (!editing) setValue(name) }, [name, editing])

  const save = () => {
    if (value.trim() && value !== name) {
      update.mutate({ id, name: value.trim() })
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setValue(name); setEditing(false) }
  }

  const toggleDay = (day: number) => {
    const next = available_days.includes(day)
      ? available_days.filter((d) => d !== day)
      : [...available_days, day].sort((a, b) => a - b)
    update.mutate({ id, available_days: next })
  }

  return (
    <li className="py-3 border-b border-border last:border-0 space-y-2">
      <div className="flex items-center gap-2">
        {editing ? (
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={save}
            onKeyDown={handleKeyDown}
            className="h-7 text-sm flex-1 rounded border border-input bg-input px-2"
          />
        ) : (
          <button
            type="button"
            className="flex-1 text-left text-sm hover:underline bg-transparent"
            onClick={() => setEditing(true)}
          >
            {name}
          </button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => del.mutate(id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex gap-1 flex-wrap">
        {DAY_LABELS.map((label, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => toggleDay(idx)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              available_days.length === 0 || available_days.includes(idx)
                ? 'bg-brand-solid text-white border-transparent'
                : 'bg-transparent text-muted-foreground border-border'
            }`}
            title={available_days.length === 0 ? 'All days (click to restrict)' : undefined}
          >
            {label}
          </button>
        ))}
        {available_days.length > 0 && (
          <button
            type="button"
            onClick={() => update.mutate({ id, available_days: [] })}
            className="text-xs px-2 py-0.5 text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
    </li>
  )
}
```

- [ ] **Step 4: Update `SessionTypesTab` to pass `available_days`**

Change the `SessionTypeRow` usage line from:
```tsx
<SessionTypeRow key={t.id} id={t.id} name={t.name} />
```
to:
```tsx
<SessionTypeRow key={t.id} id={t.id} name={t.name} available_days={t.available_days} />
```

- [ ] **Step 5: Build check**

```bash
cd frontend && npm run build 2>&1 | grep -E "error TS" | grep -v "Appointments\|BookSession" | head -20
```

Expected: no errors in settings-related files

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/settings.ts frontend/src/hooks/useSettings.ts \
        frontend/src/pages/admin/Settings.tsx
git commit -m "feat(settings): add day-of-week availability toggles to session types"
```

---

## Task 8: Frontend — Admin Appointment Form Slot Builder

**Files:**
- Modify: `frontend/src/pages/admin/Appointments.tsx`

The slot builder replaces: session type multi-select, start date input, multi-day checkbox, end date input, session time select.

- [ ] **Step 1: Update imports at top of `Appointments.tsx`**

Add `useFieldArray` to the react-hook-form import:
```tsx
import { useForm, useFieldArray, type SubmitHandler } from 'react-hook-form'
```

Add `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` if not already imported (they likely are). Add `Plus`, `X` to lucide imports (add `X` if missing, `Plus` is already there).

Also add `getDay, parseISO` to date-fns imports if not already there.

- [ ] **Step 2: Update the form schema**

Replace the `appointmentFormSchema` definition:

```tsx
const SessionSlotFormSchema = z.object({
  session_type_id: z.string().uuid('Select a session type'),
  date: z.string().min(1, 'Date is required'),
  time_slot: z.enum(['morning', 'afternoon', 'evening', 'all_day']),
})

const appointmentFormSchema = z.object({
  client_id: z.string().uuid('Select a client'),
  title: z.string().min(1, 'Title is required'),
  session_slots: z.array(SessionSlotFormSchema).min(1, 'At least one session slot is required'),
  location: z.string().optional().nullable(),
  status: z.enum(['pending', 'confirmed', 'cancelled']),
  addon_album: z.boolean().default(false),
  addon_thank_you_card: z.boolean().default(false),
  addon_enlarged_photos: z.boolean().default(false),
  deposit_paid: z.boolean().default(false),
  deposit_amount: z.string().optional(),
  deposit_account_id: z.string().uuid().optional().nullable(),
  contract_signed: z.boolean().default(false),
  price: z.string().optional(),
  notes: z.string().optional().nullable(),
})

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>
```

- [ ] **Step 3: Update `defaultValues` and `reset` calls in `AppointmentModal`**

Update the `useForm` defaultValues:
```tsx
defaultValues: appointment
  ? {
      client_id: appointment.client_id,
      title: appointment.title,
      session_slots: appointment.session_slots.length > 0
        ? appointment.session_slots.map(s => ({
            session_type_id: s.session_type_id,
            date: s.date,
            time_slot: s.time_slot as 'morning' | 'afternoon' | 'evening' | 'all_day',
          }))
        : [{ session_type_id: '', date: '', time_slot: 'morning' as const }],
      location: appointment.location,
      status: appointment.status,
      notes: appointment.notes,
    }
  : {
      status: 'pending',
      session_slots: [{ session_type_id: '', date: '', time_slot: 'morning' as const }],
    },
```

Update the `reset()` call in `useEffect` for edit mode:
```tsx
reset({
  client_id: appointment.client_id,
  title: appointment.title,
  session_slots: appointment.session_slots.length > 0
    ? appointment.session_slots.map(s => ({
        session_type_id: s.session_type_id,
        date: s.date,
        time_slot: s.time_slot as 'morning' | 'afternoon' | 'evening' | 'all_day',
      }))
    : [{ session_type_id: '', date: '', time_slot: 'morning' as const }],
  location: appointment.location ?? undefined,
  status: appointment.status,
  addon_album: appointment.addons.includes('album'),
  addon_thank_you_card: appointment.addons.includes('thank_you_card'),
  addon_enlarged_photos: appointment.addons.includes('enlarged_photos'),
  deposit_paid: appointment.deposit_paid,
  deposit_amount: appointment.deposit_amount ?? undefined,
  contract_signed: appointment.contract_signed,
  price: appointment.price ?? '0',
  notes: appointment.notes ?? undefined,
})
```

Update the `reset()` call for new appointment:
```tsx
reset({
  status: 'pending',
  session_slots: [{ session_type_id: '', date: '', time_slot: 'morning' as const }],
  addon_album: false,
  addon_thank_you_card: false,
  addon_enlarged_photos: false,
  deposit_paid: false,
  contract_signed: false,
  ...prefill,
})
```

- [ ] **Step 4: Update `onSubmit` payload**

Replace the `payload` construction in `onSubmit`:
```tsx
const onSubmit: SubmitHandler<AppointmentFormValues> = async (values) => {
  const addons = [
    values.addon_album && 'album',
    values.addon_thank_you_card && 'thank_you_card',
    values.addon_enlarged_photos && 'enlarged_photos',
  ].filter(Boolean) as string[]

  const payload = {
    client_id: values.client_id,
    title: values.title,
    session_slots: values.session_slots,
    location: values.location ?? null,
    status: values.status,
    addons,
    deposit_paid: values.deposit_paid,
    deposit_amount: values.deposit_amount || '0',
    contract_signed: values.contract_signed,
    price: values.price || '0',
    notes: values.notes ?? null,
  }
  // ... rest unchanged
}
```

- [ ] **Step 5: Add `useFieldArray` and slot-validation helper inside `AppointmentModal`**

Add after the `useForm(...)` call:
```tsx
const { fields: slotFields, append: appendSlot, remove: removeSlot } = useFieldArray({
  control,
  name: 'session_slots',
})

// Helper: check if a date string is allowed for a session type's available_days
const isDateAllowed = (dateStr: string, availableDays: number[]): boolean => {
  if (!dateStr || availableDays.length === 0) return true
  const day = getDay(parseISO(dateStr)) // 0=Sun in date-fns
  const normalized = day === 0 ? 6 : day - 1  // convert to 0=Mon
  return availableDays.includes(normalized)
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const getAvailableDays = (sessionTypeId: string): number[] => {
  const st = sessionTypes.find(s => s.id === sessionTypeId)
  return st?.available_days ?? []
}
```

- [ ] **Step 6: Replace the session type + date section in the form JSX**

Find the section that contains the session type multi-select, the start date input, multi-day checkbox, and session time select. Replace it entirely with:

```tsx
{/* Session Slots */}
<div className="space-y-3 sm:col-span-2">
  <Label>Sessions</Label>
  {slotFields.map((field, index) => {
    const slotTypeId = watch(`session_slots.${index}.session_type_id`)
    const slotDate = watch(`session_slots.${index}.date`)
    const availDays = getAvailableDays(slotTypeId)
    const dateAllowed = isDateAllowed(slotDate, availDays)

    return (
      <div key={field.id} className="flex flex-wrap gap-2 items-start p-3 rounded-lg border border-border bg-muted/30">
        {/* Session type */}
        <div className="flex-1 min-w-[160px]">
          <Select
            value={watch(`session_slots.${index}.session_type_id`) || ''}
            onValueChange={(v) => setValue(`session_slots.${index}.session_type_id`, v, { shouldValidate: true })}
          >
            <SelectTrigger className="bg-input border text-foreground h-9 text-sm">
              <SelectValue placeholder="Select session type" />
            </SelectTrigger>
            <SelectContent className="bg-popover border text-popover-foreground">
              {sessionTypes.map(st => (
                <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.session_slots?.[index]?.session_type_id && (
            <p className="text-xs text-red-400 mt-1">{errors.session_slots[index]?.session_type_id?.message}</p>
          )}
        </div>

        {/* Date */}
        <div className="flex-1 min-w-[140px]">
          <Input
            type="date"
            {...register(`session_slots.${index}.date`)}
            className="bg-input border text-foreground h-9 text-sm"
          />
          {slotDate && !dateAllowed && (
            <p className="text-xs text-red-400 mt-1">
              Not available on {DAY_NAMES[getDay(parseISO(slotDate)) === 0 ? 6 : getDay(parseISO(slotDate)) - 1]}.
              Available: {availDays.map(d => DAY_NAMES[d].slice(0, 3)).join(', ')}
            </p>
          )}
          {errors.session_slots?.[index]?.date && (
            <p className="text-xs text-red-400 mt-1">{errors.session_slots[index]?.date?.message}</p>
          )}
        </div>

        {/* Time of day */}
        <div className="w-[130px]">
          <Select
            value={watch(`session_slots.${index}.time_slot`)}
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

        {/* Remove button */}
        {slotFields.length > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive h-9 px-2"
            onClick={() => removeSlot(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    )
  })}

  <Button
    type="button"
    variant="outline"
    size="sm"
    onClick={() => {
      const firstDate = watch('session_slots.0.date') ?? ''
      appendSlot({ session_type_id: '', date: firstDate, time_slot: 'morning' })
    }}
  >
    <Plus className="h-4 w-4 mr-1" />
    Add session type
  </Button>
</div>
```

- [ ] **Step 7: Update `requestPrefill` in the `Appointments` component**

The `requestPrefill` memo currently maps `preferred_date`, `session_type_id`, `time_slot`. Update to use `session_slots`:

```tsx
const requestPrefill = useMemo(() => {
  if (!confirmingRequest) return undefined
  return {
    client_id: confirmingRequest.client_id,
    session_slots: confirmingRequest.session_slots.length > 0
      ? confirmingRequest.session_slots.map(s => ({
          session_type_id: s.session_type_id,
          date: s.date,   // each slot carries its own date
          time_slot: s.time_slot,
        }))
      : [{
          session_type_id: '',
          date: String(confirmingRequest.preferred_date),
          time_slot: 'morning' as const,
        }],
    addon_album: confirmingRequest.addons.includes('album'),
    addon_thank_you_card: confirmingRequest.addons.includes('thank_you_card'),
    addon_enlarged_photos: confirmingRequest.addons.includes('enlarged_photos'),
    notes: confirmingRequest.message ?? undefined,
    status: 'confirmed' as const,
  }
}, [confirmingRequest])
```

- [ ] **Step 8: Build check**

```bash
cd frontend && npm run build 2>&1 | grep "error TS" | grep "Appointments" | head -20
```

Fix any remaining type errors. Common ones:
- `X` not imported from lucide — add it: `import { ..., X } from 'lucide-react'`
- `sessionTypes` not typed with `available_days` — it will be once `useSessionTypes` returns the updated schema from Task 6/7

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/admin/Appointments.tsx
git commit -m "feat(appointments-form): replace single date/time with per-slot builder"
```

---

## Task 9: Frontend — Client Booking Form Slot Builder + Dashboard RequestCard

**Files:**
- Modify: `frontend/src/pages/client/BookSession.tsx`
- Modify: `frontend/src/pages/client/Dashboard.tsx`
- Modify: `frontend/src/api/clientPortal.ts`

- [ ] **Step 1: Update `frontend/src/api/clientPortal.ts` — `createBookingRequest`**

Update the payload type and function:

```typescript
export interface BookingRequestSlotPayload {
  session_type_id: string
  date: string
  time_slot: 'morning' | 'afternoon' | 'evening' | 'all_day'
}

export interface BookingRequestCreatePayload {
  session_slots: BookingRequestSlotPayload[]
  message?: string | null
}

export async function createBookingRequest(payload: BookingRequestCreatePayload): Promise<ClientBookingRequest> {
  const { data } = await api.post('/api/client/booking-requests', payload)
  return ClientBookingRequestSchema.parse(data)
}
```

- [ ] **Step 2: Rewrite `frontend/src/pages/client/BookSession.tsx`**

```tsx
// frontend/src/pages/client/BookSession.tsx
import { useFieldArray, useForm } from 'react-hook-form'
import { getDay, parseISO } from 'date-fns'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateBookingRequest, useMyBookingRequests, useClientSessionTypes } from '@/hooks/useClientPortal'
import type { ClientBookingRequest } from '@/schemas/clientPortal'

interface SlotFormValue {
  session_type_id: string
  date: string
  time_slot: 'morning' | 'afternoon' | 'evening' | 'all_day'
}

interface BookingFormValues {
  slots: SlotFormValue[]
  message: string
}

const STATUS_LABELS: Record<ClientBookingRequest['status'], string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  rejected: 'Not Available',
}

const STATUS_COLORS: Record<ClientBookingRequest['status'], string> = {
  pending: 'bg-yellow-500/20 text-yellow-300',
  confirmed: 'bg-emerald-500/20 text-emerald-300',
  rejected: 'bg-red-500/20 text-red-300',
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function isDateAllowed(dateStr: string, availableDays: number[]): boolean {
  if (!dateStr || availableDays.length === 0) return true
  const day = getDay(parseISO(dateStr))
  const normalized = day === 0 ? 6 : day - 1
  return availableDays.includes(normalized)
}

export function BookSession() {
  const { control, register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } =
    useForm<BookingFormValues>({
      defaultValues: {
        slots: [{ session_type_id: '', date: '', time_slot: 'morning' }],
        message: '',
      },
    })

  const { fields, append, remove } = useFieldArray({ control, name: 'slots' })
  const watchedSlots = watch('slots')

  const createRequest = useCreateBookingRequest()
  const { data: requests = [], isLoading: requestsLoading } = useMyBookingRequests()
  const { data: sessionTypes = [] } = useClientSessionTypes()

  const getAvailableDays = (sessionTypeId: string) =>
    sessionTypes.find(s => s.id === sessionTypeId)?.available_days ?? []

  const onSubmit = async (values: BookingFormValues) => {
    await createRequest.mutateAsync({
      session_slots: values.slots.map(s => ({
        session_type_id: s.session_type_id,
        date: s.date,
        time_slot: s.time_slot,
      })),
      message: values.message || null,
    })
    reset({
      slots: [{ session_type_id: '', date: '', time_slot: 'morning' }],
      message: '',
    })
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">Book a Session</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl bg-card border p-5 space-y-4">
        <div className="space-y-3">
          <Label>Sessions</Label>
          {fields.map((field, index) => {
            const slotTypeId = watchedSlots[index]?.session_type_id ?? ''
            const slotDate = watchedSlots[index]?.date ?? ''
            const availDays = getAvailableDays(slotTypeId)
            const dateAllowed = isDateAllowed(slotDate, availDays)

            return (
              <div key={field.id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex flex-wrap gap-2 items-start">
                  {/* Session type */}
                  <div className="flex-1 min-w-[160px]">
                    <Select
                      value={slotTypeId || ''}
                      onValueChange={(v) => setValue(`slots.${index}.session_type_id`, v)}
                    >
                      <SelectTrigger className="bg-input border text-foreground h-9 text-sm">
                        <SelectValue placeholder="Select session type" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border text-popover-foreground">
                        {sessionTypes.map(st => (
                          <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date */}
                  <div className="flex-1 min-w-[140px] space-y-1">
                    <Input
                      type="date"
                      {...register(`slots.${index}.date`)}
                      className="bg-input border text-foreground h-9 text-sm"
                    />
                    {slotDate && !dateAllowed && (
                      <p className="text-xs text-red-400">
                        Not available on {DAY_NAMES[getDay(parseISO(slotDate)) === 0 ? 6 : getDay(parseISO(slotDate)) - 1]}.
                        {availDays.length > 0 && ` Available: ${availDays.map(d => DAY_NAMES[d].slice(0, 3)).join(', ')}`}
                      </p>
                    )}
                  </div>

                  {/* Time of day */}
                  <div className="w-[130px]">
                    <Select
                      value={watchedSlots[index]?.time_slot ?? 'morning'}
                      onValueChange={(v) => setValue(`slots.${index}.time_slot`, v as SlotFormValue['time_slot'])}
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

                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-9 px-2"
                      onClick={() => remove(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const firstDate = watchedSlots[0]?.date ?? ''
              append({ session_type_id: '', date: firstDate, time_slot: 'morning' })
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add session type
          </Button>
        </div>

        <div>
          <Label className="text-muted-foreground text-xs">Message (optional)</Label>
          <textarea
            {...register('message')}
            placeholder="Any questions or notes for the photographer…"
            rows={3}
            className="w-full mt-1 rounded-md bg-input border text-foreground px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Submitting…' : 'Send Request'}
        </Button>
      </form>

      {/* Past requests */}
      {!requestsLoading && requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Your Requests</h2>
          {requests.map(req => (
            <div key={req.id} className="rounded-xl bg-card border p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {req.session_slots.length > 0
                    ? req.session_slots.map(s => s.session_type_name ?? 'Session').join(' + ')
                    : 'Booking request'}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status]}`}>
                  {STATUS_LABELS[req.status]}
                </span>
              </div>
              {req.session_slots.map((slot, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {slot.session_type_name ?? 'Session'}: {slot.date} — {slot.time_slot.replace('_', ' ')}
                </p>
              ))}
              {req.admin_notes && (
                <p className="text-sm text-muted-foreground italic">"{req.admin_notes}"</p>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update `RequestCard` in `frontend/src/pages/client/Dashboard.tsx`**

Replace the `RequestCard` component to show slots:

```tsx
function RequestCard({ request }: { request: ClientBookingRequest }) {
  return (
    <div className="rounded-xl bg-card border p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-foreground text-sm">
          {request.session_slots.length > 0
            ? request.session_slots.map(s => s.session_type_name ?? 'Session').join(' + ')
            : 'Booking request'}
        </p>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${REQUEST_STATUS_STYLES[request.status]}`}>
          {REQUEST_STATUS_LABELS[request.status]}
        </span>
      </div>
      {request.session_slots.map((slot, i) => (
        <p key={i} className="text-xs text-muted-foreground">
          {slot.date} — {slot.time_slot.replace('_', ' ')}
        </p>
      ))}
      {request.admin_notes && (
        <p className="text-sm text-muted-foreground italic">"{request.admin_notes}"</p>
      )}
    </div>
  )
}
```

Remove the `import { format, parseISO, isAfter, isBefore } from 'date-fns'` line's `format` and `parseISO` re-check — they're still needed for job cards. Just update `RequestCard`.

Also remove the `ClientBookingRequest` type import from `@/api/clientPortal` if it was there — it should come from `@/schemas/clientPortal` now (or keep as-is if already using the schema type).

- [ ] **Step 4: Final build check**

```bash
cd frontend && npm run build 2>&1 | grep "error TS" | head -30
```

Fix any remaining type errors.

- [ ] **Step 5: Run frontend tests**

```bash
cd frontend && npm run test
```

Expected: PASS (no tests depend on the old form fields)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/clientPortal.ts \
        frontend/src/pages/client/BookSession.tsx \
        frontend/src/pages/client/Dashboard.tsx
git commit -m "feat(client-portal): slot builder for booking requests, updated dashboard request card"
```

---

## Final Verification

- [ ] **Start backend and verify endpoints**

```bash
cd backend && uvicorn main:app --reload
```

Test with curl or browser:
- `GET /api/session-types` → includes `available_days`
- `POST /api/appointments` with `session_slots` → returns `session_slots`, `starts_at` computed
- `GET /api/client/session-types` → includes `available_days`
- `POST /api/client/booking-requests` with `session_slots` → returns resolved slot names

- [ ] **Start frontend and smoke test**

```bash
cd frontend && npm run dev
```

1. Go to Settings → Session Types → verify day toggles appear, clicking a day saves immediately
2. Go to Appointments → New Appointment → verify slot builder: add multiple session types with different dates and times, verify day restriction warning appears for invalid days
3. Go to client portal → Book a Session → verify slot builder, day restriction works
4. Go to client portal → Dashboard → verify Requests Sent shows slot details

- [ ] **Run full backend test suite**

```bash
cd backend && pytest -v
```

Expected: all tests PASS
