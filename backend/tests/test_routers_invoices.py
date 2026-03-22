import pytest
from uuid import uuid4


@pytest.mark.asyncio
async def test_create_invoice(test_client, admin_auth_headers, db_session):
    from models.client import Client
    client = Client(name="Henry", email=f"henry_{uuid4().hex[:8]}@example.com", tags=[])
    db_session.add(client)
    await db_session.flush()

    resp = await test_client.post(
        "/api/invoices",
        json={"client_id": str(client.id)},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "draft"
    assert data["subtotal"] == "0.00"


@pytest.mark.asyncio
async def test_add_item_recalculates_totals(test_client, admin_auth_headers, db_session):
    from models.client import Client
    client = Client(name="Iris", email=f"iris_{uuid4().hex[:8]}@example.com", tags=[])
    db_session.add(client)
    await db_session.flush()

    inv_resp = await test_client.post(
        "/api/invoices",
        json={"client_id": str(client.id)},
        headers=admin_auth_headers,
    )
    inv_id = inv_resp.json()["id"]

    item_resp = await test_client.post(
        f"/api/invoices/{inv_id}/items",
        json={"description": "Session fee", "quantity": "1", "unit_price": "500.00"},
        headers=admin_auth_headers,
    )
    assert item_resp.status_code == 201

    inv_detail = await test_client.get(f"/api/invoices/{inv_id}", headers=admin_auth_headers)
    assert inv_detail.json()["subtotal"] == "500.00"
    assert inv_detail.json()["total"] == "500.00"


@pytest.mark.asyncio
async def test_delete_non_draft_invoice_blocked(test_client, admin_auth_headers, db_session):
    from models.client import Client
    from models.invoice import Invoice

    client = Client(name="Jack", email=f"jack_{uuid4().hex[:8]}@example.com", tags=[])
    db_session.add(client)
    await db_session.flush()

    invoice = Invoice(client_id=client.id, status="sent")
    db_session.add(invoice)
    await db_session.flush()

    resp = await test_client.delete(
        f"/api/invoices/{invoice.id}", headers=admin_auth_headers
    )
    assert resp.status_code == 409
