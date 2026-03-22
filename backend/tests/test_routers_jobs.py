import pytest
import uuid
from uuid import uuid4


@pytest.mark.asyncio
async def test_create_job(test_client, admin_auth_headers, db_session):
    from models.client import Client
    from models.job import JobStage

    client = Client(name="Grace", email=f"grace_{uuid4().hex[:8]}@example.com", tags=[])
    db_session.add(client)
    stage = JobStage(name="Booked", color="#f59e0b", position=97)
    db_session.add(stage)
    await db_session.flush()

    resp = await test_client.post(
        "/api/jobs",
        json={"client_id": str(client.id), "stage_id": str(stage.id)},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["client_id"] == str(client.id)


@pytest.mark.asyncio
async def test_reorder_stages_invalid_ids(test_client, admin_auth_headers):
    resp = await test_client.patch(
        "/api/job-stages/positions",
        json={"stages": [{"id": str(uuid.uuid4()), "position": 1}]},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 422
