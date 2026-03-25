# backend/tests/test_routers_album_stages.py
import pytest
from uuid import uuid4
from datetime import datetime, timezone
from models.job import AlbumStage, Job, JobStage
from models.client import Client
from models.appointment import Appointment


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _seed_stage(db, name="Test Stage", color="#aabbcc", position=None, is_terminal=False):
    if position is None:
        from sqlalchemy import select, func
        max_pos = await db.scalar(select(func.max(AlbumStage.position)))
        position = (max_pos or 0) + 1
    stage = AlbumStage(name=name, color=color, position=position, is_terminal=is_terminal)
    db.add(stage)
    await db.flush()
    return stage


async def _seed_job_with_album(db):
    """Creates a client, appointment with album addon, job stage, and returns them."""
    client = Client(name="Alice", email=f"alice_{uuid4().hex[:6]}@test.com", tags=[])
    db.add(client)
    job_stage = JobStage(name="Booked", color="#f59e0b", position=99)
    db.add(job_stage)
    await db.flush()
    appt = Appointment(
        client_id=client.id,
        title="Alice Wedding",
        starts_at=datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc),
        status="confirmed",
        addons=["album"],
        price=500,
    )
    db.add(appt)
    await db.flush()
    return client, job_stage, appt


# ─── List ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_album_stages(test_client, admin_auth_headers, db_session):
    await _seed_stage(db_session, name="Alpha", position=10)
    await _seed_stage(db_session, name="Beta", position=11)

    resp = await test_client.get("/api/album-stages", headers=admin_auth_headers)
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()]
    # Seeded defaults + our two. At minimum Alpha and Beta are present and ordered.
    assert names.index("Alpha") < names.index("Beta")


# ─── Create ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_album_stage(test_client, admin_auth_headers):
    resp = await test_client.post(
        "/api/album-stages",
        json={"name": "Proofing", "color": "#ff0000", "is_terminal": False},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Proofing"
    assert data["color"] == "#ff0000"
    assert data["is_terminal"] is False
    assert "id" in data
    assert "position" in data


# ─── Update ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_album_stage(test_client, admin_auth_headers, db_session):
    stage = await _seed_stage(db_session, name="Old Name", color="#111111")

    resp = await test_client.patch(
        f"/api/album-stages/{stage.id}",
        json={"name": "New Name", "color": "#222222"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New Name"
    assert data["color"] == "#222222"


# ─── Reorder ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reorder_album_stages(test_client, admin_auth_headers, db_session):
    # Must include ALL existing album stages in the payload
    resp = await test_client.get("/api/album-stages", headers=admin_auth_headers)
    existing = resp.json()
    assert len(existing) >= 2

    # Reverse the order
    reversed_payload = [
        {"id": s["id"], "position": len(existing) - i}
        for i, s in enumerate(existing)
    ]
    resp = await test_client.patch(
        "/api/album-stages/positions",
        json={"stages": reversed_payload},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_reorder_album_stages_bad_ids(test_client, admin_auth_headers):
    resp = await test_client.patch(
        "/api/album-stages/positions",
        json={"stages": [{"id": str(uuid4()), "position": 1}]},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 422


# ─── Delete ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_album_stage(test_client, admin_auth_headers, db_session):
    stage = await _seed_stage(db_session, name="Deletable", position=999)

    resp = await test_client.delete(
        f"/api/album-stages/{stage.id}",
        headers=admin_auth_headers,
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_album_stage_with_jobs_returns_409(test_client, admin_auth_headers, db_session):
    stage = await _seed_stage(db_session, name="Occupied", position=998)
    client = Client(name="Bob", email=f"bob_{uuid4().hex[:6]}@test.com", tags=[])
    db_session.add(client)
    job_stage = JobStage(name="Booked", color="#f59e0b", position=97)
    db_session.add(job_stage)
    await db_session.flush()
    job = Job(client_id=client.id, stage_id=job_stage.id, album_stage_id=stage.id)
    db_session.add(job)
    await db_session.flush()

    resp = await test_client.delete(
        f"/api/album-stages/{stage.id}",
        headers=admin_auth_headers,
    )
    assert resp.status_code == 409


# ─── ON DELETE SET NULL ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_album_stage_on_delete_set_null(db_session):
    """ON DELETE SET NULL: deleting an album_stage row via raw DB delete nullifies job.album_stage_id."""
    from sqlalchemy import delete as sa_delete, select as sa_select
    stage = await _seed_stage(db_session, name="Transitional", position=997)
    client = Client(name="Dan", email=f"dan_{uuid4().hex[:6]}@test.com", tags=[])
    db_session.add(client)
    job_stage = JobStage(name="Booked", color="#f59e0b", position=95)
    db_session.add(job_stage)
    await db_session.flush()
    job = Job(client_id=client.id, stage_id=job_stage.id, album_stage_id=stage.id)
    db_session.add(job)
    await db_session.flush()
    job_id = job.id

    # Bypass the API guard and delete directly — verifies ON DELETE SET NULL migration constraint
    await db_session.execute(sa_delete(AlbumStage).where(AlbumStage.id == stage.id))
    await db_session.flush()
    # Expire identity map so the next query reflects DB state (not ORM cache)
    db_session.expire_all()

    result = await db_session.execute(sa_select(Job).where(Job.id == job_id))
    refreshed = result.scalar_one()
    assert refreshed.album_stage_id is None


# ─── Auto-assign ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_job_with_album_addon_sets_album_stage(test_client, admin_auth_headers, db_session):
    client, job_stage, appt = await _seed_job_with_album(db_session)

    resp = await test_client.post(
        "/api/jobs",
        json={"client_id": str(client.id), "stage_id": str(job_stage.id), "appointment_id": str(appt.id)},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["album_stage_id"] is not None


@pytest.mark.asyncio
async def test_create_job_without_album_addon_no_album_stage(test_client, admin_auth_headers, db_session):
    client = Client(name="Carol", email=f"carol_{uuid4().hex[:6]}@test.com", tags=[])
    db_session.add(client)
    job_stage = JobStage(name="Booked", color="#f59e0b", position=96)
    db_session.add(job_stage)
    await db_session.flush()
    appt = Appointment(
        client_id=client.id,
        title="Carol Portrait",
        starts_at=datetime(2026, 7, 1, 10, 0, tzinfo=timezone.utc),
        status="confirmed",
        addons=[],  # no album
        price=200,
    )
    db_session.add(appt)
    await db_session.flush()

    resp = await test_client.post(
        "/api/jobs",
        json={"client_id": str(client.id), "stage_id": str(job_stage.id), "appointment_id": str(appt.id)},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["album_stage_id"] is None
