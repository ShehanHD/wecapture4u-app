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
    other_client = Client(user_id=other_user.id, name="Other", email=other_user.email)
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
    other_client = Client(user_id=other_user.id, name="Other", email=other_user.email)
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
    st = SessionType(name=f"Portrait_{uuid.uuid4().hex[:6]}", available_days=[])
    db_session.add(st)
    await db_session.flush()

    payload = {
        "session_slots": [
            {"session_type_id": str(st.id), "date": "2026-08-15", "time_slot": "morning"}
        ],
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
        session_slots=[],
    )
    db_session.add(req)
    await db_session.flush()

    resp = await test_client.get("/api/client/booking-requests", headers=client_auth_headers)
    assert resp.status_code == 200
    ids = [r["id"] for r in resp.json()]
    assert str(req.id) in ids


# ─── New session_slots tests ──────────────────────────────────────────────────

async def _make_client_user_for_slots(db_session: AsyncSession):
    from models.user import UserRole
    from services.auth import hash_password, create_access_token
    pw = hash_password("pass123")
    user = User(
        email=f"client_{uuid.uuid4().hex[:8]}@test.com",
        hashed_password=pw,
        role=UserRole.client,
        full_name="Portal User",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    client = Client(name="Portal User", email=user.email, user_id=user.id, tags=[])
    db_session.add(client)
    await db_session.flush()
    token = create_access_token({"sub": str(user.id)})
    return user, client, token


@pytest.mark.asyncio
async def test_create_booking_request_with_slots(
    test_client: AsyncClient,
    db_session: AsyncSession,
):
    user, _, token = await _make_client_user_for_slots(db_session)
    st = SessionType(name=f"Wedding_{uuid.uuid4().hex[:6]}", available_days=[5, 6])
    db_session.add(st)
    await db_session.flush()

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
    assert data["session_slots"][0]["session_type_name"] == st.name
    assert data["session_slots"][0]["date"] == "2026-08-15"
    # preferred_date computed from slot
    assert str(data["preferred_date"]) == "2026-08-15"


@pytest.mark.asyncio
async def test_session_types_include_available_days(
    test_client: AsyncClient,
    db_session: AsyncSession,
    client_auth_headers: dict,
):
    st = SessionType(name=f"AvailTest_{uuid.uuid4().hex[:6]}", available_days=[1, 3])
    db_session.add(st)
    await db_session.flush()

    resp = await test_client.get(
        "/api/client/session-types",
        headers=client_auth_headers,
    )
    assert resp.status_code == 200
    match = next((t for t in resp.json() if t["id"] == str(st.id)), None)
    assert match is not None
    assert 1 in match["available_days"]
    assert 3 in match["available_days"]
