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
