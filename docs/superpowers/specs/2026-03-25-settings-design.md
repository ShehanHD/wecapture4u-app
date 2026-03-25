# Admin Settings Page — Design Spec

**Goal:** Build the `/admin/settings` page with 4 tabs: Work Stages, Session Types, Tax, and PDF Invoices.

**Date:** 2026-03-25

---

## Architecture

Single-page tabbed UI. All backend endpoints and frontend API/hook layers already exist. Work needed is exclusively frontend: job stage mutation hooks (missing from `useJobs.ts`), and the Settings page component.

**Existing infrastructure:**
- Backend endpoints: fully implemented in `routers/settings.py` and `routers/jobs.py`
- Frontend API functions: `api/settings.ts` (settings + session types), `api/jobs.ts` (job stages)
- Frontend hooks: `hooks/useSettings.ts` (settings + session types), `hooks/useJobs.ts` (job stage queries only — mutations missing)
- dnd-kit already installed (used in Jobs kanban)

---

## File Map

| File | Change |
|---|---|
| `frontend/src/hooks/useJobs.ts` | Add job stage mutation hooks: `useCreateJobStage`, `useUpdateJobStage`, `useDeleteJobStage`, `useReorderJobStages` |
| `frontend/src/pages/admin/Settings.tsx` | New — 4-tab settings page |
| `frontend/src/routes/index.tsx` | Wire `/admin/settings` route |

---

## Tab 1: Work Stages

Displays all job stages ordered by `position`.

**Each stage row:**
- Drag handle (dnd-kit `useSortable`) for drag-and-drop reorder
- Up / Down arrow buttons (also trigger reorder)
- Color swatch (filled circle, `background: stage.color`)
- Stage name (click to enter inline edit mode)
- "Final" badge if `is_terminal === true`
- Delete button — calls `DELETE /api/job-stages/{id}`; backend returns 409 if jobs are assigned → shown as toast error

**Add stage form** (below list):
- Name input + color input (`type="color"`) + "Final stage" checkbox + Add button
- Submits to `POST /api/job-stages`

**Reorder behavior:**
- Drag: dnd-kit `DndContext` + `SortableContext` (vertical list strategy); on `onDragEnd` call `PATCH /api/job-stages/positions` with new position array
- Up/Down arrows: compute new position array client-side, call same endpoint

---

## Tab 2: Session Types

Flat list of session types.

**Each row:**
- Name (click → inline edit; blur/Enter saves; Escape cancels)
- Delete button — 409 from backend shown as toast error

**Add form** (below list):
- Name input + Add button → `POST /api/session-types`

---

## Tab 3: Tax

Two controls, auto-save on change/blur:

- **Toggle:** "Enable tax on invoices" — `tax_enabled` boolean
- **Number input:** "Default tax rate (%)" — `tax_rate` decimal, disabled when `tax_enabled` is false

Saves via `PATCH /api/settings`.

---

## Tab 4: PDF Invoices

Single control, auto-save on change:

- **Toggle:** "Enable PDF invoice export" — `pdf_invoices_enabled` boolean

Saves via `PATCH /api/settings`.

---

## Error Handling

- 409 responses (stage/type in use) → `toast.error(detail)` from backend message
- Network errors → `toast.error('Failed to save')`
- Optimistic updates are NOT used — wait for server confirmation before updating UI

---

## Testing

No new backend tests needed (all endpoints already tested). No frontend unit tests needed for this page — it's pure UI wiring on top of already-tested hooks.
