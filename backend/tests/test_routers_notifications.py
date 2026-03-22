import pytest


@pytest.mark.asyncio
async def test_list_notifications_empty(test_client, admin_auth_headers):
    resp = await test_client.get("/api/notifications", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_notifications_limit(test_client, admin_auth_headers, db_session, admin_user):
    from models.notification import Notification
    for i in range(10):
        db_session.add(Notification(
            user_id=admin_user.id, type="test", title=f"N{i}", body="body", read=False, sent_email=False
        ))
    await db_session.flush()

    resp = await test_client.get(
        "/api/notifications?limit=5", headers=admin_auth_headers
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 5


@pytest.mark.asyncio
async def test_mark_notification_read(test_client, admin_auth_headers, db_session, admin_user):
    from models.notification import Notification
    notif = Notification(
        user_id=admin_user.id, type="test", title="T", body="B", read=False, sent_email=False
    )
    db_session.add(notif)
    await db_session.flush()

    resp = await test_client.patch(
        f"/api/notifications/{notif.id}/read", headers=admin_auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["read"] is True
