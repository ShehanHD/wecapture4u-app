# Album Stages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate album production Kanban to the Jobs page — jobs with an `album` addon auto-enter "On Hold" and progress independently through 7 album stages; admin manages stages in Settings; clients see a progress bar in their portal.

**Architecture:** Separate `album_stages` table + nullable `album_stage_id` FK on `jobs`. Backend mirrors the existing `job_stages` pattern exactly (model → schema → service → router). Frontend adds an Albums tab to Jobs, an Album Stages section to Settings, and an `AlbumProgressBar` to the client portal job detail.

**Tech Stack:** FastAPI, SQLAlchemy async, Pydantic v2, pytest-asyncio; React 18, TanStack Query v5, @dnd-kit, Zod, shadcn/ui Tabs.

---

## File Map

**Create:**
- `migrations/012_album_stages.sql`
- `backend/tests/test_routers_album_stages.py`

**Modify:**
- `backend/models/job.py` — add `AlbumStage` model + `album_stage_id` / `album_stage` on `Job`
- `backend/schemas/jobs.py` — add `AlbumStage*` schemas; extend `JobOut`, `JobDetailOut`, `JobUpdate`
- `backend/services/settings.py` — add album stage CRUD (mirrors job stage functions)
- `backend/services/jobs.py` — extend `_job_options`, `create_job` auto-assign, `get_job_detail`, `update_job`
- `backend/routers/jobs.py` — add 5 album stage endpoints
- `frontend/src/schemas/jobs.ts` — add `AlbumStageSchema`; extend `JobSchema` / `JobDetailSchema`
- `frontend/src/api/jobs.ts` — add album stage API functions
- `frontend/src/hooks/useJobs.ts` — add album stage hooks
- `frontend/src/pages/admin/Jobs.tsx` — add Work/Albums tabs + Album Kanban
- `frontend/src/pages/admin/Settings.tsx` — add Album Stages tab section

**Investigate + modify (Task 13):**
- Client portal job detail page — find via `frontend/src/routes/index.tsx`, add `AlbumProgressBar`

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/012_album_stages.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- migrations/012_album_stages.sql
-- Adds album_stages table and album_stage_id FK to jobs.
-- Depends on 001 (jobs table). Run after 011.

CREATE TABLE album_stages (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         TEXT NOT NULL,
    color        TEXT NOT NULL,
    position     INTEGER NOT NULL,
    is_terminal  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jobs
    ADD COLUMN album_stage_id UUID REFERENCES album_stages(id) ON DELETE SET NULL;

-- Seed default stages
INSERT INTO album_stages (name, color, position, is_terminal) VALUES
    ('On Hold',    '#6b7280', 1, FALSE),
    ('Selecting',  '#3b82f6', 2, FALSE),
    ('Designing',  '#8b5cf6', 3, FALSE),
    ('Printing',   '#f59e0b', 4, FALSE),
    ('Dispatched', '#ec4899', 5, FALSE),
    ('Arrived',    '#14b8a6', 6, FALSE),
    ('Delivered',  '#10b981', 7, TRUE);
```

- [ ] **Step 2: Apply the migration**

Run in the Supabase SQL editor or via psql:
```bash
psql $DATABASE_URL -f migrations/012_album_stages.sql
```

Verify: `SELECT * FROM album_stages ORDER BY position;` → 7 rows. `\d jobs` → `album_stage_id` column present.

- [ ] **Step 3: Commit**

```bash
git add migrations/012_album_stages.sql
git commit -m "feat: add album_stages table and album_stage_id to jobs"
```

---

## Task 2: Backend Model

**Files:**
- Modify: `backend/models/job.py`

- [ ] **Step 1: Add `AlbumStage` model and `album_stage_id` to `Job`**

Open `backend/models/job.py`. After the `JobStage` class definition and before the `Job` class, add:

```python
class AlbumStage(Base):
    __tablename__ = "album_stages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False)
    position = Column(Integer, nullable=False)
    is_terminal = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    jobs = relationship("Job", back_populates="album_stage", lazy="select")
```

In the `Job` class, add after the `delivery_url` column:

```python
album_stage_id = Column(UUID(as_uuid=True), ForeignKey("album_stages.id", ondelete="SET NULL"), nullable=True)
```

In the `Job` relationships block, add after `stage = relationship(...)`:

```python
album_stage = relationship("AlbumStage", back_populates="jobs", lazy="select")
```

- [ ] **Step 2: Verify import is clean**

```bash
cd backend && python -c "from models.job import Job, JobStage, AlbumStage; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/models/job.py
git commit -m "feat: add AlbumStage model and album_stage_id to Job"
```

---

## Task 3: Backend Schemas

**Files:**
- Modify: `backend/schemas/jobs.py`

- [ ] **Step 1: Add `AlbumStage*` schemas**

After the `StagePositionReorder` class in `backend/schemas/jobs.py`, add:

```python
class AlbumStageCreate(BaseModel):
    name: str
    color: str  # hex e.g. '#6b7280'
    is_terminal: bool = False


class AlbumStageUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    is_terminal: Optional[bool] = None


class AlbumStageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str
    position: int
    is_terminal: bool
    created_at: datetime


class AlbumStagePositionReorder(BaseModel):
    stages: list[StagePositionItem]
```

- [ ] **Step 2: Extend `JobOut` with album stage fields**

In the `JobOut` class, add after `delivery_url`:

```python
album_stage_id: Optional[uuid.UUID] = None
album_stage: Optional[StageSummary] = None
```

- [ ] **Step 3: Un-alias `JobDetailOut` and add `album_stages` list**

Replace the current `JobDetailOut` alias line with:

```python
class JobDetailOut(JobOut):
    """Extends JobOut with the full ordered album stage list (for progress bar rendering)."""
    album_stages: list[AlbumStageOut] = []
```

- [ ] **Step 4: Extend `JobUpdate` to accept `album_stage_id`**

In `JobUpdate`, add:

```python
album_stage_id: Optional[uuid.UUID] = None
```

- [ ] **Step 5: Verify**

```bash
cd backend && python -c "from schemas.jobs import AlbumStageOut, AlbumStageCreate, JobDetailOut; print('OK')"
```

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/schemas/jobs.py
git commit -m "feat: add AlbumStage schemas and extend Job schemas"
```

---

## Task 4: Settings Service — Album Stage CRUD

**Files:**
- Modify: `backend/services/settings.py`

- [ ] **Step 1: Add `AlbumStage` import**

At the top of `backend/services/settings.py`, extend the model import line:

```python
from models.job import JobStage, Job, AlbumStage
```

- [ ] **Step 2: Add album stage CRUD functions**

Append to the end of `backend/services/settings.py`:

```python
# ─── Album Stages ────────────────────────────────────────────────────────────

async def list_album_stages(db: AsyncSession) -> list[AlbumStage]:
    result = await db.execute(select(AlbumStage).order_by(AlbumStage.position))
    return list(result.scalars().all())


async def create_album_stage(
    db: AsyncSession, *, name: str, color: str, is_terminal: bool = False
) -> AlbumStage:
    max_pos = await db.scalar(select(func.max(AlbumStage.position)))
    position = (max_pos or 0) + 1
    stage = AlbumStage(name=name, color=color, position=position, is_terminal=is_terminal)
    db.add(stage)
    await db.flush()
    return stage


async def update_album_stage(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    name: Optional[str] = None,
    color: Optional[str] = None,
    is_terminal: Optional[bool] = None,
) -> AlbumStage:
    result = await db.execute(select(AlbumStage).where(AlbumStage.id == id))
    stage = result.scalar_one_or_none()
    if stage is None:
        raise HTTPException(status_code=404, detail="Album stage not found")
    if name is not None:
        stage.name = name
    if color is not None:
        stage.color = color
    if is_terminal is not None:
        stage.is_terminal = is_terminal
    await db.flush()
    return stage


async def reorder_album_stages(
    db: AsyncSession, *, stages: list[dict]
) -> list[AlbumStage]:
    existing = await list_album_stages(db)
    existing_ids = {s.id for s in existing}
    incoming_ids = {uuid.UUID(str(s["id"])) for s in stages}
    validate_stage_position_set(existing_ids, incoming_ids)

    stage_map = {s.id: s for s in existing}
    for item in stages:
        stage_map[uuid.UUID(str(item["id"]))].position = item["position"]
    await db.flush()
    return sorted(existing, key=lambda s: s.position)


async def delete_album_stage(db: AsyncSession, *, id: uuid.UUID) -> None:
    result = await db.execute(select(AlbumStage).where(AlbumStage.id == id))
    stage = result.scalar_one_or_none()
    if stage is None:
        raise HTTPException(status_code=404, detail="Album stage not found")
    job_count = await db.scalar(
        select(func.count()).select_from(Job).where(Job.album_stage_id == id)
    )
    if job_count and job_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"{job_count} job(s) are in this album stage. Move them first.",
        )
    await db.delete(stage)
    await db.flush()
```

- [ ] **Step 3: Verify**

```bash
cd backend && python -c "from services.settings import list_album_stages, create_album_stage; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/services/settings.py
git commit -m "feat: add album stage CRUD to settings service"
```

---

## Task 5: Jobs Service — Auto-Assign + Extend

**Files:**
- Modify: `backend/services/jobs.py`

- [ ] **Step 1: Add `AlbumStage` import**

In `backend/services/jobs.py`, extend the models import:

```python
from models.job import Job, JobStage, AlbumStage
```

- [ ] **Step 2: Add `album_stage` to `_job_options()`**

Replace the `_job_options` function:

```python
def _job_options():
    return [
        selectinload(Job.client),
        selectinload(Job.appointment),
        selectinload(Job.stage),
        selectinload(Job.album_stage),
    ]
```

- [ ] **Step 3: Auto-assign album stage on job creation**

Replace the current `create_job` function:

```python
async def create_job(db: AsyncSession, *, data: dict) -> Job:
    job = Job(**data)
    db.add(job)
    await db.flush()

    # Auto-assign first album stage if the appointment has the 'album' addon
    if job.appointment_id:
        from models.appointment import Appointment
        appt = await db.get(Appointment, job.appointment_id)
        if appt and 'album' in (appt.addons or []):
            first_stage = await db.scalar(
                select(AlbumStage).order_by(AlbumStage.position).limit(1)
            )
            if first_stage:
                job.album_stage_id = first_stage.id
                await db.flush()
            else:
                logger.warning("No album stages seeded — job %s created without album_stage_id", job.id)

    return job
```

- [ ] **Step 4: Extend `get_job_detail` to embed `album_stages` list**

Replace the `get_job_detail` function:

```python
async def get_job_detail(db: AsyncSession, *, id: uuid.UUID):
    """Return JobDetailOut with appointment session types resolved and full album stages list."""
    from models.session_type import SessionType
    from schemas.jobs import JobDetailOut, AppointmentSummary, SessionTypeSummary, AlbumStageOut

    job = await get_job(db, id=id)
    out = JobDetailOut.model_validate(job)

    if job.appointment and job.appointment.session_type_ids:
        st_result = await db.execute(
            select(SessionType).where(SessionType.id.in_(job.appointment.session_type_ids))
        )
        out.appointment = AppointmentSummary.model_validate(job.appointment)
        out.appointment.session_types = [
            SessionTypeSummary.model_validate(st) for st in st_result.scalars().all()
        ]

    # Embed full ordered album stages for progress bar rendering
    if job.album_stage_id is not None:
        album_stages_result = await db.execute(
            select(AlbumStage).order_by(AlbumStage.position)
        )
        out.album_stages = [
            AlbumStageOut.model_validate(s) for s in album_stages_result.scalars().all()
        ]

    return out
```

- [ ] **Step 5: Allow `album_stage_id` in `update_job`**

The current `update_job` already does `setattr(job, key, value)` for all keys — no change needed. But verify `JobUpdate` schema now includes `album_stage_id` (done in Task 3). Also verify the `update_job` null-guard doesn't skip `None` unintentionally:

Current code: `if value is not None: setattr(job, key, value)` — this means you can never clear `album_stage_id` back to `None`. That's acceptable for now (album jobs stay in their last stage).

- [ ] **Step 6: Verify**

```bash
cd backend && python -c "from services.jobs import create_job, get_job_detail; print('OK')"
```

Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add backend/services/jobs.py
git commit -m "feat: auto-assign album stage on job creation, embed album_stages in detail"
```

---

## Task 6: Router — Album Stage Endpoints

**Files:**
- Modify: `backend/routers/jobs.py`

- [ ] **Step 1: Add `AlbumStage` schema imports**

In `backend/routers/jobs.py`, extend the schemas import:

```python
from schemas.jobs import (
    JobCreate, JobUpdate, JobOut, JobDetailOut,
    JobStageCreate, JobStageUpdate, JobStageOut,
    StagePositionReorder,
    AlbumStageCreate, AlbumStageUpdate, AlbumStageOut,
    AlbumStagePositionReorder,
)
```

- [ ] **Step 2: Add album stage endpoints**

Append after the existing job stage endpoints (after `delete_job_stage`). **Critical:** register `/positions` before `/{id}` to avoid FastAPI matching the string "positions" as a UUID:

```python
# ─── Album Stages ─────────────────────────────────────────────────────────────

@router.get("/album-stages", response_model=list[AlbumStageOut])
async def list_album_stages(db: DB, _: Admin):
    return await settings_svc.list_album_stages(db)


@router.post("/album-stages", response_model=AlbumStageOut, status_code=201)
async def create_album_stage(body: AlbumStageCreate, db: DB, _: Admin):
    return await settings_svc.create_album_stage(
        db, name=body.name, color=body.color, is_terminal=body.is_terminal
    )


@router.patch("/album-stages/positions", response_model=list[AlbumStageOut])
async def reorder_album_stages(body: AlbumStagePositionReorder, db: DB, _: Admin):
    stages = [{"id": str(s.id), "position": s.position} for s in body.stages]
    return await settings_svc.reorder_album_stages(db, stages=stages)


@router.patch("/album-stages/{id}", response_model=AlbumStageOut)
async def update_album_stage(id: uuid.UUID, body: AlbumStageUpdate, db: DB, _: Admin):
    return await settings_svc.update_album_stage(
        db, id=id, name=body.name, color=body.color, is_terminal=body.is_terminal
    )


@router.delete("/album-stages/{id}", status_code=204)
async def delete_album_stage(id: uuid.UUID, db: DB, _: Admin):
    await settings_svc.delete_album_stage(db, id=id)
```

- [ ] **Step 3: Run backend and smoke-test**

```bash
cd backend && uvicorn main:app --reload
```

In another terminal (replace `<TOKEN>` with a valid admin JWT from the browser's localStorage `access_token`):
```bash
curl -s -H "Authorization: Bearer <TOKEN>" http://localhost:8000/api/album-stages | python3 -m json.tool
```

Expected: JSON array of 7 album stages ordered by position. Without a token you'll get a 401.

- [ ] **Step 4: Commit**

```bash
git add backend/routers/jobs.py
git commit -m "feat: add album stage endpoints to jobs router"
```

---

## Task 7: Backend Tests

**Files:**
- Create: `backend/tests/test_routers_album_stages.py`

- [ ] **Step 1: Write tests**

```python
# backend/tests/test_routers_album_stages.py
import pytest
from uuid import uuid4
from models.job import AlbumStage, Job, JobStage
from models.client import Client
from models.appointment import Appointment


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _seed_stage(db, name="Test Stage", color="#aabbcc", position=None, is_terminal=False):
    if position is None:
        from sqlalchemy import select, func
        max_pos = await db.scalar(select(func.max(AlbumStage.position)))
        position = (max_pos or 0) + 1
    stage = AlbumStage(name=name, color=color, position=position, is_terminal=is_terminal)
    db.add(stage)
    await db.flush()
    return stage


async def _seed_job_with_album(db):
    """Creates a client, appointment with album addon, job stage, and returns them."""
    client = Client(name="Alice", email=f"alice_{uuid4().hex[:6]}@test.com", tags=[])
    db.add(client)
    job_stage = JobStage(name="Booked", color="#f59e0b", position=99)
    db.add(job_stage)
    await db.flush()
    appt = Appointment(
        client_id=client.id,
        title="Alice Wedding",
        starts_at="2026-06-01T10:00:00+00:00",
        status="confirmed",
        addons=["album"],
        price=500,
    )
    db.add(appt)
    await db.flush()
    return client, job_stage, appt


# ─── List ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_album_stages(test_client, admin_auth_headers, db_session):
    await _seed_stage(db_session, name="Alpha", position=10)
    await _seed_stage(db_session, name="Beta", position=11)

    resp = await test_client.get("/api/album-stages", headers=admin_auth_headers)
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()]
    # Seeded defaults + our two. At minimum Alpha and Beta are present and ordered.
    assert names.index("Alpha") < names.index("Beta")


# ─── Create ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_album_stage(test_client, admin_auth_headers):
    resp = await test_client.post(
        "/api/album-stages",
        json={"name": "Proofing", "color": "#ff0000", "is_terminal": False},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Proofing"
    assert data["color"] == "#ff0000"
    assert data["is_terminal"] is False
    assert "id" in data
    assert "position" in data


# ─── Update ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_album_stage(test_client, admin_auth_headers, db_session):
    stage = await _seed_stage(db_session, name="Old Name", color="#111111")

    resp = await test_client.patch(
        f"/api/album-stages/{stage.id}",
        json={"name": "New Name", "color": "#222222"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New Name"
    assert data["color"] == "#222222"


# ─── Reorder ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reorder_album_stages(test_client, admin_auth_headers, db_session):
    # Must include ALL existing album stages in the payload (seeded 7 + nothing extra in this tx)
    resp = await test_client.get("/api/album-stages", headers=admin_auth_headers)
    existing = resp.json()
    assert len(existing) >= 2

    # Reverse the order
    reversed_payload = [
        {"id": s["id"], "position": len(existing) - i}
        for i, s in enumerate(existing)
    ]
    resp = await test_client.patch(
        "/api/album-stages/positions",
        json={"stages": reversed_payload},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_reorder_album_stages_bad_ids(test_client, admin_auth_headers):
    resp = await test_client.patch(
        "/api/album-stages/positions",
        json={"stages": [{"id": str(uuid4()), "position": 1}]},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 422


# ─── Delete ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_album_stage(test_client, admin_auth_headers, db_session):
    stage = await _seed_stage(db_session, name="Deletable", position=999)

    resp = await test_client.delete(
        f"/api/album-stages/{stage.id}",
        headers=admin_auth_headers,
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_album_stage_with_jobs_returns_409(test_client, admin_auth_headers, db_session):
    stage = await _seed_stage(db_session, name="Occupied", position=998)
    client = Client(name="Bob", email=f"bob_{uuid4().hex[:6]}@test.com", tags=[])
    db_session.add(client)
    job_stage = JobStage(name="Booked", color="#f59e0b", position=97)
    db_session.add(job_stage)
    await db_session.flush()
    job = Job(client_id=client.id, stage_id=job_stage.id, album_stage_id=stage.id)
    db_session.add(job)
    await db_session.flush()

    resp = await test_client.delete(
        f"/api/album-stages/{stage.id}",
        headers=admin_auth_headers,
    )
    assert resp.status_code == 409


# ─── Auto-assign ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_job_with_album_addon_sets_album_stage(test_client, admin_auth_headers, db_session):
    client, job_stage, appt = await _seed_job_with_album(db_session)

    resp = await test_client.post(
        "/api/jobs",
        json={"client_id": str(client.id), "stage_id": str(job_stage.id), "appointment_id": str(appt.id)},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["album_stage_id"] is not None


@pytest.mark.asyncio
async def test_create_job_without_album_addon_no_album_stage(test_client, admin_auth_headers, db_session):
    client = Client(name="Carol", email=f"carol_{uuid4().hex[:6]}@test.com", tags=[])
    db_session.add(client)
    job_stage = JobStage(name="Booked", color="#f59e0b", position=96)
    db_session.add(job_stage)
    await db_session.flush()
    appt = Appointment(
        client_id=client.id,
        title="Carol Portrait",
        starts_at="2026-07-01T10:00:00+00:00",
        status="confirmed",
        addons=[],  # no album
        price=200,
    )
    db_session.add(appt)
    await db_session.flush()

    resp = await test_client.post(
        "/api/jobs",
        json={"client_id": str(client.id), "stage_id": str(job_stage.id), "appointment_id": str(appt.id)},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["album_stage_id"] is None
```

- [ ] **Step 2: Run tests — verify all pass**

```bash
cd backend && pytest tests/test_routers_album_stages.py -v
```

Expected: all tests PASS.

- [ ] **Step 3: Run full test suite to check for regressions**

```bash
cd backend && pytest -v
```

Expected: no new failures.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_routers_album_stages.py
git commit -m "test: add album stage router and auto-assignment integration tests"
```

---

## Task 8: Frontend Schema

**Files:**
- Modify: `frontend/src/schemas/jobs.ts`

- [ ] **Step 1: Add `AlbumStageSchema` and extend `JobSchema`**

After the `JobStageSchema` block, add:

```ts
export const AlbumStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  position: z.number().int(),
  is_terminal: z.boolean(),
  created_at: z.string(),
})
export type AlbumStage = z.infer<typeof AlbumStageSchema>
export const AlbumStageListSchema = z.array(AlbumStageSchema)
```

In `JobSchema`, after `delivery_url`, add:

```ts
album_stage_id: z.string().uuid().nullable().optional(),
album_stage: z.object({ id: z.string().uuid(), name: z.string(), color: z.string() }).nullable().optional(),
```

Replace `JobDetailSchema` alias with:

```ts
export const JobDetailSchema = JobSchema.extend({
  album_stages: AlbumStageListSchema.optional().default([]),
})
export type JobDetail = z.infer<typeof JobDetailSchema>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | head -30
```

Expected: no TypeScript errors related to jobs schema.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/schemas/jobs.ts
git commit -m "feat: add AlbumStageSchema and extend JobSchema"
```

---

## Task 9: Frontend API

**Files:**
- Modify: `frontend/src/api/jobs.ts`

- [ ] **Step 1: Add album stage types and API functions**

At the end of `frontend/src/api/jobs.ts`, add:

```ts
// ─── Album Stage types ────────────────────────────────────────────────────────

export interface AlbumStageCreatePayload {
  name: string
  color: string
  is_terminal?: boolean
}

export interface AlbumStageUpdatePayload {
  name?: string
  color?: string
  is_terminal?: boolean
}

// ─── Album Stage API functions ────────────────────────────────────────────────

export async function fetchAlbumStages(): Promise<AlbumStage[]> {
  const res = await api.get('/album-stages')
  return AlbumStageListSchema.parse(res.data)
}

export async function createAlbumStage(payload: AlbumStageCreatePayload): Promise<AlbumStage> {
  const res = await api.post('/album-stages', payload)
  return AlbumStageSchema.parse(res.data)
}

export async function updateAlbumStage(id: string, payload: AlbumStageUpdatePayload): Promise<AlbumStage> {
  const res = await api.patch(`/album-stages/${id}`, payload)
  return AlbumStageSchema.parse(res.data)
}

export async function reorderAlbumStages(stages: StagePositionItem[]): Promise<AlbumStage[]> {
  const res = await api.patch('/album-stages/positions', { stages })
  return AlbumStageListSchema.parse(res.data)
}

export async function deleteAlbumStage(id: string): Promise<void> {
  await api.delete(`/album-stages/${id}`)
}
```

Add the missing import at the top of the file (after existing schema imports):

```ts
import { AlbumStageSchema, AlbumStageListSchema, type AlbumStage } from '@/schemas/jobs'
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | grep -E 'error|Error' | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/jobs.ts
git commit -m "feat: add album stage API functions"
```

---

## Task 10: Frontend Hooks

**Files:**
- Modify: `frontend/src/hooks/useJobs.ts`

- [ ] **Step 1: Add album stage hook imports**

In `frontend/src/hooks/useJobs.ts`, extend the api import:

```ts
import {
  fetchJobs, fetchJob, createJob, updateJob, deleteJob,
  fetchJobStages, createJobStage, updateJobStage, reorderJobStages, deleteJobStage,
  fetchAlbumStages, createAlbumStage, updateAlbumStage, reorderAlbumStages, deleteAlbumStage,
  type JobCreatePayload, type JobUpdatePayload, type StagePositionItem,
  type JobStageUpdatePayload, type AlbumStageCreatePayload, type AlbumStageUpdatePayload,
} from '@/api/jobs'
```

- [ ] **Step 2: Add album stage hooks**

Append at the end of `frontend/src/hooks/useJobs.ts`:

```ts
// ─── Album Stage hooks ────────────────────────────────────────────────────────

export function useAlbumStages() {
  return useQuery({ queryKey: ['album-stages'], queryFn: fetchAlbumStages })
}

export function useCreateAlbumStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAlbumStage,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['album-stages'] }); toast.success('Album stage created') },
    onError: () => toast.error('Failed to create album stage'),
  })
}

export function useUpdateAlbumStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AlbumStageUpdatePayload }) =>
      updateAlbumStage(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['album-stages'] }),
    onError: () => toast.error('Failed to update album stage'),
  })
}

export function useReorderAlbumStages() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reorderAlbumStages,
    onMutate: async (newStages: StagePositionItem[]) => {
      await queryClient.cancelQueries({ queryKey: ['album-stages'] })
      const prev = queryClient.getQueryData(['album-stages'])
      queryClient.setQueryData(['album-stages'], (old: unknown) => {
        if (!Array.isArray(old)) return old
        return old.map((s: { id: string; position: number }) => {
          const update = newStages.find(n => n.id === s.id)
          return update ? { ...s, position: update.position } : s
        }).sort((a: { position: number }, b: { position: number }) => a.position - b.position)
      })
      return { prev }
    },
    onError: (_err: unknown, _vars: unknown, context: unknown) => {
      if (context && typeof context === 'object' && 'prev' in context) {
        queryClient.setQueryData(['album-stages'], (context as { prev: unknown }).prev)
      }
      toast.error('Failed to reorder album stages')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['album-stages'] }),
  })
}

export function useDeleteAlbumStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAlbumStage,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['album-stages'] }); toast.success('Album stage deleted') },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Cannot delete — jobs are assigned to this stage'))
    },
  })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | grep -E 'error|Error' | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useJobs.ts
git commit -m "feat: add album stage hooks"
```

---

## Task 11: Admin Jobs Page — Tabs + Album Kanban

**Files:**
- Modify: `frontend/src/pages/admin/Jobs.tsx`

- [ ] **Step 1: Add imports**

Add to the import block at the top:

```ts
import { useAlbumStages, useUpdateJob } from '@/hooks/useJobs'
import type { AlbumStage } from '@/schemas/jobs'
```

Also add the shadcn Tabs import:

```ts
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
```

- [ ] **Step 2: Add `AlbumKanbanColumn` component**

Add after the existing `KanbanColumn` component:

```tsx
function AlbumKanbanColumn({ stage, jobs }: { stage: AlbumStage; jobs: Job[] }) {
  const [collapsed, setCollapsed] = useState(false)
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        className="flex-shrink-0 w-10 rounded-xl bg-card border flex flex-col items-center py-3 gap-2 cursor-pointer transition-colors hover:bg-muted/20"
        style={{ borderTop: `3px solid ${stage.color}` }}
        onClick={() => setCollapsed(false)}
      >
        <span className="text-xs text-muted-foreground font-medium [writing-mode:vertical-rl] rotate-180">
          {stage.name}
        </span>
        <span className="text-xs text-muted-foreground/60">{jobs.length}</span>
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-56 rounded-xl bg-card border flex flex-col">
      <div
        className="px-4 py-3 rounded-t-xl flex items-center gap-2 cursor-pointer select-none hover:bg-muted/40 transition-colors"
        style={{ borderTop: `3px solid ${stage.color}` }}
        onClick={() => setCollapsed(true)}
      >
        <span className="text-sm font-medium text-foreground">{stage.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">{jobs.length}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
      <div
        ref={setNodeRef}
        className={`p-2 space-y-2 min-h-[120px] flex-1 rounded-b-xl transition-colors ${isOver ? 'bg-muted/40' : ''}`}
      >
        <SortableContext items={jobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
          {jobs.map(job => <JobCard key={job.id} job={job} />)}
        </SortableContext>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add `AlbumKanban` component**

Add after `AlbumKanbanColumn`:

```tsx
function AlbumKanban({ jobs }: { jobs: Job[] }) {
  const { data: albumStages = [] } = useAlbumStages()
  const updateJob = useUpdateJob()
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const albumJobs = jobs.filter(j => j.album_stage_id != null)
  const getJobsForStage = useCallback(
    (stageId: string) => albumJobs.filter(j => j.album_stage_id === stageId),
    [albumJobs]
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveJob(albumJobs.find(j => j.id === event.active.id) ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveJob(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const targetStage = albumStages.find(s => s.id === over.id)
    const targetJob = albumJobs.find(j => j.id === over.id)
    const newStageId = targetStage?.id ?? targetJob?.album_stage_id
    if (!newStageId) return
    const job = albumJobs.find(j => j.id === active.id)
    if (!job || job.album_stage_id === newStageId) return
    await updateJob.mutateAsync({ id: String(active.id), payload: { album_stage_id: newStageId } })
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {albumStages.map(stage => (
          <AlbumKanbanColumn key={stage.id} stage={stage} jobs={getJobsForStage(stage.id)} />
        ))}
      </div>
      <DragOverlay>
        {activeJob ? <JobCard job={activeJob} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 4: Wrap existing `Jobs` component body in tabs**

In the `Jobs` function, replace the `<DndContext ...>` block and everything below it with:

```tsx
return (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-br shadow-md text-black">
        <Kanban className="h-5 w-5" />
      </div>
      <h1 className="text-2xl font-semibold text-foreground">Jobs</h1>
    </div>

    <Tabs defaultValue="work">
      <TabsList>
        <TabsTrigger value="work">Work</TabsTrigger>
        <TabsTrigger value="albums">Albums</TabsTrigger>
      </TabsList>

      <TabsContent value="work" className="mt-4">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map(stage => (
              <KanbanColumn key={stage.id} stage={stage} jobs={getJobsForStage(stage.id)} />
            ))}
          </div>
          <DragOverlay>
            {activeJob ? <JobCard job={activeJob} /> : null}
          </DragOverlay>
        </DndContext>
      </TabsContent>

      <TabsContent value="albums" className="mt-4">
        <AlbumKanban jobs={jobs} />
      </TabsContent>
    </Tabs>
  </div>
)
```

- [ ] **Step 5: Verify TypeScript compiles and page loads**

```bash
cd frontend && npm run build 2>&1 | grep -E 'error|Error' | head -20
```

Then open `http://localhost:5173/admin/jobs` and verify the Work and Albums tabs both render.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/Jobs.tsx
git commit -m "feat: add Work/Albums tabs and Album Kanban to Jobs page"
```

---

## Task 12: Admin Settings Page — Album Stages Section

**Files:**
- Modify: `frontend/src/pages/admin/Settings.tsx`

- [ ] **Step 1: Add album stage hook imports**

Add to the hooks import at the top of `Settings.tsx`:

```ts
import {
  useJobStages, useCreateJobStage, useUpdateJobStage,
  useDeleteJobStage, useReorderJobStages,
  useAlbumStages, useCreateAlbumStage, useUpdateAlbumStage,
  useDeleteAlbumStage, useReorderAlbumStages,
} from '@/hooks/useJobs'
```

Add schema import:

```ts
import type { JobStage, AlbumStage } from '@/schemas/jobs'
```

- [ ] **Step 2: Add `SortableAlbumStageRow` component**

After the existing `SortableStageRow` component, add an identical component wired to album stage hooks:

```tsx
// ─── Sortable album stage row ────────────────────────────────────────────────

function SortableAlbumStageRow({
  stage,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  stage: AlbumStage
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id })

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(stage.name)
  const updateStage = useUpdateAlbumStage()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  useEffect(() => { if (!editing) setName(stage.name) }, [stage.name, editing])

  const save = () => {
    if (name.trim() && name !== stage.name) {
      updateStage.mutate({ id: stage.id, payload: { name: name.trim() } })
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setName(stage.name); setEditing(false) }
  }

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  // Mirror SortableStageRow JSX exactly, just with AlbumStage type
  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
      <span {...attributes} {...listeners} className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground">
        <GripVertical className="w-4 h-4" />
      </span>
      <div className="flex flex-col gap-0.5">
        <button type="button" onClick={onMoveUp} disabled={isFirst} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
          <ChevronUp className="w-3 h-3" />
        </button>
        <button type="button" onClick={onMoveDown} disabled={isLast} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
      {editing ? (
        <Input ref={inputRef} value={name} onChange={e => setName(e.target.value)} onBlur={save} onKeyDown={handleKeyDown} className="h-7 text-sm flex-1" />
      ) : (
        <button type="button" className="flex-1 text-left text-sm hover:underline bg-transparent" onClick={() => setEditing(true)}>
          {stage.name}
        </button>
      )}
      {stage.is_terminal && <span className="text-xs text-muted-foreground/50 ml-auto mr-2">terminal</span>}
      <button type="button" onClick={onDelete} className="text-muted-foreground/40 hover:text-destructive ml-auto">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  )
}
```

- [ ] **Step 3: Add `AlbumStagesTab` component**

After `WorkStagesTab`, add:

```tsx
// ─── Album Stages tab ─────────────────────────────────────────────────────────

function AlbumStagesTab() {
  const { data: stages = [] } = useAlbumStages()
  const createStage = useCreateAlbumStage()
  const deleteStage = useDeleteAlbumStage()
  const reorder = useReorderAlbumStages()

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6b7280')

  const buildPositions = (ordered: AlbumStage[]): StagePositionItem[] =>
    ordered.map((s, i) => ({ id: s.id, position: i + 1 }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = stages.findIndex(s => s.id === active.id)
    const newIndex = stages.findIndex(s => s.id === over.id)
    const reordered = [...stages]
    reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, stages[oldIndex])
    reorder.mutate(buildPositions(reordered))
  }

  const moveStage = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= stages.length) return
    const reordered = [...stages]
    ;[reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]]
    reorder.mutate(buildPositions(reordered))
  }

  const handleAdd = () => {
    if (!newName.trim()) return
    createStage.mutate({ name: newName.trim(), color: newColor, is_terminal: false })
    setNewName('')
  }

  return (
    <div className="space-y-4">
      <DndContext sensors={useSensors(useSensor(PointerSensor))} onDragEnd={handleDragEnd}>
        <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <ul>
            {stages.map((stage, index) => (
              <SortableAlbumStageRow
                key={stage.id}
                stage={stage}
                isFirst={index === 0}
                isLast={index === stages.length - 1}
                onMoveUp={() => moveStage(index, 'up')}
                onMoveDown={() => moveStage(index, 'down')}
                onDelete={() => deleteStage.mutate(stage.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <div className="flex gap-2 pt-2">
        <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="h-9 w-9 rounded border border-input cursor-pointer" />
        <Input placeholder="Stage name…" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} className="flex-1" />
        <Button onClick={handleAdd} disabled={!newName.trim()} size="sm">Add</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add "Album Stages" tab trigger and content to the Settings page**

Find the existing `<Tabs defaultValue="stages">` block. Add a new `TabsTrigger` and `TabsContent` for album stages:

```tsx
// In TabsList, after the existing Work Stages trigger:
<TabsTrigger value="album-stages">Album Stages</TabsTrigger>

// After the existing TabsContent for "stages":
<TabsContent value="album-stages" className="mt-4">
  <div className="max-w-md">
    <h2 className="text-base font-semibold text-foreground mb-4">Album Stages</h2>
    <AlbumStagesTab />
  </div>
</TabsContent>
```

- [ ] **Step 5: Verify TypeScript compiles and Settings loads**

```bash
cd frontend && npm run build 2>&1 | grep -E 'error|Error' | head -20
```

Open `http://localhost:5173/admin/settings` → verify "Album Stages" tab appears and shows the 7 seeded stages with add/delete/reorder controls.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/Settings.tsx
git commit -m "feat: add Album Stages section to Settings page"
```

---

## Task 13: Client Portal — Album Progress Bar

**Files:**
- Investigate: `frontend/src/routes/index.tsx` → find client portal job detail route
- Modify: the client portal job detail page component

- [ ] **Step 1: Find the client portal job detail page**

Open `frontend/src/routes/index.tsx` and locate the client portal route subtree. The route will look something like `{ path: '/client/jobs/:id', element: <ClientJobDetail /> }`. Note the component file path.

If no client portal job detail page exists yet, this task is deferred until the client portal is built.

- [ ] **Step 2: Create `AlbumProgressBar` component**

Create `frontend/src/components/ui/AlbumProgressBar.tsx`:

```tsx
import type { AlbumStage } from '@/schemas/jobs'

interface Props {
  stages: AlbumStage[]
  currentStageId: string
}

export function AlbumProgressBar({ stages, currentStageId }: Props) {
  const currentIndex = stages.findIndex(s => s.id === currentStageId)

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Album Progress
      </p>
      <div className="flex gap-1 items-end overflow-x-auto">
        {stages.map((stage, index) => {
          const isDone = index < currentIndex
          const isActive = index === currentIndex
          return (
            <div key={stage.id} className="flex-1 min-w-[48px] text-center">
              <div
                className={`h-1 rounded-full mb-1 transition-colors ${isDone ? 'bg-emerald-500' : !isActive ? 'bg-border' : ''}`}
                style={isActive ? { backgroundColor: stage.color, boxShadow: `0 0 6px ${stage.color}88` } : undefined}
              />
              <span
                className={`text-[9px] leading-tight block ${
                  isActive
                    ? 'font-semibold'
                    : isDone
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/40'
                }`}
              >
                {stage.name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add progress bar to the client portal job detail**

In the client portal job detail page, import and render the component:

```tsx
import { AlbumProgressBar } from '@/components/ui/AlbumProgressBar'

// In the JSX, after the existing session progress bar:
{job.album_stage_id && job.album_stages && job.album_stages.length > 0 && (
  <div className="mt-4">
    <AlbumProgressBar stages={job.album_stages} currentStageId={job.album_stage_id} />
  </div>
)}
```

Ensure the job detail API call uses `JobDetailSchema` (which includes `album_stages`).

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | grep -E 'error|Error' | head -20
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/AlbumProgressBar.tsx
git commit -m "feat: add AlbumProgressBar component and wire to client portal"
```

---

## Final Verification

- [ ] Run full backend test suite: `cd backend && pytest -v` → all pass
- [ ] Run frontend lint: `cd frontend && npm run lint` → no errors
- [ ] Manual smoke test:
  1. Create an appointment with the `album` addon → confirm the job's `album_stage_id` is set to "On Hold"
  2. Open Jobs → Albums tab → job appears in "On Hold" column; drag to "Selecting" → verify it moves
  3. Open Settings → Album Stages tab → add a stage, rename it, delete it
  4. Open job detail → if client portal exists, verify Album Progress bar shows correct highlighted stage
