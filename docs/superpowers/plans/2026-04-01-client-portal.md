# Client Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete client-facing portal where clients can view their jobs, request bookings, and update their profile.

**Architecture:** New `backend/routers/client_portal.py` handles all client-facing API calls under `/api/client/*`, guarded by `require_client`. The frontend adds a `ClientShell` layout with a bottom tab bar (mobile) / top nav (desktop), plus five pages under `pages/client/`. Data flows through a new `api/clientPortal.ts` → `hooks/useClientPortal.ts` → Zod-validated schemas chain, matching the existing admin portal pattern.

**Tech Stack:** FastAPI (backend), SQLAlchemy async (ORM), React 18 + TanStack Query v5 + Zod + react-hook-form, React Router v6, Tailwind CSS, lucide-react icons.

---

## File Map

### New files (backend)
- `backend/schemas/client_portal.py` — Pydantic request/response models for all client portal endpoints
- `backend/routers/client_portal.py` — All `/api/client/*` endpoints (`/me`, `/jobs`, `/jobs/{id}`, `/session-types`, `/booking-requests`)
- `backend/tests/test_routers_client_portal.py` — Integration tests for all endpoints

### Modified files (backend)
- `backend/main.py` — Add `include_router` for client portal router
- `backend/tests/conftest.py` — Add `client_user`, `client_record`, `client_auth_headers` fixtures

### New files (frontend)
- `frontend/src/schemas/clientPortal.ts` — Zod schemas for all client portal API responses
- `frontend/src/api/clientPortal.ts` — Axios API functions calling `/api/client/*`
- `frontend/src/hooks/useClientPortal.ts` — TanStack Query hooks wrapping the API functions
- `frontend/src/components/layout/ClientShell.tsx` — Layout with bottom tab bar (mobile) / top nav (desktop)
- `frontend/src/pages/client/Dashboard.tsx` — Upcoming jobs + empty state
- `frontend/src/pages/client/Jobs.tsx` — Full jobs list
- `frontend/src/pages/client/JobDetail.tsx` — Job detail with stage progress
- `frontend/src/pages/client/BookSession.tsx` — Booking request form + existing requests list
- `frontend/src/pages/client/Profile.tsx` — Edit name and phone

### Modified files (frontend)
- `frontend/src/routes/index.tsx` — Wire client portal pages under `ClientRoute` guard + `ClientShell`

---

## Task 1: Backend schemas

**Files:**
- Create: `backend/schemas/client_portal.py`

- [ ] **Step 1: Create the schema file**

```python
# backend/schemas/client_portal.py
import uuid
from datetime import date, datetime
from typing import Literal, Optional
from pydantic import BaseModel


class ClientProfileOut(BaseModel):
    name: str
    email: str
    phone: Optional[str]

    model_config = {"from_attributes": True}


class ClientProfileUpdate(BaseModel):
    name: Optional[str] = None
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


class ClientBookingRequestOut(BaseModel):
    id: uuid.UUID
    preferred_date: date
    time_slot: Literal["morning", "afternoon", "evening", "all_day"]
    session_type_name: Optional[str]
    message: Optional[str]
    status: Literal["pending", "confirmed", "rejected"]
    admin_notes: Optional[str]
    created_at: datetime


class ClientBookingRequestCreate(BaseModel):
    preferred_date: date
    time_slot: Literal["morning", "afternoon", "evening", "all_day"]
    session_type_id: Optional[uuid.UUID] = None
    message: Optional[str] = None
```

- [ ] **Step 2: Commit**

```bash
git add backend/schemas/client_portal.py
git commit -m "feat(client-portal): add backend Pydantic schemas"
```

---

## Task 2: Backend conftest fixtures

**Files:**
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Add client fixtures to conftest.py**

Open `backend/tests/conftest.py`. After the `admin_auth_headers` fixture, add:

```python
from models.client import Client


@pytest.fixture
async def client_user(db_session: AsyncSession) -> User:
    """Create a transient client user scoped to the test transaction."""
    user = User(
        email=f"client_{uuid.uuid4().hex[:8]}@test.internal",
        hashed_password=hash_password("ClientPass123!"),
        role=UserRole.client,
        full_name="Test Client",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
async def client_record(db_session: AsyncSession, client_user: User) -> Client:
    """Create a Client record linked to client_user."""
    record = Client(
        user_id=client_user.id,
        phone="555-0100",
    )
    db_session.add(record)
    await db_session.flush()
    return record


@pytest.fixture
async def client_auth_headers(client_user: User) -> dict:
    """JWT Bearer headers for the test client user."""
    token = create_access_token({"sub": str(client_user.id)})
    return {"Authorization": f"Bearer {token}"}
```

- [ ] **Step 2: Commit**

```bash
git add backend/tests/conftest.py
git commit -m "feat(client-portal): add client_user and client_record fixtures"
```

---

## Task 3: Backend router

**Files:**
- Create: `backend/routers/client_portal.py`
- Test: `backend/tests/test_routers_client_portal.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_routers_client_portal.py`:

```python
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from models.job import Job, JobStage
from models.appointment import Appointment
from models.session_type import SessionType
from models.booking_request import BookingRequest
from models.client import Client
from models.user import User
import uuid
from datetime import datetime, timezone, date


# ─── Helper ──────────────────────────────────────────────────────────────────

async def _make_stage(db: AsyncSession, position: int = 1) -> JobStage:
    stage = JobStage(name=f"Stage {position}", color="#aaa", position=position)
    db.add(stage)
    await db.flush()
    return stage


async def _make_appointment(db: AsyncSession, client_record: Client, title: str = "Portrait Session") -> Appointment:
    appt = Appointment(
        client_id=client_record.id,
        title=title,
        starts_at=datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc),
        status="confirmed",
        session_type_ids=[],
        price=100,
    )
    db.add(appt)
    await db.flush()
    return appt


async def _make_job(db: AsyncSession, client_record: Client, stage: JobStage, appointment: Appointment) -> Job:
    job = Job(
        client_id=client_record.id,
        stage_id=stage.id,
        appointment_id=appointment.id,
    )
    db.add(job)
    await db.flush()
    return job


# ─── GET /api/client/me ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_my_profile(
    test_client: AsyncClient,
    db_session: AsyncSession,
    client_user: User,
    client_record: Client,
    client_auth_headers: dict,
):
    resp = await test_client.get("/api/client/me", headers=client_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == client_user.full_name
    assert data["email"] == client_user.email
    assert data["phone"] == client_record.phone


@pytest.mark.asyncio
async def test_get_my_profile_requires_client_role(
    test_client: AsyncClient,
    admin_auth_headers: dict,
):
    resp = await test_client.get("/api/client/me", headers=admin_auth_headers)
    assert resp.status_code == 403


# ─── PATCH /api/client/me ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_my_profile_name(
    test_client: AsyncClient,
    db_session: AsyncSession,
    client_user: User,
    client_record: Client,
    client_auth_headers: dict,
):
    resp = await test_client.patch(
        "/api/client/me",
        json={"name": "Updated Name"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Name"
    await db_session.refresh(client_user)
    assert client_user.full_name == "Updated Name"


@pytest.mark.asyncio
async def test_update_my_profile_phone(
    test_client: AsyncClient,
    db_session: AsyncSession,
    client_user: User,
    client_record: Client,
    client_auth_headers: dict,
):
    resp = await test_client.patch(
        "/api/client/me",
        json={"phone": "555-9999"},
        headers=client_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["phone"] == "555-9999"
    await db_session.refresh(client_record)
    assert client_record.phone == "555-9999"


# ─── GET /api/client/jobs ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_my_jobs_returns_own_jobs(
    test_client: AsyncClient,
    db_session: AsyncSession,
    client_user: User,
    client_record: Client,
    client_auth_headers: dict,
):
    stage = await _make_stage(db_session)
    appt = await _make_appointment(db_session, client_record)
    job = await _make_job(db_session, client_record, stage, appt)

    resp = await test_client.get("/api/client/jobs", headers=client_auth_headers)
    assert resp.status_code == 200
    ids = [j["id"] for j in resp.json()]
    assert str(job.id) in ids


@pytest.mark.asyncio
async def test_list_my_jobs_excludes_other_clients_jobs(
    test_client: AsyncClient,
    db_session: AsyncSession,
    client_user: User,
    client_record: Client,
    client_auth_headers: dict,
    admin_user: User,
):
    # Create another client + job
    other_user = User(
        email=f"other_{uuid.uuid4().hex[:8]}@test.internal",
        hashed_password="x",
        role="client",
        full_name="Other",
        is_active=True,
    )
    db_session.add(other_user)
    await db_session.flush()
    other_client = Client(user_id=other_user.id)
    db_session.add(other_client)
    await db_session.flush()

    stage = await _make_stage(db_session)
    other_appt = Appointment(
        client_id=other_client.id,
        title="Other Session",
        starts_at=datetime(2026, 7, 1, 10, 0, tzinfo=timezone.utc),
        status="confirmed",
        session_type_ids=[],
        price=0,
    )
    db_session.add(other_appt)
    await db_session.flush()
    other_job = Job(client_id=other_client.id, stage_id=stage.id, appointment_id=other_appt.id)
    db_session.add(other_job)
    await db_session.flush()

    resp = await test_client.get("/api/client/jobs", headers=client_auth_headers)
    assert resp.status_code == 200
    ids = [j["id"] for j in resp.json()]
    assert str(other_job.id) not in ids


# ─── GET /api/client/jobs/{id} ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_job_detail(
    test_client: AsyncClient,
    db_session: AsyncSession,
    client_user: User,
    client_record: Client,
    client_auth_headers: dict,
):
    stage = await _make_stage(db_session)
    appt = await _make_appointment(db_session, client_record)
    job = await _make_job(db_session, client_record, stage, appt)

    resp = await test_client.get(f"/api/client/jobs/{job.id}", headers=client_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(job.id)
    assert data["appointment_title"] == appt.title
    assert "all_stages" in data


@pytest.mark.asyncio
async def test_get_job_detail_not_found_for_other_client(
    test_client: AsyncClient,
    db_session: AsyncSession,
    client_user: User,
    client_record: Client,
    client_auth_headers: dict,
):
    # Create a job for a different client
    other_user = User(
        email=f"other_{uuid.uuid4().hex[:8]}@test.internal",
        hashed_password="x",
        role="client",
        full_name="Other",
        is_active=True,
    )
    db_session.add(other_user)
    await db_session.flush()
    other_client = Client(user_id=other_user.id)
    db_session.add(other_client)
    await db_session.flush()
    stage = await _make_stage(db_session)
    other_appt = Appointment(
        client_id=other_client.id,
        title="Private",
        starts_at=datetime(2026, 7, 1, 10, 0, tzinfo=timezone.utc),
        status="confirmed",
        session_type_ids=[],
        price=0,
    )
    db_session.add(other_appt)
    await db_session.flush()
    other_job = Job(client_id=other_client.id, stage_id=stage.id, appointment_id=other_appt.id)
    db_session.add(other_job)
    await db_session.flush()

    resp = await test_client.get(f"/api/client/jobs/{other_job.id}", headers=client_auth_headers)
    assert resp.status_code == 404


# ─── GET /api/client/session-types ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_session_types(
    test_client: AsyncClient,
    db_session: AsyncSession,
    client_record: Client,
    client_auth_headers: dict,
):
    st = SessionType(name=f"Newborn_{uuid.uuid4().hex[:6]}")
    db_session.add(st)
    await db_session.flush()

    resp = await test_client.get("/api/client/session-types", headers=client_auth_headers)
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()]
    assert st.name in names


# ─── POST /api/client/booking-requests ───────────────────────────────────────

@pytest.mark.asyncio
async def test_create_booking_request(
    test_client: AsyncClient,
    db_session: AsyncSession,
    client_record: Client,
    client_auth_headers: dict,
):
    payload = {
        "preferred_date": "2026-08-15",
        "time_slot": "morning",
        "message": "Looking forward to it!",
    }
    resp = await test_client.post("/api/client/booking-requests", json=payload, headers=client_auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["preferred_date"] == "2026-08-15"
    assert data["time_slot"] == "morning"
    assert data["status"] == "pending"
    assert data["message"] == "Looking forward to it!"


# ─── GET /api/client/booking-requests ────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_booking_requests(
    test_client: AsyncClient,
    db_session: AsyncSession,
    client_record: Client,
    client_auth_headers: dict,
):
    req = BookingRequest(
        client_id=client_record.id,
        preferred_date=date(2026, 9, 1),
        time_slot="afternoon",
    )
    db_session.add(req)
    await db_session.flush()

    resp = await test_client.get("/api/client/booking-requests", headers=client_auth_headers)
    assert resp.status_code == 200
    ids = [r["id"] for r in resp.json()]
    assert str(req.id) in ids
```

- [ ] **Step 2: Run tests — verify they all fail with 404 (router not yet registered)**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
source venv/bin/activate
pytest tests/test_routers_client_portal.py -x -q 2>&1 | tail -20
```

Expected: all fail (endpoints don't exist yet).

- [ ] **Step 3: Create the router**

Create `backend/routers/client_portal.py`:

```python
# backend/routers/client_portal.py
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_client
from models.appointment import Appointment
from models.booking_request import BookingRequest
from models.client import Client
from models.job import Job, JobStage
from models.session_type import SessionType
from models.user import User
from schemas.auth import CurrentUser
from schemas.client_portal import (
    ClientBookingRequestCreate,
    ClientBookingRequestOut,
    ClientJobDetailOut,
    ClientJobOut,
    ClientJobStageOut,
    ClientProfileOut,
    ClientProfileUpdate,
    SessionTypeOut,
)

router = APIRouter(prefix="/api/client", tags=["client-portal"])
DB = Annotated[AsyncSession, Depends(get_db)]
ClientUser = Annotated[CurrentUser, Depends(require_client)]


async def _get_client(db: AsyncSession, user_id: uuid.UUID) -> Client:
    """Resolve the Client record for the current user. Raises 404 if missing."""
    result = await db.execute(select(Client).where(Client.user_id == user_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client record not found")
    return client


# ─── Profile ──────────────────────────────────────────────────────────────────

@router.get("/me", response_model=ClientProfileOut)
async def get_my_profile(db: DB, current_user: ClientUser) -> ClientProfileOut:
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    client = await _get_client(db, current_user.id)
    return ClientProfileOut(name=user.full_name, email=user.email, phone=client.phone)


@router.patch("/me", response_model=ClientProfileOut)
async def update_my_profile(
    body: ClientProfileUpdate, db: DB, current_user: ClientUser
) -> ClientProfileOut:
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    client = await _get_client(db, current_user.id)

    updated = body.model_fields_set
    if "name" in updated and body.name is not None:
        user.full_name = body.name
    if "phone" in updated:
        client.phone = body.phone  # None clears the field

    await db.flush()
    return ClientProfileOut(name=user.full_name, email=user.email, phone=client.phone)


# ─── Jobs ─────────────────────────────────────────────────────────────────────

@router.get("/jobs", response_model=list[ClientJobOut])
async def list_my_jobs(db: DB, current_user: ClientUser) -> list[ClientJobOut]:
    client = await _get_client(db, current_user.id)
    result = await db.execute(
        select(Job, Appointment, JobStage)
        .join(Appointment, Job.appointment_id == Appointment.id)
        .join(JobStage, Job.stage_id == JobStage.id)
        .where(Job.client_id == client.id)
        .order_by(Appointment.starts_at.desc())
    )
    return [
        ClientJobOut(
            id=job.id,
            delivery_url=job.delivery_url,
            appointment_title=appt.title,
            appointment_starts_at=appt.starts_at.isoformat(),
            stage_name=stage.name,
            stage_color=stage.color,
        )
        for job, appt, stage in result.all()
    ]


@router.get("/jobs/{job_id}", response_model=ClientJobDetailOut)
async def get_my_job(job_id: uuid.UUID, db: DB, current_user: ClientUser) -> ClientJobDetailOut:
    client = await _get_client(db, current_user.id)

    result = await db.execute(
        select(Job, Appointment, JobStage)
        .join(Appointment, Job.appointment_id == Appointment.id)
        .join(JobStage, Job.stage_id == JobStage.id)
        .where(Job.id == job_id, Job.client_id == client.id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Job not found")
    job, appt, stage = row

    # Load all job stages ordered by position
    stages_result = await db.execute(
        select(JobStage).order_by(JobStage.position)
    )
    all_stages = stages_result.scalars().all()

    # Load session type names for this appointment
    session_type_names: list[str] = []
    if appt.session_type_ids:
        st_result = await db.execute(
            select(SessionType).where(
                SessionType.id.in_(appt.session_type_ids)
            )
        )
        session_type_names = [st.name for st in st_result.scalars().all()]

    return ClientJobDetailOut(
        id=job.id,
        delivery_url=job.delivery_url,
        appointment_title=appt.title,
        appointment_starts_at=appt.starts_at.isoformat(),
        appointment_session_types=session_type_names,
        stage_id=stage.id,
        stage_name=stage.name,
        all_stages=[
            ClientJobStageOut(id=s.id, name=s.name, color=s.color, position=s.position)
            for s in all_stages
        ],
    )


# ─── Session types (for booking form dropdown) ───────────────────────────────

@router.get("/session-types", response_model=list[SessionTypeOut])
async def list_session_types(db: DB, current_user: ClientUser) -> list[SessionTypeOut]:
    result = await db.execute(select(SessionType).order_by(SessionType.name))
    return [SessionTypeOut(id=st.id, name=st.name) for st in result.scalars().all()]


# ─── Booking requests ─────────────────────────────────────────────────────────

@router.get("/booking-requests", response_model=list[ClientBookingRequestOut])
async def list_my_booking_requests(db: DB, current_user: ClientUser) -> list[ClientBookingRequestOut]:
    client = await _get_client(db, current_user.id)
    result = await db.execute(
        select(BookingRequest, SessionType)
        .outerjoin(SessionType, BookingRequest.session_type_id == SessionType.id)
        .where(BookingRequest.client_id == client.id)
        .order_by(BookingRequest.created_at.desc())
    )
    return [
        ClientBookingRequestOut(
            id=req.id,
            preferred_date=req.preferred_date,
            time_slot=req.time_slot,
            session_type_name=st.name if st else None,
            message=req.message,
            status=req.status,
            admin_notes=req.admin_notes,
            created_at=req.created_at,
        )
        for req, st in result.all()
    ]


@router.post("/booking-requests", response_model=ClientBookingRequestOut, status_code=201)
async def create_booking_request(
    body: ClientBookingRequestCreate, db: DB, current_user: ClientUser
) -> ClientBookingRequestOut:
    client = await _get_client(db, current_user.id)
    req = BookingRequest(
        client_id=client.id,
        preferred_date=body.preferred_date,
        time_slot=body.time_slot,
        session_type_id=body.session_type_id,
        message=body.message,
    )
    db.add(req)
    await db.flush()
    await db.refresh(req)

    session_type_name: str | None = None
    if body.session_type_id:
        st_result = await db.execute(
            select(SessionType).where(SessionType.id == body.session_type_id)
        )
        st = st_result.scalar_one_or_none()
        session_type_name = st.name if st else None

    return ClientBookingRequestOut(
        id=req.id,
        preferred_date=req.preferred_date,
        time_slot=req.time_slot,
        session_type_name=session_type_name,
        message=req.message,
        status=req.status,
        admin_notes=req.admin_notes,
        created_at=req.created_at,
    )
```

- [ ] **Step 4: Register the router in main.py**

In `backend/main.py`, add after the last `from routers...` import:

```python
from routers.client_portal import router as client_portal_router
```

And add after the last `app.include_router(...)` call:

```python
app.include_router(client_portal_router)
```

- [ ] **Step 5: Run tests — all should pass**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
source venv/bin/activate
pytest tests/test_routers_client_portal.py -x -q 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/routers/client_portal.py backend/main.py backend/tests/test_routers_client_portal.py
git commit -m "feat(client-portal): add backend router and tests"
```

---

## Task 4: Frontend Zod schemas

**Files:**
- Create: `frontend/src/schemas/clientPortal.ts`

- [ ] **Step 1: Create the schema file**

```typescript
// frontend/src/schemas/clientPortal.ts
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
})
export type SessionType = z.infer<typeof SessionTypeSchema>
export const SessionTypeListSchema = z.array(SessionTypeSchema)

export const ClientBookingRequestSchema = z.object({
  id: z.string().uuid(),
  preferred_date: z.string(),
  time_slot: z.enum(['morning', 'afternoon', 'evening', 'all_day']),
  session_type_name: z.string().nullable(),
  message: z.string().nullable(),
  status: z.enum(['pending', 'confirmed', 'rejected']),
  admin_notes: z.string().nullable(),
  created_at: z.string(),
})
export type ClientBookingRequest = z.infer<typeof ClientBookingRequestSchema>
export const ClientBookingRequestListSchema = z.array(ClientBookingRequestSchema)
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/schemas/clientPortal.ts
git commit -m "feat(client-portal): add frontend Zod schemas"
```

---

## Task 5: Frontend API functions

**Files:**
- Create: `frontend/src/api/clientPortal.ts`

- [ ] **Step 1: Create the API file**

```typescript
// frontend/src/api/clientPortal.ts
import { api } from '@/lib/axios'
import {
  ClientProfileSchema,
  ClientJobListSchema,
  ClientJobDetailSchema,
  SessionTypeListSchema,
  ClientBookingRequestListSchema,
  ClientBookingRequestSchema,
  type ClientProfile,
  type ClientJob,
  type ClientJobDetail,
  type SessionType,
  type ClientBookingRequest,
} from '@/schemas/clientPortal'

export type { ClientProfile, ClientJob, ClientJobDetail, SessionType, ClientBookingRequest }

export async function fetchMyProfile(): Promise<ClientProfile> {
  const { data } = await api.get('/api/client/me')
  return ClientProfileSchema.parse(data)
}

export async function updateMyProfile(payload: { name?: string; phone?: string | null }): Promise<ClientProfile> {
  const { data } = await api.patch('/api/client/me', payload)
  return ClientProfileSchema.parse(data)
}

export async function fetchMyJobs(): Promise<ClientJob[]> {
  const { data } = await api.get('/api/client/jobs')
  return ClientJobListSchema.parse(data)
}

export async function fetchMyJob(id: string): Promise<ClientJobDetail> {
  const { data } = await api.get(`/api/client/jobs/${id}`)
  return ClientJobDetailSchema.parse(data)
}

export async function fetchSessionTypes(): Promise<SessionType[]> {
  const { data } = await api.get('/api/client/session-types')
  return SessionTypeListSchema.parse(data)
}

export async function fetchMyBookingRequests(): Promise<ClientBookingRequest[]> {
  const { data } = await api.get('/api/client/booking-requests')
  return ClientBookingRequestListSchema.parse(data)
}

export interface BookingRequestCreatePayload {
  preferred_date: string
  time_slot: 'morning' | 'afternoon' | 'evening' | 'all_day'
  session_type_id?: string | null
  message?: string | null
}

export async function createBookingRequest(payload: BookingRequestCreatePayload): Promise<ClientBookingRequest> {
  const { data } = await api.post('/api/client/booking-requests', payload)
  return ClientBookingRequestSchema.parse(data)
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/clientPortal.ts
git commit -m "feat(client-portal): add frontend API functions"
```

---

## Task 6: Frontend TanStack Query hooks

**Files:**
- Create: `frontend/src/hooks/useClientPortal.ts`

- [ ] **Step 1: Create the hooks file**

```typescript
// frontend/src/hooks/useClientPortal.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchMyProfile,
  updateMyProfile,
  fetchMyJobs,
  fetchMyJob,
  fetchSessionTypes,
  fetchMyBookingRequests,
  createBookingRequest,
  type BookingRequestCreatePayload,
} from '@/api/clientPortal'

export function useMyProfile() {
  return useQuery({ queryKey: ['client-profile'], queryFn: fetchMyProfile })
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateMyProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-profile'] })
      toast.success('Profile updated')
    },
    onError: () => toast.error('Failed to update profile'),
  })
}

export function useMyJobs() {
  return useQuery({ queryKey: ['client-jobs'], queryFn: fetchMyJobs })
}

export function useMyJob(id: string) {
  return useQuery({
    queryKey: ['client-jobs', id],
    queryFn: () => fetchMyJob(id),
    enabled: !!id,
  })
}

export function useClientSessionTypes() {
  return useQuery({ queryKey: ['client-session-types'], queryFn: fetchSessionTypes })
}

export function useMyBookingRequests() {
  return useQuery({ queryKey: ['client-booking-requests'], queryFn: fetchMyBookingRequests })
}

export function useCreateBookingRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: BookingRequestCreatePayload) => createBookingRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-booking-requests'] })
      toast.success('Booking request submitted!')
    },
    onError: () => toast.error('Failed to submit booking request'),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useClientPortal.ts
git commit -m "feat(client-portal): add TanStack Query hooks"
```

---

## Task 7: ClientShell layout

**Files:**
- Create: `frontend/src/components/layout/ClientShell.tsx`

- [ ] **Step 1: Create the layout component**

```typescript
// frontend/src/components/layout/ClientShell.tsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Briefcase, CalendarPlus, Home, LogOut, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useMyProfile } from '@/hooks/useClientPortal'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/client',        label: 'Home',    icon: Home,         end: true },
  { to: '/client/jobs',   label: 'My Jobs', icon: Briefcase },
  { to: '/client/book',   label: 'Book',    icon: CalendarPlus },
  { to: '/client/profile',label: 'Profile', icon: User },
] as const

export function ClientShell() {
  const { logout } = useAuth()
  const { data: profile } = useMyProfile()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/client/login')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Desktop top nav — hidden on mobile */}
      <header className="hidden md:flex sticky top-0 z-10 h-14 items-center justify-between border-b bg-card px-6">
        <span className="text-sm font-semibold text-foreground">weCapture4U</span>
        <nav className="flex items-center gap-6">
          {TABS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('text-sm font-medium transition-colors', isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{profile?.name}</span>
          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Page content — bottom padding on mobile to clear the tab bar */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tab bar — hidden on desktop */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 flex h-16 items-stretch border-t bg-card md:hidden">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/ClientShell.tsx
git commit -m "feat(client-portal): add ClientShell layout with bottom tab bar"
```

---

## Task 8: Client Dashboard page

**Files:**
- Create: `frontend/src/pages/client/Dashboard.tsx`

- [ ] **Step 1: Create the page**

```typescript
// frontend/src/pages/client/Dashboard.tsx
import { Link } from 'react-router-dom'
import { CalendarPlus, ExternalLink } from 'lucide-react'
import { format, parseISO, isAfter } from 'date-fns'
import { Button } from '@/components/ui/button'
import { useMyJobs } from '@/hooks/useClientPortal'
import type { ClientJob } from '@/api/clientPortal'

function JobCard({ job }: { job: ClientJob }) {
  return (
    <div className="rounded-xl bg-card border p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-foreground truncate">{job.appointment_title}</p>
        <p className="text-sm text-muted-foreground">
          {format(parseISO(job.appointment_starts_at), 'MMMM d, yyyy')}
        </p>
        <span
          className="mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium text-black"
          style={{ background: job.stage_color }}
        >
          {job.stage_name}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {job.delivery_url && (
          <a
            href={job.delivery_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-brand-solid hover:opacity-70"
          >
            <ExternalLink className="h-4 w-4" />
            Photos
          </a>
        )}
        <Link to={`/client/jobs/${job.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          View →
        </Link>
      </div>
    </div>
  )
}

export function ClientDashboard() {
  const { data: jobs = [], isLoading } = useMyJobs()

  const upcoming = jobs
    .filter((j) => isAfter(parseISO(j.appointment_starts_at), new Date()))
    .slice(0, 3)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Upcoming Sessions</h2>
        {isLoading && (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}
        {!isLoading && upcoming.length === 0 && (
          <div className="rounded-xl bg-card border p-6 text-center space-y-3">
            <p className="text-muted-foreground text-sm">No upcoming sessions.</p>
            <Button asChild size="sm">
              <Link to="/client/book">
                <CalendarPlus className="h-4 w-4 mr-2" />
                Book a session
              </Link>
            </Button>
          </div>
        )}
        {upcoming.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/client/Dashboard.tsx
git commit -m "feat(client-portal): add client Dashboard page"
```

---

## Task 9: Client Jobs list and Job Detail pages

**Files:**
- Create: `frontend/src/pages/client/Jobs.tsx`
- Create: `frontend/src/pages/client/JobDetail.tsx`

- [ ] **Step 1: Create Jobs list page**

```typescript
// frontend/src/pages/client/Jobs.tsx
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ExternalLink } from 'lucide-react'
import { useMyJobs } from '@/hooks/useClientPortal'

export function ClientJobs() {
  const { data: jobs = [], isLoading } = useMyJobs()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">My Jobs</h1>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
      )}

      {!isLoading && jobs.length === 0 && (
        <p className="text-muted-foreground text-sm">No jobs yet.</p>
      )}

      <div className="space-y-2">
        {jobs.map((job) => (
          <Link
            key={job.id}
            to={`/client/jobs/${job.id}`}
            className="flex items-center justify-between rounded-xl bg-card border p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{job.appointment_title}</p>
              <p className="text-sm text-muted-foreground">
                {format(parseISO(job.appointment_starts_at), 'MMM d, yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {job.delivery_url && (
                <a
                  href={job.delivery_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs text-brand-solid hover:opacity-70"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Photos
                </a>
              )}
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium text-black"
                style={{ background: job.stage_color }}
              >
                {job.stage_name}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create Job Detail page**

```typescript
// frontend/src/pages/client/JobDetail.tsx
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { useMyJob } from '@/hooks/useClientPortal'
import type { ClientJobStage } from '@/schemas/clientPortal'

function StageProgress({ stages, currentStageId }: { stages: ClientJobStage[]; currentStageId: string }) {
  const sorted = [...stages].sort((a, b) => a.position - b.position)
  const currentIndex = sorted.findIndex((s) => s.id === currentStageId)

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Progress</p>
      <div className="flex items-center gap-1 flex-wrap">
        {sorted.map((stage, i) => {
          const isActive = stage.id === currentStageId
          const isDone = i < currentIndex
          return (
            <div key={stage.id} className="flex items-center gap-1">
              <div
                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{
                  background: isActive ? stage.color : isDone ? stage.color : undefined,
                  backgroundColor: !isActive && !isDone ? 'hsl(var(--muted))' : undefined,
                  opacity: isDone ? 0.5 : 1,
                }}
              />
              <span className={`text-xs ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {stage.name}
              </span>
              {i < sorted.length - 1 && <span className="text-muted-foreground text-xs mx-0.5">→</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ClientJobDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: job, isLoading } = useMyJob(id!)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/client/jobs" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Job Detail</h1>
      </div>

      {isLoading && <div className="h-40 rounded-xl bg-muted animate-pulse" />}

      {!isLoading && !job && (
        <p className="text-red-400">Job not found.</p>
      )}

      {job && (
        <div className="space-y-4">
          <div className="rounded-xl bg-card border p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{job.appointment_title}</h2>
              <p className="text-muted-foreground text-sm">
                {format(parseISO(job.appointment_starts_at), 'EEEE, MMMM d, yyyy')}
              </p>
              {job.appointment_session_types.length > 0 && (
                <p className="text-muted-foreground text-sm mt-1">
                  {job.appointment_session_types.join(', ')}
                </p>
              )}
            </div>

            <StageProgress stages={job.all_stages} currentStageId={job.stage_id} />

            {job.delivery_url && (
              <Button asChild variant="outline" className="border-white/20 text-white w-full sm:w-auto">
                <a href={job.delivery_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Your Photos
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/client/Jobs.tsx frontend/src/pages/client/JobDetail.tsx
git commit -m "feat(client-portal): add Jobs list and Job Detail pages"
```

---

## Task 10: Book Session page

**Files:**
- Create: `frontend/src/pages/client/BookSession.tsx`

- [ ] **Step 1: Create the page**

```typescript
// frontend/src/pages/client/BookSession.tsx
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateBookingRequest, useMyBookingRequests, useClientSessionTypes } from '@/hooks/useClientPortal'
import type { ClientBookingRequest } from '@/schemas/clientPortal'

interface BookingFormValues {
  preferred_date: string
  time_slot: 'morning' | 'afternoon' | 'evening' | 'all_day'
  session_type_id: string
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

export function BookSession() {
  const { register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } = useForm<BookingFormValues>({
    defaultValues: { time_slot: 'morning', session_type_id: '__none__', message: '' },
  })
  const timeSlot = watch('time_slot')
  const sessionTypeId = watch('session_type_id')

  const createRequest = useCreateBookingRequest()
  const { data: requests = [], isLoading: requestsLoading } = useMyBookingRequests()
  const { data: sessionTypes = [] } = useClientSessionTypes()

  const onSubmit = async (values: BookingFormValues) => {
    await createRequest.mutateAsync({
      preferred_date: values.preferred_date,
      time_slot: values.time_slot,
      session_type_id: values.session_type_id === '__none__' ? null : values.session_type_id,
      message: values.message || null,
    })
    reset()
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">Book a Session</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl bg-card border p-5 space-y-4">
        <div>
          <Label className="text-muted-foreground text-xs">Preferred Date</Label>
          <Input
            type="date"
            className="mt-1 bg-input border text-foreground"
            {...register('preferred_date', { required: true })}
          />
        </div>

        <div>
          <Label className="text-muted-foreground text-xs">Time of Day</Label>
          <Select
            value={timeSlot}
            onValueChange={(v) => setValue('time_slot', v as BookingFormValues['time_slot'])}
          >
            <SelectTrigger className="mt-1 bg-input border text-foreground">
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

        <div>
          <Label className="text-muted-foreground text-xs">Session Type (optional)</Label>
          <Select
            value={sessionTypeId}
            onValueChange={(v) => setValue('session_type_id', v)}
          >
            <SelectTrigger className="mt-1 bg-input border text-foreground">
              <SelectValue placeholder="Select type…" />
            </SelectTrigger>
            <SelectContent className="bg-popover border text-popover-foreground">
              <SelectItem value="__none__">No preference</SelectItem>
              {sessionTypes.map((st) => (
                <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-muted-foreground text-xs">Message (optional)</Label>
          <textarea
            rows={3}
            className="mt-1 w-full bg-input border rounded px-3 py-2 text-foreground resize-none block"
            placeholder="Any notes or special requests…"
            {...register('message')}
          />
        </div>

        <Button type="submit" disabled={isSubmitting || createRequest.isPending}>
          Submit Request
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Your Requests</h2>
        {requestsLoading && <div className="h-12 rounded-xl bg-muted animate-pulse" />}
        {!requestsLoading && requests.length === 0 && (
          <p className="text-muted-foreground text-sm">No requests yet.</p>
        )}
        {requests.map((req) => (
          <div key={req.id} className="rounded-xl bg-card border p-4 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-foreground font-medium">
                {format(new Date(req.preferred_date + 'T00:00:00'), 'MMMM d, yyyy')} — {req.time_slot}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status]}`}>
                {STATUS_LABELS[req.status]}
              </span>
            </div>
            {req.session_type_name && (
              <p className="text-sm text-muted-foreground">{req.session_type_name}</p>
            )}
            {req.admin_notes && (
              <p className="text-sm text-muted-foreground italic">{req.admin_notes}</p>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/client/BookSession.tsx
git commit -m "feat(client-portal): add Book Session page"
```

---

## Task 11: Client Profile page

**Files:**
- Create: `frontend/src/pages/client/Profile.tsx`

- [ ] **Step 1: Create the page**

```typescript
// frontend/src/pages/client/Profile.tsx
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { useMyProfile, useUpdateMyProfile } from '@/hooks/useClientPortal'

interface ProfileFormValues {
  name: string
  phone: string
}

export function ClientProfile() {
  const { data: profile } = useMyProfile()
  const updateProfile = useUpdateMyProfile()
  const { logout } = useAuth()
  const navigate = useNavigate()

  const { register, handleSubmit, reset } = useForm<ProfileFormValues>({
    defaultValues: { name: '', phone: '' },
  })

  useEffect(() => {
    if (profile) {
      reset({ name: profile.name, phone: profile.phone ?? '' })
    }
  }, [profile, reset])

  const onSubmit = (values: ProfileFormValues) => {
    updateProfile.mutate({
      name: values.name || undefined,
      phone: values.phone || null,
    })
  }

  const handleLogout = () => {
    logout()
    navigate('/client/login')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Profile</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl bg-card border p-5 space-y-4 max-w-sm">
        <div>
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input
            className="mt-1 bg-input border text-foreground"
            {...register('name', { required: true })}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Phone</Label>
          <Input
            className="mt-1 bg-input border text-foreground"
            type="tel"
            {...register('phone')}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Email</Label>
          <Input
            className="mt-1 bg-input border text-foreground opacity-60"
            value={profile?.email ?? ''}
            readOnly
            disabled
          />
          <p className="text-xs text-muted-foreground mt-1">Contact us to change your email address.</p>
        </div>
        <Button type="submit" disabled={updateProfile.isPending}>
          Save
        </Button>
      </form>

      <div className="pt-2">
        <Button variant="ghost" className="text-red-400 hover:text-red-300" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Log out
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/client/Profile.tsx
git commit -m "feat(client-portal): add Profile page"
```

---

## Task 12: Wire routes

**Files:**
- Modify: `frontend/src/routes/index.tsx`

- [ ] **Step 1: Update the router**

In `frontend/src/routes/index.tsx`:

1. Add imports at the top (after existing imports):

```typescript
import { ClientShell } from '@/components/layout/ClientShell'
import { ClientDashboard } from '@/pages/client/Dashboard'
import { ClientJobs } from '@/pages/client/Jobs'
import { ClientJobDetail } from '@/pages/client/JobDetail'
import { BookSession } from '@/pages/client/BookSession'
import { ClientProfile } from '@/pages/client/Profile'
```

2. Replace the protected client routes section:

```typescript
  // Protected client routes
  {
    element: <ClientRoute />,
    children: [
      { path: '/client/biometric/setup', element: <BiometricSetup /> },
      {
        path: '/client',
        element: <ClientShell />,
        children: [
          { index: true, element: <ClientDashboard /> },
          { path: 'jobs', element: <ClientJobs /> },
          { path: 'jobs/:id', element: <ClientJobDetail /> },
          { path: 'book', element: <BookSession /> },
          { path: 'profile', element: <ClientProfile /> },
        ],
      },
    ],
  },
```

- [ ] **Step 2: Run the TypeScript build check**

```bash
cd /Users/don/Desktop/weCapture4U-app/frontend
npm run build 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 3: Run the linter**

```bash
npm run lint 2>&1 | tail -20
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/index.tsx
git commit -m "feat(client-portal): wire client portal routes"
```

---

## Task 13: Final backend tests

- [ ] **Step 1: Run all backend tests to confirm nothing is broken**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
source venv/bin/activate
pytest -x -q 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 2: Run client portal tests specifically**

```bash
pytest tests/test_routers_client_portal.py -v 2>&1 | tail -30
```

Expected: all 11 tests pass.

---

## Done

The client portal is complete:
- **Backend:** 7 endpoints under `/api/client/*` with full test coverage
- **Frontend:** `ClientShell` + 5 pages (Dashboard, Jobs, JobDetail, BookSession, Profile)
- **Auth:** all client routes behind `ClientRoute` guard + `require_client` dependency
