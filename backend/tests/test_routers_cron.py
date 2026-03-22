from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_cron_daily_notifications_no_auth(test_client):
    """Missing Authorization header returns 401."""
    resp = await test_client.post("/api/cron/daily-notifications")
    assert resp.status_code == 401
    assert resp.headers.get("www-authenticate") == "Bearer"


@pytest.mark.asyncio
async def test_cron_daily_notifications_wrong_token(test_client):
    """Wrong bearer token returns 401."""
    resp = await test_client.post(
        "/api/cron/daily-notifications",
        headers={"Authorization": "Bearer wrong-secret"},
    )
    assert resp.status_code == 401
    assert resp.headers.get("www-authenticate") == "Bearer"


@pytest.mark.asyncio
async def test_cron_daily_notifications_empty_secret(test_client):
    """When CRON_SECRET is unset (empty), all requests are rejected."""
    from config import settings

    original = settings.CRON_SECRET
    try:
        settings.CRON_SECRET = ""
        resp = await test_client.post(
            "/api/cron/daily-notifications",
            headers={"Authorization": "Bearer "},
        )
        assert resp.status_code == 401
    finally:
        settings.CRON_SECRET = original


@pytest.mark.asyncio
async def test_cron_daily_notifications_valid_token(test_client):
    """Valid bearer token returns 204 and triggers run_daily_notifications."""
    from config import settings

    secret = "test-cron-secret-abc123"
    original = settings.CRON_SECRET
    try:
        settings.CRON_SECRET = secret
        with patch(
            "routers.cron.run_daily_notifications", new_callable=AsyncMock
        ) as mock_run:
            resp = await test_client.post(
                "/api/cron/daily-notifications",
                headers={"Authorization": f"Bearer {secret}"},
            )
            assert resp.status_code == 204
            mock_run.assert_awaited_once()
    finally:
        settings.CRON_SECRET = original
