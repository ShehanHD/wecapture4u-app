import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_settings_requires_auth(test_client: AsyncClient):
    resp = await test_client.get("/api/settings")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_settings_ok(test_client: AsyncClient, admin_auth_headers: dict):
    resp = await test_client.get("/api/settings", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "tax_enabled" in data
    assert "pdf_invoices_enabled" in data


@pytest.mark.asyncio
async def test_patch_settings(test_client: AsyncClient, admin_auth_headers: dict):
    resp = await test_client.patch(
        "/api/settings",
        json={"tax_enabled": True, "tax_rate": "8.00"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["tax_enabled"] is True


@pytest.mark.asyncio
async def test_list_session_types_public(test_client: AsyncClient):
    resp = await test_client.get("/api/session-types")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_create_session_type_requires_auth(test_client: AsyncClient):
    resp = await test_client.post("/api/session-types", json={"name": "Wedding"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_session_type(test_client: AsyncClient, admin_auth_headers: dict, db_session):
    from models.session_type import SessionType
    st = SessionType(name="Portrait")
    db_session.add(st)
    await db_session.flush()

    resp = await test_client.delete(
        f"/api/session-types/{st.id}", headers=admin_auth_headers
    )
    # No appointments reference it yet — should succeed
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_session_type_available_days(test_client: AsyncClient, admin_auth_headers: dict):
    resp = await test_client.post(
        "/api/session-types",
        json={"name": "Newborn", "available_days": [0, 2, 4]},  # Mon, Wed, Fri
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["available_days"] == [0, 2, 4]

    # Update available_days only
    resp2 = await test_client.patch(
        f"/api/session-types/{data['id']}",
        json={"available_days": [5, 6]},  # Sat, Sun
        headers=admin_auth_headers,
    )
    assert resp2.status_code == 200
    assert resp2.json()["available_days"] == [5, 6]
    assert resp2.json()["name"] == "Newborn"  # name preserved after partial update

    # List returns available_days
    resp3 = await test_client.get("/api/session-types", headers=admin_auth_headers)
    assert resp3.status_code == 200
    match = next((t for t in resp3.json() if t["id"] == data["id"]), None)
    assert match is not None
    assert match["available_days"] == [5, 6]
