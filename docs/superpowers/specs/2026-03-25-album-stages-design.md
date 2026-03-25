# Album Stages — Design Spec

**Date:** 2026-03-25
**Status:** Approved

---

## Overview

Add a separate album production workflow to the Jobs system. When an appointment includes the `album` addon, the resulting job is automatically tracked through a dedicated set of album stages in addition to the existing work stages. Admins manage album stages in Settings. Clients see an album progress bar in their portal.

---

## Requirements

- Jobs with an `album` addon are automatically placed in the first album stage ("On Hold") on creation.
- The Jobs page shows two tabs: **Work** (existing Kanban) and **Albums** (new album Kanban).
- Admin can drag jobs between album stages on the Albums Kanban.
- Admin can add, rename, reorder, and delete album stages in **Settings**, alongside the existing work stages section.
- Clients with an album job see an **Album Progress** bar in their portal (below the existing Session Progress bar). Hidden for jobs without an album.
- Album stages are independent from work stages — a job progresses through both pipelines separately.

---

## Default Album Stages (seeded)

| Position | Name       | Terminal |
|----------|------------|----------|
| 1        | On Hold    | false    |
| 2        | Selecting  | false    |
| 3        | Designing  | false    |
| 4        | Printing   | false    |
| 5        | Dispatched | false    |
| 6        | Arrived    | false    |
| 7        | Delivered  | true     |

---

## Database — Migration `012_album_stages.sql`

```sql
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

---

## Backend

### Model

Add `AlbumStage` model to `backend/models/job.py` (alongside `JobStage`):

```python
class AlbumStage(Base):
    __tablename__ = "album_stages"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String, nullable=False)
    color       = Column(String, nullable=False)
    position    = Column(Integer, nullable=False)
    is_terminal = Column(Boolean, nullable=False, server_default="false")
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    jobs        = relationship("Job", back_populates="album_stage", lazy="select")
```

Add to `Job` model:
```python
album_stage_id = Column(UUID(as_uuid=True), ForeignKey("album_stages.id", ondelete="SET NULL"), nullable=True)
album_stage    = relationship("AlbumStage", back_populates="jobs", lazy="select")
```

### Schemas

Add to `backend/schemas/jobs.py`:
- `AlbumStageOut` — id, name, color, position, is_terminal
- `AlbumStageCreate` — name, color, is_terminal
- `AlbumStageUpdate` — name?, color?, is_terminal?
- `AlbumStagePositionReorder` — list of `{id, position}`
- Extend `JobOut` / `JobDetailOut` with `album_stage_id: UUID | None` and `album_stage: AlbumStageOut | None`

### Service — `backend/services/settings.py`

Add functions mirroring existing `job_stages` functions:
- `list_album_stages(db)` — ordered by position
- `create_album_stage(db, name, color, is_terminal)` — appends at end
- `update_album_stage(db, id, data)` — patch name/color/is_terminal
- `reorder_album_stages(db, stages)` — bulk position update
- `delete_album_stage(db, id)` — guard: cannot delete if jobs are assigned

### Service — `backend/services/jobs.py`

Extend `create_job`:
- After creating a job, check if the linked appointment has `'album'` in `addons`
- If yes, fetch the album stage with `position=1` and set `job.album_stage_id`

Extend `update_job`:
- Accept `album_stage_id` in the update payload

### Router — `backend/routers/jobs.py`

Add endpoints (mirrors `/job-stages`):

```
GET    /album-stages
POST   /album-stages
PATCH  /album-stages/positions   ← must be registered BEFORE /{id} to avoid FastAPI matching "positions" as a UUID
PATCH  /album-stages/{id}
DELETE /album-stages/{id}
```

---

## Frontend

### Schema — `frontend/src/schemas/jobs.ts`

Add:
```ts
export const AlbumStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  position: z.number(),
  is_terminal: z.boolean(),
})
export type AlbumStage = z.infer<typeof AlbumStageSchema>
```

Extend `JobSchema` with:
```ts
album_stage_id: z.string().uuid().nullable(),
album_stage: AlbumStageSchema.nullable().optional(),
```

`album_stage` is `.optional()` because list endpoints may not eager-load it; job detail endpoints always include it.

### API — `frontend/src/api/jobs.ts`

Add functions mirroring job stages:
- `fetchAlbumStages()` → `GET /album-stages`
- `createAlbumStage(payload)` → `POST /album-stages`
- `updateAlbumStage(id, payload)` → `PATCH /album-stages/{id}`
- `reorderAlbumStages(stages)` → `PATCH /album-stages/positions`
- `deleteAlbumStage(id)` → `DELETE /album-stages/{id}`

### Hooks — `frontend/src/hooks/useJobs.ts`

Add hooks mirroring job stage hooks:
- `useAlbumStages()`
- `useCreateAlbumStage()`
- `useUpdateAlbumStage()`
- `useReorderAlbumStages()`
- `useDeleteAlbumStage()`

### Admin — Jobs Page (`frontend/src/pages/admin/Jobs.tsx`)

- Add tab state: `'work' | 'albums'`
- **Work tab**: existing Kanban (unchanged)
- **Albums tab**: new `AlbumKanbanColumn` and drag-and-drop board using `useAlbumStages()`. Filter album jobs client-side from the existing `useJobs()` result (jobs where `album_stage_id != null`). No separate backend query needed — jobs are not paginated.
- Drag end handler calls `updateJob({ album_stage_id: newStageId })`

### Admin — Settings Page (`frontend/src/pages/admin/Settings.tsx`)

- Add an **Album Stages** section below the existing Work Stages section
- Reuse `SortableStageRow` component (or a renamed copy) with album stage hooks
- Same add/rename/reorder/delete UX as work stages

### Client Portal — Job Detail

- Album stages are embedded in the job detail response via `JobDetailOut` — no separate API call needed in the portal.
- Add `album_stages: list[AlbumStageOut]` to `JobDetailOut` (backend always returns the full ordered stage list alongside `album_stage_id`).
- In the client's job detail view, check if `job.album_stage_id != null`
- If yes, render `<AlbumProgressBar stages={job.album_stages} currentStageId={job.album_stage_id} />`
- Progress bar: completed stages (position < current) shown green, active stage highlighted in purple, future stages grey
- Displayed below the existing Session Progress bar

---

## Error Handling

- **Delete album stage with assigned jobs**: backend returns 409 (Conflict) — consistent with the existing `delete_job_stage` guard. Frontend shows a toast: "Cannot delete — jobs are assigned to this stage." No reassign-on-delete dialog needed; admin must manually move jobs first via the Kanban.
- **Album stage not found on job create**: log warning, job is created without `album_stage_id` (non-blocking — appointment may have album addon but no stages seeded yet)
- All album stage API responses validated with Zod schemas

---

## Testing

**Backend integration tests:**
- All 5 album stage CRUD endpoints (list, create, update, reorder, delete)
- Delete guard: 409 when jobs are assigned to the stage
- Auto-assignment: job created with `album` addon → `album_stage_id` set to position-1 stage
- Auto-assignment skipped: job created without `album` addon → `album_stage_id` is NULL
- `album_stage_id` set to NULL when referenced album stage is deleted (ON DELETE SET NULL — verify via migration)
- Reorder: mismatched / unknown IDs return 422

**Frontend:**
- Manual verification: Albums Kanban renders only album jobs; drag-drop updates `album_stage_id`
- Manual verification: Album Progress bar visible for album jobs, hidden for non-album jobs
