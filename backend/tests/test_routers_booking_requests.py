import uuid
import datetime
import pytest
from models.client import Client
from models.booking_request import BookingRequest


async def make_client(db_session) -> Client:
    client = Client(
        name="Test Client",
        email=f"client_{uuid.uuid4().hex[:8]}@test.internal",
    )
    db_session.add(client)
    await db_session.flush()
    return client


async def make_request(db_session, client_id, status="pending") -> BookingRequest:
    req = BookingRequest(
        client_id=client_id,
        preferred_date=datetime.date(2026, 6, 15),
        time_slot="morning",
        addons=[],
        status=status,
    )
    db_session.add(req)
    await db_session.flush()
    return req


@pytest.mark.asyncio
async def test_list_booking_requests_empty(test_client, admin_auth_headers):
    resp = await test_client.get("/api/booking-requests", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_booking_requests_returns_pending(test_client, admin_auth_headers, db_session):
    client = await make_client(db_session)
    await make_request(db_session, client.id, status="pending")
    await make_request(db_session, client.id, status="confirmed")

    resp = await test_client.get("/api/booking-requests?status=pending", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["status"] == "pending"
    assert data[0]["client_name"] == "Test Client"


@pytest.mark.asyncio
async def test_list_booking_requests_status_filter(test_client, admin_auth_headers, db_session):
    client = await make_client(db_session)
    await make_request(db_session, client.id, status="confirmed")

    resp = await test_client.get("/api/booking-requests?status=confirmed", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["status"] == "confirmed"


@pytest.mark.asyncio
async def test_confirm_booking_request(test_client, admin_auth_headers, db_session):
    client = await make_client(db_session)
    req = await make_request(db_session, client.id)

    resp = await test_client.patch(
        f"/api/booking-requests/{req.id}",
        json={"status": "confirmed", "admin_notes": "See you at 9am!"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "confirmed"
    assert data["admin_notes"] == "See you at 9am!"


@pytest.mark.asyncio
async def test_reject_booking_request(test_client, admin_auth_headers, db_session):
    client = await make_client(db_session)
    req = await make_request(db_session, client.id)

    resp = await test_client.patch(
        f"/api/booking-requests/{req.id}",
        json={"status": "rejected", "admin_notes": "Fully booked that week"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "rejected"
    assert data["admin_notes"] == "Fully booked that week"


@pytest.mark.asyncio
async def test_update_booking_request_not_found(test_client, admin_auth_headers):
    resp = await test_client.patch(
        f"/api/booking-requests/{uuid.uuid4()}",
        json={"status": "confirmed"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_booking_requests_unauthenticated(test_client):
    resp = await test_client.get("/api/booking-requests")
    assert resp.status_code == 403
