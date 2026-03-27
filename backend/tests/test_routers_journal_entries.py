import pytest
from uuid import uuid4
from datetime import date as date_type
from decimal import Decimal


# ── helpers ──────────────────────────────────────────────────────────────────

async def _seed_entry(db_session, *, entry_date=None, status="draft", created_by="manual",
                      lines=None, void_of=None, reference_type=None):
    """Creates a JournalEntry (and optional lines) directly via ORM."""
    from models.journal import JournalEntry, JournalLine
    entry = JournalEntry(
        date=entry_date or date_type(2026, 3, 1),
        description="Test entry",
        status=status,
        created_by=created_by,
        void_of=void_of,
        reference_type=reference_type,
    )
    db_session.add(entry)
    await db_session.flush()
    if lines:
        for ln in lines:
            db_session.add(JournalLine(entry_id=entry.id, **ln))
        await db_session.flush()
    return entry


async def _get_ar_and_rev_ids(db_session):
    from sqlalchemy import text
    r1 = await db_session.execute(text("SELECT id FROM accounts WHERE code = '1100'"))
    r2 = await db_session.execute(text("SELECT id FROM accounts WHERE code = '4000'"))
    return r1.scalar_one(), r2.scalar_one()


# ── Task 1: list + get ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_entries_empty(test_client, admin_auth_headers):
    resp = await test_client.get("/api/journal-entries", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_list_entries_returns_seeded(test_client, admin_auth_headers, db_session):
    await _seed_entry(db_session, status="posted")
    resp = await test_client.get("/api/journal-entries", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    entry = data[0]
    assert "id" in entry
    assert "date" in entry
    assert "description" in entry
    assert "status" in entry
    assert "total_debit" in entry
    assert "total_credit" in entry


@pytest.mark.asyncio
async def test_list_entries_filter_status(test_client, admin_auth_headers, db_session):
    await _seed_entry(db_session, status="draft")
    await _seed_entry(db_session, status="posted")
    resp = await test_client.get("/api/journal-entries?status=draft", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert all(e["status"] == "draft" for e in data)


@pytest.mark.asyncio
async def test_get_entry_not_found(test_client, admin_auth_headers):
    resp = await test_client.get(f"/api/journal-entries/{uuid4()}", headers=admin_auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_entry_returns_lines(test_client, admin_auth_headers, db_session):
    ar_id, rev_id = await _get_ar_and_rev_ids(db_session)
    entry = await _seed_entry(db_session, lines=[
        {"account_id": ar_id, "debit": Decimal("100.00"), "credit": Decimal("0.00")},
        {"account_id": rev_id, "debit": Decimal("0.00"), "credit": Decimal("100.00")},
    ])
    resp = await test_client.get(f"/api/journal-entries/{entry.id}", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(entry.id)
    assert len(data["lines"]) == 2
