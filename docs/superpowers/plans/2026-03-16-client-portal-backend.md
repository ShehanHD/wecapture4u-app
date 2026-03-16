# weCapture4U — Client Portal Backend

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `booking_requests` table, all client-facing API endpoints (dashboard, jobs, bookings, profile), admin booking-request management endpoints, and email notifications for booking events.

**Architecture:** Client endpoints filter all DB queries by `client_id` derived from `current_user.id → clients.user_id`. A `get_current_client()` FastAPI dependency returns the `Client` row. No data from other clients can leak — all queries include `WHERE client_id = :client_id`.

**Depends on:** Plans 1–2 (Foundation, Auth — shared JWT system, `get_current_user()`), Plan 3 (Admin models — clients, jobs, appointments, session_types).

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL, Pydantic v2, Resend.

---

## File Structure

```
migrations/
  004_client_portal.sql     # booking_requests table; delivery_url on jobs (if not yet added)
backend/
  models/
    client_portal.py        # BookingRequest model
  schemas/
    client_portal.py        # Pydantic v2 schemas for booking requests + client dashboard views
  services/
    client_portal.py        # Client data access service (scoped to client_id)
  routers/
    client_portal.py        # All /api/client/* endpoints + admin booking-request endpoints
  auth.py                   # Add get_current_client() dependency
  main.py                   # Register client_portal router
```

---

## Chunk 1: Migration + Model + Schemas

### Task 1: Migration 004_client_portal.sql

**Files:**
- Create: `migrations/004_client_portal.sql`

- [ ] **Step 1: Write the migration**

```sql
-- migrations/004_client_portal.sql
-- Client portal: booking_requests table; delivery_url on jobs

-- ─── DELIVERY URL ON JOBS ─────────────────────────────────────────────────────

ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS delivery_url TEXT;

-- ─── BOOKING REQUESTS ─────────────────────────────────────────────────────────

CREATE TYPE booking_time_slot AS ENUM ('morning', 'afternoon', 'evening', 'all_day');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'rejected');

CREATE TABLE booking_requests (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id         UUID NOT NULL REFERENCES clients(id),
    preferred_date    DATE NOT NULL,
    time_slot         booking_time_slot NOT NULL,
    session_type_id   UUID NOT NULL REFERENCES session_types(id),
    addons            TEXT[] NOT NULL DEFAULT '{}',
    message           TEXT,
    status            booking_status NOT NULL DEFAULT 'pending',
    admin_notes       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON booking_requests (client_id);
CREATE INDEX ON booking_requests (status);
CREATE INDEX ON booking_requests (created_at DESC);

-- Auto-update updated_at on status change
CREATE OR REPLACE FUNCTION set_booking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_requests_updated_at
    BEFORE UPDATE ON booking_requests
    FOR EACH ROW EXECUTE FUNCTION set_booking_updated_at();
```

- [ ] **Step 2: No automated test for SQL — runs during DB setup**

---

### Task 2: BookingRequest model + Pydantic schemas

**Files:**
- Create: `backend/models/client_portal.py`
- Create: `backend/schemas/client_portal.py`
- Create: `backend/schemas/__tests__/test_client_portal_schemas.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/schemas/__tests__/test_client_portal_schemas.py
import pytest
from datetime import date
from uuid import uuid4
from pydantic import ValidationError
from backend.schemas.client_portal import BookingRequestCreate


def test_booking_request_valid():
    b = BookingRequestCreate(
        preferred_date=date(2026, 5, 10),
        time_slot="morning",
        session_type_id=uuid4(),
        addons=["album"],
    )
    assert b.time_slot == "morning"


def test_booking_request_invalid_time_slot():
    with pytest.raises(ValidationError):
        BookingRequestCreate(
            preferred_date=date(2026, 5, 10),
            time_slot="midnight",
            session_type_id=uuid4(),
        )


def test_booking_request_invalid_addon():
    with pytest.raises(ValidationError):
        BookingRequestCreate(
            preferred_date=date(2026, 5, 10),
            time_slot="morning",
            session_type_id=uuid4(),
            addons=["invalid_addon"],
        )


def test_booking_request_past_date_fails():
    with pytest.raises(ValidationError):
        BookingRequestCreate(
            preferred_date=date(2020, 1, 1),
            time_slot="morning",
            session_type_id=uuid4(),
        )
```

- [ ] **Step 2: Run — expect import errors**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/schemas/__tests__/test_client_portal_schemas.py -v 2>&1 | head -20
```

- [ ] **Step 3: Write model and schemas**

```python
# backend/models/client_portal.py
from __future__ import annotations
import uuid
from sqlalchemy import String, Date, Text, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from backend.models.base import Base


class BookingRequest(Base):
    __tablename__ = "booking_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    preferred_date: Mapped[object] = mapped_column(Date, nullable=False)
    time_slot: Mapped[str] = mapped_column(String, nullable=False)
    # time_slot: 'morning' | 'afternoon' | 'evening' | 'all_day' — enforced by migration enum
    session_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    addons: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    # status: 'pending' | 'confirmed' | 'rejected' — enforced by migration enum
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at = mapped_column(server_default=func.now(), nullable=False)
    updated_at = mapped_column(server_default=func.now(), onupdate=func.now(), nullable=False)
```

```python
# backend/schemas/client_portal.py
from __future__ import annotations
from datetime import date
from typing import Optional, Literal
from uuid import UUID
from pydantic import BaseModel, field_validator
import datetime


VALID_ADDONS = {"album", "thank_you_card", "enlarged_photos"}
TimeSlot = Literal["morning", "afternoon", "evening", "all_day"]
BookingStatus = Literal["pending", "confirmed", "rejected"]


class BookingRequestCreate(BaseModel):
    preferred_date: date
    time_slot: TimeSlot
    session_type_id: UUID
    addons: list[str] = []
    message: Optional[str] = None

    @field_validator("preferred_date")
    @classmethod
    def future_date(cls, v: date) -> date:
        if v <= datetime.date.today():
            raise ValueError("preferred_date must be in the future")
        return v

    @field_validator("addons")
    @classmethod
    def valid_addons(cls, v: list[str]) -> list[str]:
        invalid = set(v) - VALID_ADDONS
        if invalid:
            raise ValueError(f"Invalid addons: {invalid}. Allowed: {VALID_ADDONS}")
        return v


class BookingRequestOut(BaseModel):
    id: UUID
    client_id: UUID
    preferred_date: date
    time_slot: str
    session_type_id: UUID
    addons: list[str]
    message: Optional[str]
    status: str
    admin_notes: Optional[str]
    created_at: object
    updated_at: object

    model_config = {"from_attributes": True}


class BookingRequestAdminUpdate(BaseModel):
    status: BookingStatus
    admin_notes: Optional[str] = None


# ─── CLIENT DASHBOARD VIEWS ───────────────────────────────────────────────────

class ClientJobSummary(BaseModel):
    id: UUID
    title: str
    current_stage_name: Optional[str]
    current_stage_position: Optional[int]
    total_stages: int
    delivery_url: Optional[str]

    model_config = {"from_attributes": True}


class ClientAppointmentSummary(BaseModel):
    id: UUID
    starts_at: object
    session_type: Optional[str]
    location: Optional[str]
    deposit_paid: bool

    model_config = {"from_attributes": True}


class ClientDashboard(BaseModel):
    active_job: Optional[ClientJobSummary]
    active_job_count: int
    next_appointment: Optional[ClientAppointmentSummary]
```

- [ ] **Step 4: Run tests — expect all PASS**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/schemas/__tests__/test_client_portal_schemas.py -v
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add migrations/004_client_portal.sql backend/models/client_portal.py backend/schemas/client_portal.py backend/schemas/__tests__/test_client_portal_schemas.py
git commit -m "feat: add client portal migration, BookingRequest model and schemas"
```

---

## Chunk 2: Service + Auth Dependency + Router

### Task 3: get_current_client() dependency + client portal service

**Files:**
- Modify: `backend/auth.py` — add `get_current_client()` dependency
- Create: `backend/services/client_portal.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/services/__tests__/test_client_portal.py
import pytest


@pytest.mark.asyncio
async def test_get_client_dashboard(db_session, sample_client_with_jobs):
    from backend.services.client_portal import get_client_dashboard
    dashboard = await get_client_dashboard(db_session, sample_client_with_jobs.id)
    assert dashboard.active_job_count >= 0


@pytest.mark.asyncio
async def test_create_booking_request(db_session, sample_client, sample_session_type):
    from backend.services.client_portal import create_booking_request
    from backend.schemas.client_portal import BookingRequestCreate
    import datetime

    req = BookingRequestCreate(
        preferred_date=datetime.date.today() + datetime.timedelta(days=30),
        time_slot="morning",
        session_type_id=sample_session_type.id,
    )
    booking = await create_booking_request(db_session, sample_client.id, req)
    assert booking.status == "pending"
    assert booking.client_id == sample_client.id
```

- [ ] **Step 2: Run — expect import errors**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/services/__tests__/test_client_portal.py -v 2>&1 | head -20
```

- [ ] **Step 3: Add get_current_client() to auth.py**

In `backend/auth.py`, add below the existing `get_current_admin()`:

```python
async def get_current_client(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> "Client":
    from sqlalchemy import select
    from backend.models.admin import Client
    if current_user.role != "client":
        raise HTTPException(403, "Client access required")
    result = await db.execute(
        select(Client).where(Client.user_id == current_user.id)
    )
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(403, "Client profile not found")
    if not current_user.is_active:
        raise HTTPException(403, "Your account has been deactivated. Contact your photographer.")
    return client
```

- [ ] **Step 4: Write client portal service**

```python
# backend/services/client_portal.py
from __future__ import annotations
from uuid import UUID
from sqlalchemy import select, func as sqlfunc
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
import resend

from backend.models.client_portal import BookingRequest
from backend.models.admin import Job, JobStage, Appointment, Client
from backend.schemas.client_portal import (
    BookingRequestCreate, BookingRequestAdminUpdate,
    ClientDashboard, ClientJobSummary, ClientAppointmentSummary,
)
import os

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")


async def get_client_dashboard(db: AsyncSession, client_id: UUID) -> ClientDashboard:
    # Active jobs (non-terminal stages)
    jobs_result = await db.execute(
        select(Job)
        .join(JobStage, JobStage.id == Job.stage_id)
        .where(Job.client_id == client_id, JobStage.is_terminal == False)  # noqa: E712
        .order_by(Job.created_at.desc())
    )
    active_jobs = jobs_result.scalars().all()

    active_job = None
    if active_jobs:
        job = active_jobs[0]
        # Get current stage info
        stage_result = await db.execute(select(JobStage).where(JobStage.id == job.stage_id))
        stage = stage_result.scalar_one_or_none()
        # Count total non-terminal stages
        total_stages_result = await db.execute(
            select(sqlfunc.count()).select_from(JobStage).where(JobStage.is_terminal == False)  # noqa: E712
        )
        total_stages = total_stages_result.scalar_one()
        active_job = ClientJobSummary(
            id=job.id,
            title=job.title,
            current_stage_name=stage.name if stage else None,
            current_stage_position=stage.position if stage else None,
            total_stages=total_stages,
            delivery_url=job.delivery_url,
        )

    # Next upcoming appointment
    from datetime import datetime
    appt_result = await db.execute(
        select(Appointment)
        .where(Appointment.client_id == client_id, Appointment.starts_at >= datetime.utcnow())
        .order_by(Appointment.starts_at.asc())
        .limit(1)
    )
    appt = appt_result.scalar_one_or_none()
    next_appointment = None
    if appt:
        # Get session type name
        from backend.models.admin import SessionType
        st_result = await db.execute(
            select(SessionType).where(SessionType.id == appt.session_type_id)
        ) if appt.session_type_id else None
        st = st_result.scalar_one_or_none() if st_result else None
        next_appointment = ClientAppointmentSummary(
            id=appt.id,
            starts_at=appt.starts_at,
            session_type=st.name if st else None,
            location=getattr(appt, "location", None),
            deposit_paid=appt.deposit_paid,
        )

    return ClientDashboard(
        active_job=active_job,
        active_job_count=len(active_jobs),
        next_appointment=next_appointment,
    )


async def list_client_jobs(db: AsyncSession, client_id: UUID) -> list[Job]:
    result = await db.execute(
        select(Job).where(Job.client_id == client_id).order_by(Job.created_at.desc())
    )
    return list(result.scalars().all())


async def get_client_job(db: AsyncSession, client_id: UUID, job_id: UUID) -> Job:
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.client_id == client_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(404, "Job not found")
    return job


async def list_client_bookings(db: AsyncSession, client_id: UUID) -> list[BookingRequest]:
    result = await db.execute(
        select(BookingRequest)
        .where(BookingRequest.client_id == client_id)
        .order_by(BookingRequest.created_at.desc())
    )
    return list(result.scalars().all())


async def create_booking_request(
    db: AsyncSession, client_id: UUID, data: BookingRequestCreate
) -> BookingRequest:
    booking = BookingRequest(
        client_id=client_id,
        preferred_date=data.preferred_date,
        time_slot=data.time_slot,
        session_type_id=data.session_type_id,
        addons=data.addons,
        message=data.message,
        status="pending",
    )
    db.add(booking)
    await db.flush()

    # Send confirmation email to client
    await _send_booking_confirmation(db, booking)
    # Create admin notification
    await _notify_admin_new_booking(db, booking)

    return booking


async def admin_update_booking_request(
    db: AsyncSession, booking_id: UUID, data: BookingRequestAdminUpdate
) -> BookingRequest:
    result = await db.execute(select(BookingRequest).where(BookingRequest.id == booking_id))
    booking = result.scalar_one_or_none()
    if booking is None:
        raise HTTPException(404, "Booking request not found")

    old_status = booking.status
    booking.status = data.status
    if data.admin_notes is not None:
        booking.admin_notes = data.admin_notes
    await db.flush()

    # Send email to client
    if data.status == "confirmed":
        await _send_booking_confirmed(db, booking)
    elif data.status == "rejected":
        await _send_booking_rejected(db, booking)

    return booking


# ─── EMAIL HELPERS ────────────────────────────────────────────────────────────

async def _send_booking_confirmation(db: AsyncSession, booking: BookingRequest) -> None:
    """Send confirmation to client that their request was received."""
    try:
        result = await db.execute(select(Client).where(Client.id == booking.client_id))
        client = result.scalar_one_or_none()
        if client is None or not client.user_id:
            return
        from backend.models.auth import User
        user_result = await db.execute(
            select(User).where(User.id == client.user_id)
        )
        user = user_result.scalar_one_or_none()
        if user is None:
            return
        resend.api_key = RESEND_API_KEY
        resend.Emails.send({
            "from": "no-reply@wecapture4u.com",
            "to": user.email,
            "subject": "Booking Request Received",
            "html": (
                f"<p>Hi {user.full_name or 'there'},</p>"
                f"<p>We've received your booking request for {booking.preferred_date} "
                f"({booking.time_slot}). We'll be in touch soon to confirm.</p>"
            ),
        })
    except Exception:
        pass  # Email failure does not block booking creation


async def _send_booking_confirmed(db: AsyncSession, booking: BookingRequest) -> None:
    try:
        result = await db.execute(select(Client).where(Client.id == booking.client_id))
        client = result.scalar_one_or_none()
        if client is None or not client.user_id:
            return
        from backend.models.auth import User
        user_result = await db.execute(select(User).where(User.id == client.user_id))
        user = user_result.scalar_one_or_none()
        if user is None:
            return
        resend.api_key = RESEND_API_KEY
        notes_html = f"<p>Message from your photographer: {booking.admin_notes}</p>" if booking.admin_notes else ""
        resend.Emails.send({
            "from": "no-reply@wecapture4u.com",
            "to": user.email,
            "subject": "Your Booking is Confirmed!",
            "html": (
                f"<p>Hi {user.full_name or 'there'},</p>"
                f"<p>Your booking for {booking.preferred_date} ({booking.time_slot}) has been confirmed!</p>"
                f"{notes_html}"
                f"<p>Log in to view your details: <a href='https://wecapture4u.com/client'>Client Portal</a></p>"
            ),
        })
    except Exception:
        pass


async def _send_booking_rejected(db: AsyncSession, booking: BookingRequest) -> None:
    try:
        result = await db.execute(select(Client).where(Client.id == booking.client_id))
        client = result.scalar_one_or_none()
        if client is None or not client.user_id:
            return
        from backend.models.auth import User
        user_result = await db.execute(select(User).where(User.id == client.user_id))
        user = user_result.scalar_one_or_none()
        if user is None:
            return
        resend.api_key = RESEND_API_KEY
        notes_html = f"<p>Reason: {booking.admin_notes}</p>" if booking.admin_notes else ""
        resend.Emails.send({
            "from": "no-reply@wecapture4u.com",
            "to": user.email,
            "subject": "Booking Request Update",
            "html": (
                f"<p>Hi {user.full_name or 'there'},</p>"
                f"<p>Unfortunately, we're unable to accommodate your booking request for "
                f"{booking.preferred_date} ({booking.time_slot}).</p>"
                f"{notes_html}"
                f"<p>Feel free to submit a new request with a different date.</p>"
            ),
        })
    except Exception:
        pass


async def _notify_admin_new_booking(db: AsyncSession, booking: BookingRequest) -> None:
    """Create an in-app notification for the admin about a new booking request."""
    try:
        from backend.services.notifications import create_notification
        from backend.models.auth import User
        admin_result = await db.execute(
            select(User).where(User.role == "admin").order_by(User.created_at.asc()).limit(1)
        )
        admin = admin_result.scalar_one_or_none()
        if admin is None:
            return
        await create_notification(
            db,
            user_id=admin.id,
            notification_type="booking_request",
            message=f"New booking request from client for {booking.preferred_date}",
            reference_id=booking.id,
        )
    except Exception:
        pass
```

- [ ] **Step 5: Run service tests**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/services/__tests__/test_client_portal.py -v
```

---

### Task 4: Client portal router + register in main.py

**Files:**
- Create: `backend/routers/client_portal.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write failing integration test**

```python
# backend/routers/__tests__/test_client_portal_router.py
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_client_dashboard_requires_auth(client: AsyncClient):
    response = await client.get("/api/client/dashboard")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_client_cannot_access_admin_endpoint(client: AsyncClient, client_token: str):
    response = await client.get(
        "/api/jobs",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_booking_request(client: AsyncClient, client_token: str, sample_session_type_id: str):
    import datetime
    response = await client.post(
        "/api/client/bookings",
        json={
            "preferred_date": (datetime.date.today() + datetime.timedelta(days=30)).isoformat(),
            "time_slot": "morning",
            "session_type_id": sample_session_type_id,
            "addons": [],
        },
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert response.status_code == 201
    assert response.json()["status"] == "pending"
```

- [ ] **Step 2: Run — expect 404 (route not registered)**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/routers/__tests__/test_client_portal_router.py -v 2>&1 | head -20
```

- [ ] **Step 3: Write the router**

```python
# backend/routers/client_portal.py
from __future__ import annotations
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.auth import get_current_client, get_current_admin
from backend.models.admin import Client, Job, JobStage
from backend.models.client_portal import BookingRequest
from backend.schemas.client_portal import (
    BookingRequestCreate, BookingRequestOut,
    BookingRequestAdminUpdate, ClientDashboard,
)
from backend.services.client_portal import (
    get_client_dashboard, list_client_jobs, get_client_job,
    list_client_bookings, create_booking_request, admin_update_booking_request,
)

router = APIRouter(prefix="/api", tags=["client-portal"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
ClientDep = Annotated[Client, Depends(get_current_client)]
AdminDep = Annotated[object, Depends(get_current_admin)]


# ─── CLIENT DASHBOARD ─────────────────────────────────────────────────────────

@router.get("/client/dashboard", response_model=ClientDashboard)
async def client_dashboard(db: DbDep, client: ClientDep):
    return await get_client_dashboard(db, client.id)


# ─── CLIENT JOBS ──────────────────────────────────────────────────────────────

@router.get("/client/jobs")
async def client_jobs_list(db: DbDep, client: ClientDep):
    jobs = await list_client_jobs(db, client.id)
    result = []
    for job in jobs:
        stage_res = await db.execute(select(JobStage).where(JobStage.id == job.stage_id))
        stage = stage_res.scalar_one_or_none()
        result.append({
            "id": str(job.id),
            "title": job.title,
            "current_stage": stage.name if stage else None,
            "delivery_url": job.delivery_url,
            "created_at": job.created_at.isoformat(),
        })
    return result


@router.get("/client/jobs/{job_id}")
async def client_job_detail(db: DbDep, client: ClientDep, job_id: UUID):
    job = await get_client_job(db, client.id, job_id)

    # All stages for progress timeline
    stages_res = await db.execute(
        select(JobStage).order_by(JobStage.position)
    )
    all_stages = stages_res.scalars().all()

    current_stage_res = await db.execute(
        select(JobStage).where(JobStage.id == job.stage_id)
    )
    current_stage = current_stage_res.scalar_one_or_none()

    return {
        "id": str(job.id),
        "title": job.title,
        "delivery_url": job.delivery_url,
        "stages": [
            {
                "id": str(s.id),
                "name": s.name,
                "position": s.position,
                "is_terminal": s.is_terminal,
                "is_current": s.id == job.stage_id,
                "is_completed": (
                    current_stage is not None and s.position < current_stage.position
                ),
            }
            for s in all_stages
        ],
    }


# ─── CLIENT BOOKINGS ──────────────────────────────────────────────────────────

@router.get("/client/bookings", response_model=list[BookingRequestOut])
async def client_bookings_list(db: DbDep, client: ClientDep):
    return await list_client_bookings(db, client.id)


@router.post("/client/bookings", response_model=BookingRequestOut, status_code=201)
async def client_create_booking(db: DbDep, client: ClientDep, data: BookingRequestCreate):
    booking = await create_booking_request(db, client.id, data)
    await db.commit()
    return booking


# ─── CLIENT PROFILE ───────────────────────────────────────────────────────────

@router.get("/client/profile")
async def client_profile(db: DbDep, client: ClientDep):
    """Returns profile data — reuses /api/profile endpoint from auth module.
    The profile endpoint is role-agnostic; only the client's own user record is returned.
    """
    from backend.models.auth import User
    from backend.auth import get_current_user
    # client.user_id → their User row
    user_res = await db.execute(
        select(User).where(User.id == client.user_id)
    )
    user = user_res.scalar_one_or_none()
    if user is None:
        from fastapi import HTTPException
        raise HTTPException(404, "User profile not found")
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "phone": client.phone,
        "address": client.address,
        "birthday": client.birthday.isoformat() if client.birthday else None,
        "notes": client.notes,
        "avatar_url": user.avatar_url,
    }


# ─── ADMIN BOOKING REQUEST MANAGEMENT ────────────────────────────────────────

@router.get("/booking-requests", tags=["admin"])
async def admin_list_booking_requests(
    db: DbDep, admin: AdminDep,
    status: str | None = None,
):
    q = select(BookingRequest).order_by(BookingRequest.created_at.desc())
    if status:
        q = q.where(BookingRequest.status == status)
    result = await db.execute(q)
    return [
        {
            "id": str(b.id),
            "client_id": str(b.client_id),
            "preferred_date": b.preferred_date.isoformat(),
            "time_slot": b.time_slot,
            "session_type_id": str(b.session_type_id),
            "addons": b.addons,
            "message": b.message,
            "status": b.status,
            "admin_notes": b.admin_notes,
            "created_at": b.created_at.isoformat(),
        }
        for b in result.scalars().all()
    ]


@router.patch("/booking-requests/{booking_id}", response_model=BookingRequestOut, tags=["admin"])
async def admin_update_booking(
    db: DbDep, admin: AdminDep, booking_id: UUID, data: BookingRequestAdminUpdate
):
    booking = await admin_update_booking_request(db, booking_id, data)
    await db.commit()
    return booking
```

- [ ] **Step 4: Register router in main.py**

In `backend/main.py`, add:
```python
from backend.routers.client_portal import router as client_portal_router
app.include_router(client_portal_router)
```

- [ ] **Step 5: Run integration tests**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/routers/__tests__/test_client_portal_router.py -v
```

Expected: All PASS.

- [ ] **Step 6: Run full backend test suite**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/ -v
```

Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/models/client_portal.py backend/schemas/client_portal.py backend/services/client_portal.py backend/routers/client_portal.py backend/auth.py backend/main.py backend/routers/__tests__/test_client_portal_router.py
git commit -m "feat: add client portal backend — booking requests, client endpoints, admin booking management"
```
