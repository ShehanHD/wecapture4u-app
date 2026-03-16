import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_public_hero_list_no_auth(client: AsyncClient):
    response = await client.get("/api/portfolio/hero")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_public_categories_no_auth(client: AsyncClient):
    response = await client.get("/api/portfolio/categories")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_public_settings_no_auth(client: AsyncClient):
    response = await client.get("/api/settings/public")
    assert response.status_code == 200
    data = response.json()
    assert "tagline" in data
    assert "admin_name" in data


@pytest.mark.asyncio
async def test_contact_submit(client: AsyncClient):
    response = await client.post("/api/contact", json={
        "name": "Test User",
        "email": "test@example.com",
        "message": "Hello from test",
    })
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_upload_hero_requires_admin(client: AsyncClient):
    response = await client.post(
        "/api/portfolio/hero",
        files={"photo": ("test.jpg", b"fake", "image/jpeg")},
    )
    assert response.status_code == 403
