import pytest
from datetime import datetime, timezone
from uuid import uuid4


@pytest.mark.asyncio
async def test_create_appointment(test_client, admin_auth_headers, db_session):
    from models.client import Client
    client = Client(name="Eve", email=f"eve_{uuid4().hex[:8]}@example.com", tags=[])
    db_session.add(client)
    await db_session.flush()

    resp = await test_client.post(
        "/api/appointments",
        json={
            "client_id": str(client.id),
            "title": "Portrait session",
            "starts_at": "2026-07-01T10:00:00Z",
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["title"] == "Portrait session"
    assert resp.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_delete_appointment_blocked_with_job(test_client, admin_auth_headers, db_session):
    from models.client import Client
    from models.appointment import Appointment
    from models.job import Job, JobStage

    client = Client(name="Frank", email=f"frank_{uuid4().hex[:8]}@example.com", tags=[])
    db_session.add(client)
    stage = JobStage(name="Booked", color="#000", position=98)
    db_session.add(stage)
    await db_session.flush()

    appt = Appointment(
        client_id=client.id, title="Wedding", starts_at=datetime(2026, 8, 1, tzinfo=timezone.utc)
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
