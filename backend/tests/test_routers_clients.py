import pytest
from uuid import uuid4


@pytest.mark.asyncio
async def test_list_clients_requires_auth(test_client):
    resp = await test_client.get("/api/clients")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_client_minimal(test_client, admin_auth_headers):
    resp = await test_client.post(
        "/api/clients",
        json={"name": "Alice Smith", "email": f"alice_{uuid4().hex[:8]}@example.com"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Alice Smith"
    assert data["user_id"] is None


@pytest.mark.asyncio
async def test_create_client_duplicate_email_fails(test_client, admin_auth_headers):
    email = f"bob_{uuid4().hex[:8]}@example.com"
    payload = {"name": "Bob", "email": email}
    await test_client.post("/api/clients", json=payload, headers=admin_auth_headers)
    resp = await test_client.post("/api/clients", json=payload, headers=admin_auth_headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_delete_client_blocked_with_jobs(test_client, admin_auth_headers, db_session):
    from models.client import Client
    from models.job import Job, JobStage

    client = Client(name="Dave", email=f"dave_{uuid4().hex[:8]}@example.com", tags=[])
    db_session.add(client)
    stage = JobStage(name="Booked", color="#000", position=99)
    db_session.add(stage)
    await db_session.flush()

    job = Job(client_id=client.id, stage_id=stage.id)
    db_session.add(job)
    await db_session.flush()

    resp = await test_client.delete(
        f"/api/clients/{client.id}", headers=admin_auth_headers
    )
    assert resp.status_code == 409
