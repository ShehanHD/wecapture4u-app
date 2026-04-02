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


# ── Task 2: create ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_draft_entry_success(test_client, admin_auth_headers, db_session):
    ar_id, rev_id = await _get_ar_and_rev_ids(db_session)
    resp = await test_client.post(
        "/api/journal-entries",
        json={
            "date": "2026-03-10",
            "description": "Manual test entry",
            "lines": [
                {"account_id": str(ar_id), "debit": "150.00", "credit": "0.00"},
                {"account_id": str(rev_id), "debit": "0.00", "credit": "150.00"},
            ],
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "draft"
    assert data["created_by"] == "manual"
    assert data["date"] == "2026-03-10"
    assert len(data["lines"]) == 2
    assert data["void_of"] is None


@pytest.mark.asyncio
async def test_create_entry_empty_lines_creates_draft(test_client, admin_auth_headers):
    resp = await test_client.post(
        "/api/journal-entries",
        json={"date": "2026-03-10", "description": "No lines", "lines": []},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "draft"
    assert resp.json()["lines"] == []


@pytest.mark.asyncio
async def test_create_entry_returns_lines_with_ids(test_client, admin_auth_headers, db_session):
    ar_id, rev_id = await _get_ar_and_rev_ids(db_session)
    resp = await test_client.post(
        "/api/journal-entries",
        json={
            "date": "2026-03-12",
            "description": "Line IDs test",
            "lines": [
                {"account_id": str(ar_id), "debit": "75.00", "credit": "0.00"},
                {"account_id": str(rev_id), "debit": "0.00", "credit": "75.00"},
            ],
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    for line in resp.json()["lines"]:
        assert "id" in line
        assert "entry_id" in line


# ── Task 3: update draft ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_draft_description(test_client, admin_auth_headers, db_session):
    ar_id, rev_id = await _get_ar_and_rev_ids(db_session)
    entry = await _seed_entry(db_session, status="draft", lines=[
        {"account_id": ar_id, "debit": "100.00", "credit": "0"},
        {"account_id": rev_id, "debit": "0", "credit": "100.00"},
    ])

    resp = await test_client.patch(
        f"/api/journal-entries/{entry.id}",
        json={"description": "Updated description"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["description"] == "Updated description"


@pytest.mark.asyncio
async def test_update_draft_replaces_lines(test_client, admin_auth_headers, db_session):
    ar_id, rev_id = await _get_ar_and_rev_ids(db_session)
    entry = await _seed_entry(db_session, status="draft", lines=[
        {"account_id": ar_id, "debit": "100.00", "credit": "0"},
        {"account_id": rev_id, "debit": "0", "credit": "100.00"},
    ])

    resp = await test_client.patch(
        f"/api/journal-entries/{entry.id}",
        json={
            "lines": [
                {"account_id": str(ar_id), "debit": "250.00", "credit": "0.00"},
                {"account_id": str(rev_id), "debit": "0.00", "credit": "250.00"},
            ]
        },
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["lines"]) == 2
    debits = {Decimal(ln["debit"]) for ln in data["lines"]}
    assert Decimal("250.00") in debits


@pytest.mark.asyncio
async def test_update_posted_entry_returns_409(test_client, admin_auth_headers, db_session):
    entry = await _seed_entry(db_session, status="posted", created_by="system")

    resp = await test_client.patch(
        f"/api/journal-entries/{entry.id}",
        json={"description": "Cannot update posted"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_update_voided_entry_returns_409(test_client, admin_auth_headers, db_session):
    entry = await _seed_entry(db_session, status="voided", created_by="system")

    resp = await test_client.patch(
        f"/api/journal-entries/{entry.id}",
        json={"description": "Cannot update voided"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_update_entry_not_found(test_client, admin_auth_headers):
    resp = await test_client.patch(
        f"/api/journal-entries/{uuid4()}",
        json={"description": "Ghost"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 404


# ── Task 4: post ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_post_balanced_entry_succeeds(test_client, admin_auth_headers, db_session):
    ar_id, rev_id = await _get_ar_and_rev_ids(db_session)
    entry = await _seed_entry(db_session, status="draft", lines=[
        {"account_id": ar_id, "debit": "500.00", "credit": "0"},
        {"account_id": rev_id, "debit": "0", "credit": "500.00"},
    ])

    resp = await test_client.post(f"/api/journal-entries/{entry.id}/post", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "posted"


@pytest.mark.asyncio
async def test_post_unbalanced_entry_returns_422(test_client, admin_auth_headers, db_session):
    ar_id, rev_id = await _get_ar_and_rev_ids(db_session)
    entry = await _seed_entry(db_session, status="draft", lines=[
        {"account_id": ar_id, "debit": "500.00", "credit": "0"},
        {"account_id": rev_id, "debit": "0", "credit": "400.00"},
    ])

    resp = await test_client.post(f"/api/journal-entries/{entry.id}/post", headers=admin_auth_headers)
    assert resp.status_code == 422
    assert "unbalanced" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_post_already_posted_entry_returns_409(test_client, admin_auth_headers, db_session):
    ar_id, rev_id = await _get_ar_and_rev_ids(db_session)
    entry = await _seed_entry(db_session, status="posted", created_by="system", lines=[
        {"account_id": ar_id, "debit": "100.00", "credit": "0"},
        {"account_id": rev_id, "debit": "0", "credit": "100.00"},
    ])

    resp = await test_client.post(f"/api/journal-entries/{entry.id}/post", headers=admin_auth_headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_post_entry_not_found(test_client, admin_auth_headers):
    resp = await test_client.post(f"/api/journal-entries/{uuid4()}/post", headers=admin_auth_headers)
    assert resp.status_code == 404


# ── Task 5: void ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_void_posted_entry_succeeds(test_client, admin_auth_headers, db_session):
    ar_id, rev_id = await _get_ar_and_rev_ids(db_session)
    entry = await _seed_entry(db_session, status="posted", created_by="system", lines=[
        {"account_id": ar_id, "debit": "300.00", "credit": "0"},
        {"account_id": rev_id, "debit": "0", "credit": "300.00"},
    ])

    resp = await test_client.post(f"/api/journal-entries/{entry.id}/void", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "voided"
    assert data["void_of"] == str(entry.id)
    assert data["created_by"] == "manual"

    lines_by_account = {ln["account_id"]: ln for ln in data["lines"]}
    ar_line = lines_by_account[str(ar_id)]
    rev_line = lines_by_account[str(rev_id)]
    assert Decimal(ar_line["debit"]) == Decimal("0.00")
    assert Decimal(ar_line["credit"]) == Decimal("300.00")
    assert Decimal(rev_line["debit"]) == Decimal("300.00")
    assert Decimal(rev_line["credit"]) == Decimal("0.00")


@pytest.mark.asyncio
async def test_void_marks_original_as_voided(test_client, admin_auth_headers, db_session):
    ar_id, rev_id = await _get_ar_and_rev_ids(db_session)
    entry = await _seed_entry(db_session, status="posted", created_by="system", lines=[
        {"account_id": ar_id, "debit": "100.00", "credit": "0"},
        {"account_id": rev_id, "debit": "0", "credit": "100.00"},
    ])

    await test_client.post(f"/api/journal-entries/{entry.id}/void", headers=admin_auth_headers)

    resp = await test_client.get(f"/api/journal-entries/{entry.id}", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "voided"


@pytest.mark.asyncio
async def test_void_draft_entry_returns_409(test_client, admin_auth_headers, db_session):
    entry = await _seed_entry(db_session, status="draft")

    resp = await test_client.post(f"/api/journal-entries/{entry.id}/void", headers=admin_auth_headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_void_reversing_entry_returns_409(test_client, admin_auth_headers, db_session):
    ar_id, rev_id = await _get_ar_and_rev_ids(db_session)
    original = await _seed_entry(db_session, status="posted", created_by="system", lines=[
        {"account_id": ar_id, "debit": "100.00", "credit": "0"},
        {"account_id": rev_id, "debit": "0", "credit": "100.00"},
    ])

    reversing = await _seed_entry(
        db_session,
        status="voided",
        created_by="manual",
        void_of=original.id,
        lines=[
            {"account_id": ar_id, "debit": "0", "credit": "100.00"},
            {"account_id": rev_id, "debit": "100.00", "credit": "0"},
        ],
    )

    resp = await test_client.post(f"/api/journal-entries/{reversing.id}/void", headers=admin_auth_headers)
    assert resp.status_code == 409
    assert "reversing" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_void_entry_not_found(test_client, admin_auth_headers):
    resp = await test_client.post(f"/api/journal-entries/{uuid4()}/void", headers=admin_auth_headers)
    assert resp.status_code == 404
