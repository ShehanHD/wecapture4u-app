import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI, Depends
from dependencies.auth import require_admin

app_test = FastAPI()


@app_test.get("/admin-only")
async def admin_only(user=Depends(require_admin)):
    return {"role": user.role}


@pytest.mark.asyncio
async def test_admin_endpoint_rejects_no_token():
    async with AsyncClient(transport=ASGITransport(app=app_test), base_url="http://test") as c:
        response = await c.get("/admin-only")
    assert response.status_code == 403  # HTTPBearer returns 403 when no token


@pytest.mark.asyncio
async def test_admin_endpoint_rejects_invalid_token():
    async with AsyncClient(transport=ASGITransport(app=app_test), base_url="http://test") as c:
        response = await c.get("/admin-only", headers={"Authorization": "Bearer invalid"})
    assert response.status_code == 401
