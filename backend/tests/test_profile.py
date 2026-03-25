# backend/tests/test_profile.py
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_profile_requires_auth(test_client: AsyncClient) -> None:
    response = await test_client.get("/api/profile")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_profile_returns_current_user(
    test_client: AsyncClient, admin_auth_headers: dict
) -> None:
    response = await test_client.get("/api/profile", headers=admin_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "email" in data
    assert "full_name" in data
    assert "avatar_url" in data
    assert "role" in data


@pytest.mark.asyncio
async def test_update_full_name(
    test_client: AsyncClient, admin_auth_headers: dict
) -> None:
    response = await test_client.patch(
        "/api/profile",
        json={"full_name": "Updated Name"},
        headers=admin_auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["full_name"] == "Updated Name"


@pytest.mark.asyncio
async def test_change_password_wrong_current(
    test_client: AsyncClient, admin_auth_headers: dict
) -> None:
    response = await test_client.post(
        "/api/profile/change-password",
        json={"current_password": "wrongpassword", "new_password": "newpassword123"},
        headers=admin_auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_change_password_too_short(
    test_client: AsyncClient, admin_auth_headers: dict
) -> None:
    response = await test_client.post(
        "/api/profile/change-password",
        json={"current_password": "TestPass123!", "new_password": "short"},
        headers=admin_auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_email_without_password_rejected(
    test_client: AsyncClient, admin_auth_headers: dict
) -> None:
    response = await test_client.patch(
        "/api/profile",
        json={"email": "new@example.com"},
        headers=admin_auth_headers,
    )
    assert response.status_code == 422
