import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_returns_ok(client: AsyncClient) -> None:
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_health_no_auth_required(client: AsyncClient) -> None:
    response = await client.get("/api/health")
    assert response.status_code == 200  # No Authorization header needed
