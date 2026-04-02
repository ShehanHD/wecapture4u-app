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


@pytest.mark.asyncio
async def test_update_appointment_recomputes_slots(test_client, admin_auth_headers, db_session):
    client = await _make_client(db_session, "Patch")
    st1 = await _make_session_type(db_session, "PatchA")
    st2 = await _make_session_type(db_session, "PatchB")

    # Create with one slot
    resp = await test_client.post(
        "/api/appointments",
        json={
            "client_id": str(client.id),
            "title": "Patchable",
            "session_slots": [
                {"session_type_id": str(st1.id), "date": "2026-09-10", "time_slot": "morning"}
            ],
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    appt_id = resp.json()["id"]

    # PATCH with new slots (two slots, earliest is Sept 3)
    resp2 = await test_client.patch(
        f"/api/appointments/{appt_id}",
        json={
            "session_slots": [
                {"session_type_id": str(st1.id), "date": "2026-09-10", "time_slot": "afternoon"},
                {"session_type_id": str(st2.id), "date": "2026-09-03", "time_slot": "morning"},
            ]
        },
        headers=admin_auth_headers,
    )
    assert resp2.status_code == 200
    data = resp2.json()
    assert len(data["session_slots"]) == 2
    # starts_at recomputed to earliest date (Sept 3)
    assert data["starts_at"].startswith("2026-09-03")
    # session_type_ids derived (no duplicates)
    assert len(data["session_type_ids"]) == 2


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
                    "time_slot": "morning",
                }
            ],
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["starts_at"].startswith("2026-08-10T10:30")
    assert data["session_slots"][0]["time_slot"] == "morning"
    assert data["session_slots"][0]["time"] == "10:30"


@pytest.mark.asyncio
async def test_time_slot_derived_from_time(test_client, admin_auth_headers, db_session):
    """Verify derivation: morning <12, afternoon 12-16, evening >=17."""
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
                    "time": "25:00",
                    "time_slot": "morning",
                }
            ],
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 422
