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
