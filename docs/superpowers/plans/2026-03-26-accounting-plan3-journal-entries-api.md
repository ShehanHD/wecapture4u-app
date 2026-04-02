# Journal Entries API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all 6 journal entry endpoints (list, get, create, update, post, void) with business rule enforcement.

**Architecture:** Thin router → service → ORM, matching existing project conventions. `list_entries` computes `total_debit`/`total_credit` via a bulk SQL GROUP BY query (no N+1). `get_entry` and all mutating functions load lines eagerly with `selectinload`. `post_entry` enforces the balance invariant (SUM(debit) == SUM(credit)) before transitioning to `posted`. `void_entry` swaps all debit/credit amounts on a new reversing entry with `void_of = original.id` and marks both entries as `voided`.

**Tech Stack:** FastAPI, SQLAlchemy async, Pydantic v2, pytest-asyncio, real Supabase test DB (savepoint rollback — no mocks)

---

## File Map

| File | Change |
|---|---|
| `backend/schemas/journal.py` | Modify — add `JournalEntryListOut` |
| `backend/services/journal_entries.py` | New — all business logic |
| `backend/routers/journal_entries.py` | New — thin route handlers |
| `backend/main.py` | Modify — register journal_entries router |
| `backend/tests/test_routers_journal_entries.py` | New — integration tests |

---

### Task 1: Schema addition + list/get endpoints + router registration

**Files:**
- Modify: `backend/schemas/journal.py`
- Create: `backend/services/journal_entries.py`
- Create: `backend/routers/journal_entries.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_routers_journal_entries.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_routers_journal_entries.py
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
async def test_list_entries_returns_summary_fields(test_client, admin_auth_headers, db_session):
    ar_id, rev_id = await _get_ar_and_rev_ids(db_session)
    await _seed_entry(db_session, status="draft", lines=[
        {"account_id": ar_id, "debit": "100.00", "credit": "0"},
        {"account_id": rev_id, "debit": "0", "credit": "100.00"},
    ])

    resp = await test_client.get("/api/journal-entries", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    entry = data[0]
    assert "total_debit" in entry
    assert "total_credit" in entry
    assert "lines" not in entry  # summary — no lines embedded
    assert Decimal(entry["total_debit"]) == Decimal("100.00")
    assert Decimal(entry["total_credit"]) == Decimal("100.00")


@pytest.mark.asyncio
async def test_list_entries_filter_by_status(test_client, admin_auth_headers, db_session):
    await _seed_entry(db_session, status="draft")
    await _seed_entry(db_session, status="posted", created_by="system")

    resp = await test_client.get("/api/journal-entries?status=draft", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert all(e["status"] == "draft" for e in resp.json())


@pytest.mark.asyncio
async def test_list_entries_filter_by_date_range(test_client, admin_auth_headers, db_session):
    await _seed_entry(db_session, entry_date=date_type(2026, 1, 10), status="posted", created_by="system")
    await _seed_entry(db_session, entry_date=date_type(2026, 3, 15), status="draft")

    resp = await test_client.get(
        "/api/journal-entries?start_date=2026-03-01&end_date=2026-03-31",
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    for e in data:
        assert e["date"] >= "2026-03-01"
        assert e["date"] <= "2026-03-31"


@pytest.mark.asyncio
async def test_list_entries_filter_by_account_id(test_client, admin_auth_headers, db_session):
    ar_id, rev_id = await _get_ar_and_rev_ids(db_session)
    await _seed_entry(db_session, status="draft", lines=[
        {"account_id": ar_id, "debit": "50.00", "credit": "0"},
        {"account_id": rev_id, "debit": "0", "credit": "50.00"},
    ])

    resp = await test_client.get(
        f"/api/journal-entries?account_id={ar_id}", headers=admin_auth_headers
    )
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_list_entries_pagination(test_client, admin_auth_headers, db_session):
    for _ in range(3):
        await _seed_entry(db_session, status="draft")

    resp_all = await test_client.get("/api/journal-entries?limit=200", headers=admin_auth_headers)
    total = len(resp_all.json())

    resp_page = await test_client.get("/api/journal-entries?limit=2&offset=0", headers=admin_auth_headers)
    assert len(resp_page.json()) == 2

    resp_offset = await test_client.get(
        f"/api/journal-entries?limit=200&offset={total}", headers=admin_auth_headers
    )
    assert resp_offset.json() == []


@pytest.mark.asyncio
async def test_list_entries_ordered_date_desc(test_client, admin_auth_headers, db_session):
    await _seed_entry(db_session, entry_date=date_type(2026, 1, 1), status="draft")
    await _seed_entry(db_session, entry_date=date_type(2026, 6, 1), status="draft")

    resp = await test_client.get("/api/journal-entries", headers=admin_auth_headers)
    dates = [e["date"] for e in resp.json()]
    assert dates == sorted(dates, reverse=True)


@pytest.mark.asyncio
async def test_get_entry_with_lines(test_client, admin_auth_headers, db_session):
    ar_id, rev_id = await _get_ar_and_rev_ids(db_session)
    entry = await _seed_entry(db_session, status="draft", lines=[
        {"account_id": ar_id, "debit": "200.00", "credit": "0"},
        {"account_id": rev_id, "debit": "0", "credit": "200.00"},
    ])

    resp = await test_client.get(f"/api/journal-entries/{entry.id}", headers=admin_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(entry.id)
    assert len(data["lines"]) == 2


@pytest.mark.asyncio
async def test_get_entry_not_found(test_client, admin_auth_headers):
    resp = await test_client.get(f"/api/journal-entries/{uuid4()}", headers=admin_auth_headers)
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_journal_entries.py -v 2>&1 | head -20`

Expected: FAIL — routes not registered yet

- [ ] **Step 3: Add `JournalEntryListOut` to `backend/schemas/journal.py`**

Read the current file first. Add the import of `Decimal` if missing (currently `from decimal import Decimal` may not be there — check). Then append to the end:

```python
class JournalEntryListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    date: date
    description: str
    reference_type: Optional[str]
    reference_id: Optional[uuid.UUID]
    status: str
    created_by: str
    void_of: Optional[uuid.UUID]
    created_at: datetime
    total_debit: Decimal = Decimal("0")
    total_credit: Decimal = Decimal("0")
```

- [ ] **Step 4: Create `backend/services/journal_entries.py`**

```python
import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.journal import JournalEntry, JournalLine


async def _get_or_404(db: AsyncSession, entry_id: uuid.UUID) -> JournalEntry:
    result = await db.execute(
        select(JournalEntry)
        .where(JournalEntry.id == entry_id)
        .options(selectinload(JournalEntry.lines))
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Journal entry not found.")
    return entry


async def list_entries(
    db: AsyncSession,
    *,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    reference_type: Optional[str] = None,
    account_id: Optional[uuid.UUID] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[JournalEntry]:
    q = select(JournalEntry).order_by(JournalEntry.date.desc(), JournalEntry.created_at.desc())

    if status is not None:
        q = q.where(JournalEntry.status == status)
    if start_date is not None:
        q = q.where(JournalEntry.date >= start_date)
    if end_date is not None:
        q = q.where(JournalEntry.date <= end_date)
    if reference_type is not None:
        q = q.where(JournalEntry.reference_type == reference_type)
    if account_id is not None:
        q = q.where(
            JournalEntry.id.in_(
                select(JournalLine.entry_id).where(JournalLine.account_id == account_id)
            )
        )

    result = await db.execute(q.limit(limit).offset(offset))
    entries = list(result.scalars().all())

    if not entries:
        return entries

    # Bulk GROUP BY for total_debit / total_credit — no N+1
    entry_ids = [e.id for e in entries]
    agg_q = (
        select(
            JournalLine.entry_id,
            func.coalesce(func.sum(JournalLine.debit), 0).label("total_debit"),
            func.coalesce(func.sum(JournalLine.credit), 0).label("total_credit"),
        )
        .where(JournalLine.entry_id.in_(entry_ids))
        .group_by(JournalLine.entry_id)
    )
    agg_result = await db.execute(agg_q)
    agg_map: dict[uuid.UUID, tuple[Decimal, Decimal]] = {
        row.entry_id: (Decimal(str(row.total_debit)), Decimal(str(row.total_credit)))
        for row in agg_result
    }

    for entry in entries:
        td, tc = agg_map.get(entry.id, (Decimal("0"), Decimal("0")))
        entry.total_debit = td.quantize(Decimal("0.01"))
        entry.total_credit = tc.quantize(Decimal("0.01"))

    return entries


async def get_entry(db: AsyncSession, *, id: uuid.UUID) -> JournalEntry:
    return await _get_or_404(db, id)
```

- [ ] **Step 5: Create `backend/routers/journal_entries.py`**

```python
import uuid
from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from schemas.journal import (
    JournalEntryCreate,
    JournalEntryListOut,
    JournalEntryOut,
    JournalEntryUpdate,
)
from services import journal_entries as svc

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


@router.get("/journal-entries", response_model=list[JournalEntryListOut])
async def list_journal_entries(
    db: DB, _: Admin,
    status: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    reference_type: Optional[str] = Query(None),
    account_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return await svc.list_entries(
        db,
        status=status,
        start_date=start_date,
        end_date=end_date,
        reference_type=reference_type,
        account_id=account_id,
        limit=limit,
        offset=offset,
    )


@router.get("/journal-entries/{id}", response_model=JournalEntryOut)
async def get_journal_entry(id: uuid.UUID, db: DB, _: Admin):
    return await svc.get_entry(db, id=id)
```

- [ ] **Step 6: Register router in `backend/main.py`**

Add after the accounts router:

```python
from routers.journal_entries import router as journal_entries_router
```

And in the `app.include_router` section:

```python
app.include_router(journal_entries_router, prefix="/api", tags=["journal-entries"])
```

- [ ] **Step 7: Run tests to confirm they pass**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_journal_entries.py -v 2>&1 | tail -20`

Expected: All 9 tests PASS

- [ ] **Step 8: Run full test suite**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest -v 2>&1 | tail -10`

Expected: No regressions

- [ ] **Step 9: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/schemas/journal.py backend/services/journal_entries.py backend/routers/journal_entries.py backend/main.py backend/tests/test_routers_journal_entries.py
git commit -m "feat: add list and get journal entries endpoints"
```

---

### Task 2: Create manual draft entry

**Files:**
- Modify: `backend/services/journal_entries.py`
- Modify: `backend/routers/journal_entries.py`
- Modify: `backend/tests/test_routers_journal_entries.py`

- [ ] **Step 1: Add failing tests**

Append to `backend/tests/test_routers_journal_entries.py`:

```python
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
async def test_create_entry_empty_lines_returns_422(test_client, admin_auth_headers):
    resp = await test_client.post(
        "/api/journal-entries",
        json={"date": "2026-03-10", "description": "No lines", "lines": []},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 422


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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_journal_entries.py -k "create" -v 2>&1 | tail -10`

Expected: FAIL — `404` or `405` (route doesn't exist)

- [ ] **Step 3: Add `create_entry` to `backend/services/journal_entries.py`**

```python
async def create_entry(
    db: AsyncSession,
    *,
    date: date,
    description: str,
    lines: list,
) -> JournalEntry:
    if not lines:
        raise HTTPException(status_code=422, detail="Journal entry must have at least one line.")

    entry = JournalEntry(
        date=date,
        description=description,
        status="draft",
        created_by="manual",
    )
    db.add(entry)
    await db.flush()

    for ln in lines:
        db.add(JournalLine(
            entry_id=entry.id,
            account_id=ln.account_id,
            debit=ln.debit,
            credit=ln.credit,
            description=ln.description,
        ))
    await db.flush()

    # Reload with lines eagerly
    result = await db.execute(
        select(JournalEntry)
        .where(JournalEntry.id == entry.id)
        .options(selectinload(JournalEntry.lines))
    )
    return result.scalar_one()
```

- [ ] **Step 4: Add `POST /journal-entries` route to `backend/routers/journal_entries.py`**

Add BEFORE the `GET /journal-entries/{id}` route (to avoid path conflicts):

```python
@router.post("/journal-entries", response_model=JournalEntryOut, status_code=201)
async def create_journal_entry(body: JournalEntryCreate, db: DB, _: Admin):
    return await svc.create_entry(db, date=body.date, description=body.description, lines=body.lines)
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_journal_entries.py -k "create" -v 2>&1 | tail -10`

Expected: All 3 create tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/journal_entries.py backend/routers/journal_entries.py backend/tests/test_routers_journal_entries.py
git commit -m "feat: add create manual draft journal entry endpoint"
```

---

### Task 3: Update draft entry

**Files:**
- Modify: `backend/services/journal_entries.py`
- Modify: `backend/routers/journal_entries.py`
- Modify: `backend/tests/test_routers_journal_entries.py`

- [ ] **Step 1: Add failing tests**

Append to `backend/tests/test_routers_journal_entries.py`:

```python
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_journal_entries.py -k "update" -v 2>&1 | tail -10`

Expected: FAIL — `405` (route doesn't exist)

- [ ] **Step 3: Add `update_entry` to `backend/services/journal_entries.py`**

```python
async def update_entry(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    date: Optional[date] = None,
    description: Optional[str] = None,
    lines: Optional[list] = None,
) -> JournalEntry:
    entry = await _get_or_404(db, id)

    if entry.status != "draft":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot update a journal entry with status '{entry.status}'. Only draft entries may be updated.",
        )

    if date is not None:
        entry.date = date
    if description is not None:
        entry.description = description

    if lines is not None:
        for existing_line in list(entry.lines):
            await db.delete(existing_line)
        await db.flush()

        for ln in lines:
            db.add(JournalLine(
                entry_id=entry.id,
                account_id=ln.account_id,
                debit=ln.debit,
                credit=ln.credit,
                description=ln.description,
            ))

    await db.flush()

    # Reload with fresh lines
    result = await db.execute(
        select(JournalEntry)
        .where(JournalEntry.id == id)
        .options(selectinload(JournalEntry.lines))
    )
    return result.scalar_one()
```

- [ ] **Step 4: Add `PATCH /journal-entries/{id}` route to `backend/routers/journal_entries.py`**

```python
@router.patch("/journal-entries/{id}", response_model=JournalEntryOut)
async def update_journal_entry(id: uuid.UUID, body: JournalEntryUpdate, db: DB, _: Admin):
    return await svc.update_entry(
        db,
        id=id,
        date=body.date,
        description=body.description,
        lines=body.lines,
    )
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_journal_entries.py -k "update" -v 2>&1 | tail -10`

Expected: All 5 update tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/journal_entries.py backend/routers/journal_entries.py backend/tests/test_routers_journal_entries.py
git commit -m "feat: add update draft journal entry endpoint"
```

---

### Task 4: Post entry

**Files:**
- Modify: `backend/services/journal_entries.py`
- Modify: `backend/routers/journal_entries.py`
- Modify: `backend/tests/test_routers_journal_entries.py`

- [ ] **Step 1: Add failing tests**

Append to `backend/tests/test_routers_journal_entries.py`:

```python
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
        {"account_id": rev_id, "debit": "0", "credit": "400.00"},  # unbalanced
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_journal_entries.py -k "post" -v 2>&1 | tail -10`

Expected: FAIL — `405` (route doesn't exist)

- [ ] **Step 3: Add `post_entry` to `backend/services/journal_entries.py`**

```python
async def post_entry(db: AsyncSession, *, id: uuid.UUID) -> JournalEntry:
    entry = await _get_or_404(db, id)

    if entry.status != "draft":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot post a journal entry with status '{entry.status}'. Only draft entries may be posted.",
        )

    if not entry.lines:
        raise HTTPException(status_code=422, detail="Cannot post an entry with no lines.")

    total_debit = sum(Decimal(str(ln.debit)) for ln in entry.lines)
    total_credit = sum(Decimal(str(ln.credit)) for ln in entry.lines)

    if total_debit != total_credit:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Journal entry is unbalanced: "
                f"total debit {total_debit:.2f} ≠ total credit {total_credit:.2f}."
            ),
        )

    entry.status = "posted"
    await db.flush()
    return entry
```

- [ ] **Step 4: Add `POST /journal-entries/{id}/post` route to `backend/routers/journal_entries.py`**

```python
@router.post("/journal-entries/{id}/post", response_model=JournalEntryOut)
async def post_journal_entry(id: uuid.UUID, db: DB, _: Admin):
    return await svc.post_entry(db, id=id)
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_journal_entries.py -k "post" -v 2>&1 | tail -10`

Expected: All 4 post tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/journal_entries.py backend/routers/journal_entries.py backend/tests/test_routers_journal_entries.py
git commit -m "feat: add post journal entry endpoint with balance invariant validation"
```

---

### Task 5: Void posted entry

**Files:**
- Modify: `backend/services/journal_entries.py`
- Modify: `backend/routers/journal_entries.py`
- Modify: `backend/tests/test_routers_journal_entries.py`

- [ ] **Step 1: Add failing tests**

Append to `backend/tests/test_routers_journal_entries.py`:

```python
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

    # Returns reversing entry
    assert data["status"] == "voided"
    assert data["void_of"] == str(entry.id)
    assert data["created_by"] == "manual"

    # Lines have swapped debit/credit
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

    # Seed the reversing entry (void_of IS NOT NULL, status="voided")
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_journal_entries.py -k "void" -v 2>&1 | tail -10`

Expected: FAIL — `405`

- [ ] **Step 3: Add `void_entry` to `backend/services/journal_entries.py`**

`date.today()` is called here. The import `from datetime import date` at module level is unambiguous — `void_entry` has no `date` parameter. The reversing entry gets `status="voided"` and `void_of=entry.id`. The original gets `status="voided"`. Both are excluded from posted-balance queries (`WHERE status = 'posted'`).

```python
async def void_entry(db: AsyncSession, *, id: uuid.UUID) -> JournalEntry:
    entry = await _get_or_404(db, id)

    if entry.status != "posted":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot void a journal entry with status '{entry.status}'. Only posted entries may be voided.",
        )

    if entry.void_of is not None:
        raise HTTPException(
            status_code=409,
            detail="Cannot void a reversing entry. Create a manual correction entry instead.",
        )

    # Create reversing entry
    reversing = JournalEntry(
        date=date.today(),
        description=f"Void of: {entry.description}",
        status="voided",
        created_by="manual",
        void_of=entry.id,
    )
    db.add(reversing)
    await db.flush()

    # Swap debit/credit on each line
    for ln in entry.lines:
        db.add(JournalLine(
            entry_id=reversing.id,
            account_id=ln.account_id,
            debit=ln.credit,   # swapped
            credit=ln.debit,   # swapped
            description=ln.description,
        ))

    # Mark original as voided
    entry.status = "voided"
    await db.flush()

    # Reload reversing entry with its lines
    result = await db.execute(
        select(JournalEntry)
        .where(JournalEntry.id == reversing.id)
        .options(selectinload(JournalEntry.lines))
    )
    return result.scalar_one()
```

- [ ] **Step 4: Add `POST /journal-entries/{id}/void` route to `backend/routers/journal_entries.py`**

```python
@router.post("/journal-entries/{id}/void", response_model=JournalEntryOut)
async def void_journal_entry(id: uuid.UUID, db: DB, _: Admin):
    return await svc.void_entry(db, id=id)
```

- [ ] **Step 5: Run void tests**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_journal_entries.py -k "void" -v 2>&1 | tail -10`

Expected: All 5 void tests PASS

- [ ] **Step 6: Run full journal entries test suite**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest tests/test_routers_journal_entries.py -v 2>&1 | tail -30`

Expected: All tests PASS

- [ ] **Step 7: Run full project test suite**

Run: `/Users/don/Desktop/weCapture4U-app/backend/venv/bin/pytest -v 2>&1 | tail -10`

Expected: No regressions

- [ ] **Step 8: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/journal_entries.py backend/routers/journal_entries.py backend/tests/test_routers_journal_entries.py
git commit -m "feat: add void journal entry endpoint with reversing entry creation"
```

---

## Architectural notes

**`selectinload` requirement:** `JournalEntry.lines` has `lazy="select"`, which raises a greenlet error in async SQLAlchemy if accessed without eager loading. Every code path that touches `.lines` must use `.options(selectinload(JournalEntry.lines))`. `list_entries` intentionally does NOT load lines — it uses a bulk GROUP BY query instead.

**Dynamic attributes (`total_debit`/`total_credit`):** Set directly on ORM instances (`entry.total_debit = td`) before returning. Pydantic's `from_attributes=True` on `JournalEntryListOut` picks them up via `getattr`. This mirrors the `account.balance` pattern in `services/accounts.py`.

**`date` shadowing:** In `create_entry` and `update_entry`, the parameter `date: date` shadows the `date` type inside those function bodies. This is intentional — `date.today()` is never called inside those functions. `void_entry` has no `date` parameter and calls `date.today()` safely.

**Void chain prevention:** The guard `if entry.void_of is not None` blocks voiding a reversing entry. Since the first void guard (`status != 'posted'`) would already block most cases (reversing entries have `status="voided"`), this guard is a belt-and-suspenders check for correctness and clear error messaging.

**Note:** The `POST /api/journal-entries/preview` endpoint (auto-draft generation for business events) is not part of this plan. It will be added in Plan 4 (Expenses API) and Plan 5 (Invoice Payments API) since those require domain knowledge of invoices, expenses, and appointments.
