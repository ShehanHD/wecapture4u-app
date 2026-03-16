import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient) -> None:
    response = await client.post("/api/auth/login", json={
        "email": "nobody@example.com",
        "password": "wrong",
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_forgot_password_always_200(client: AsyncClient) -> None:
    response = await client.post("/api/auth/forgot-password", json={
        "email": "nonexistent@example.com",
    })
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_reset_password_invalid_token(client: AsyncClient) -> None:
    response = await client.post("/api/auth/reset-password", json={
        "token": "invalid-token",
        "new_password": "newpassword123",
    })
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_refresh_invalid_token(client: AsyncClient) -> None:
    response = await client.post("/api/auth/refresh", json={
        "refresh_token": "invalid-token",
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_logout_requires_auth(client: AsyncClient) -> None:
    response = await client.post("/api/auth/logout", json={"refresh_token": "x"})
    assert response.status_code == 403  # No Authorization header
