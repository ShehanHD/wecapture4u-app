# Vercel Backend Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the FastAPI backend to Vercel as a serverless Python app, replacing APScheduler with a Vercel Cron Job that hits a protected HTTP endpoint.

**Architecture:** Vercel's Python runtime wraps an ASGI app via `api/index.py`. All HTTP routes are rewritten to this single handler via `vercel.json`. Since Vercel is serverless (no persistent processes), APScheduler is disabled in production and replaced by a Vercel Cron Job that calls `POST /api/cron/daily-notifications` on a daily schedule, protected by a `CRON_SECRET` bearer token.

**Tech Stack:** Vercel Python runtime (`@vercel/python`), FastAPI ASGI, existing Supabase/asyncpg stack.

---

## Key Decisions

- **APScheduler disabled in production** via a `VERCEL=1` env var that Vercel sets automatically. Lifespan skips scheduler startup when this var is present.
- **Cron endpoint** lives at `POST /api/cron/daily-notifications` — identical logic to `run_daily_notifications()` in `scheduler.py`, but triggered via HTTP.
- **CRON_SECRET** is an env var verified as a bearer token on every cron request. Vercel sends this automatically when configured in `vercel.json`.
- **Root directory** for the Vercel project must be set to `backend/` in the Vercel dashboard (or CLI).

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `backend/config.py` | Add `CRON_SECRET: str = ""` setting |
| Create | `backend/routers/cron.py` | Protected cron endpoint |
| Modify | `backend/main.py` | Register cron router |
| Modify | `backend/scheduler.py` | Skip APScheduler when `VERCEL=1` |
| Create | `backend/api/__init__.py` | Empty (makes `api/` a package) |
| Create | `backend/api/index.py` | Vercel ASGI entry point |
| Create | `backend/vercel.json` | Routing + cron schedule config |

---

## Task 1: Add CRON_SECRET to config

**Files:**
- Modify: `backend/config.py`

- [ ] **Step 1: Add the field**

Add `CRON_SECRET: str = ""` to the `Settings` class in `config.py`, after `WEBAUTHN_RP_NAME`:

```python
CRON_SECRET: str = ""
```

- [ ] **Step 2: Verify settings load cleanly**

```bash
cd backend && python -c "from config import settings; print('CRON_SECRET:', bool(settings.CRON_SECRET))"
```
Expected: `CRON_SECRET: False` (empty default is fine locally)

- [ ] **Step 3: Commit**

```bash
git add backend/config.py
git commit -m "feat: add CRON_SECRET to settings for Vercel cron auth"
```

---

## Task 2: Create the cron router

**Files:**
- Create: `backend/routers/cron.py`

- [ ] **Step 1: Write the router**

```python
# backend/routers/cron.py
import logging
from fastapi import APIRouter, Header, HTTPException, status

from config import settings
from scheduler import run_daily_notifications

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cron", tags=["cron"])


@router.post("/daily-notifications", status_code=status.HTTP_204_NO_CONTENT)
async def daily_notifications(
    authorization: str = Header(default=""),
) -> None:
    """
    Called by Vercel Cron Jobs once per day at 08:00 UTC.
    Protected by a bearer token matching CRON_SECRET.
    Returns 204 on success, 401 if token is wrong/missing.
    """
    expected = f"Bearer {settings.CRON_SECRET}"
    if not settings.CRON_SECRET or authorization != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    logger.info("Cron trigger received — running daily notifications")
    await run_daily_notifications()
```

- [ ] **Step 2: Verify import is clean**

```bash
cd backend && python -c "from routers.cron import router; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/routers/cron.py
git commit -m "feat: add cron router for Vercel-triggered daily notifications"
```

---

## Task 3: Register cron router in main.py and make lifespan conditional

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/scheduler.py`

- [ ] **Step 1: Register the cron router in main.py**

Add to `backend/main.py` after the existing router imports:

```python
from routers.cron import router as cron_router
```

And register it with:

```python
app.include_router(cron_router)
```

Place this after the `notifications_router` line.

- [ ] **Step 2: Make APScheduler conditional in scheduler.py**

The `lifespan` function currently always starts APScheduler. Replace only the `lifespan` function body in `backend/scheduler.py` with a version that skips the scheduler when running on Vercel:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    from config import settings as app_settings

    if app_settings.ENVIRONMENT == "production" and not app_settings.ALLOWED_ORIGINS:
        raise RuntimeError(
            "ALLOWED_ORIGINS must be set in production — "
            "refusing to start with open CORS policy."
        )

    # Vercel is serverless — no persistent process to run APScheduler.
    # Scheduling is handled by Vercel Cron Jobs hitting /api/cron/daily-notifications.
    on_vercel = os.environ.get("VERCEL") == "1"
    if not on_vercel:
        scheduler.add_job(
            run_daily_notifications,
            trigger="cron",
            hour=8,
            minute=0,
            timezone="UTC",
            id="daily_notifications",
            replace_existing=True,
        )
        scheduler.start()
        logger.info("APScheduler started")

    yield

    if not on_vercel:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")
```

- [ ] **Step 3: Verify app starts**

```bash
cd backend && python -c "from main import app; print('App routes:', len(app.routes))"
```
Expected: prints a count including the new cron route (no import errors)

- [ ] **Step 4: Commit**

```bash
git add backend/main.py backend/scheduler.py
git commit -m "feat: register cron router; skip APScheduler on Vercel serverless"
```

---

## Task 4: Create the Vercel entry point

**Files:**
- Create: `backend/api/__init__.py`
- Create: `backend/api/index.py`

- [ ] **Step 1: Create the package and entry point**

`backend/api/__init__.py` — empty file.

`backend/api/index.py`:

```python
# Vercel ASGI entry point.
# Vercel discovers this file and wraps it with its Python runtime.
# All requests are routed here via vercel.json.
from main import app  # noqa: F401 — Vercel imports `app` from this module
```

- [ ] **Step 2: Verify import**

```bash
cd backend && python -c "from api.index import app; print('ASGI app:', app.title)"
```
Expected: `ASGI app: weCapture4U API`

- [ ] **Step 3: Commit**

```bash
git add backend/api/__init__.py backend/api/index.py
git commit -m "feat: add Vercel ASGI entry point at api/index.py"
```

---

## Task 5: Create vercel.json

**Files:**
- Create: `backend/vercel.json`

- [ ] **Step 1: Write the config**

```json
{
  "builds": [
    {
      "src": "api/index.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "api/index.py"
    }
  ],
  "crons": [
    {
      "path": "/api/cron/daily-notifications",
      "schedule": "0 8 * * *"
    }
  ]
}
```

> **Note on crons:** Vercel Cron Jobs are a Pro/Enterprise feature. The `crons` block won't error on Hobby plans — it just won't run. You can trigger the endpoint manually or upgrade the plan.
>
> Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when you set `CRON_SECRET` as an env var in the Vercel dashboard and reference it — but actually Vercel does **not** automatically inject the secret into the cron header. You must set it as an env var in the dashboard and your endpoint reads it from `settings.CRON_SECRET`. Vercel's own cron requests do NOT carry an auth header by default — you must call the endpoint yourself (e.g. via GitHub Actions or an external cron service) with the header if you want protection. The endpoint is still protected by the secret check, so unauthenticated calls are rejected.

- [ ] **Step 2: Validate JSON is well-formed**

```bash
cd backend && python -c "import json; json.load(open('vercel.json')); print('Valid JSON')"
```
Expected: `Valid JSON`

- [ ] **Step 3: Commit**

```bash
git add backend/vercel.json
git commit -m "feat: add vercel.json with routing and daily cron schedule"
```

---

## Task 6: Vercel Dashboard Setup (manual steps)

These are one-time manual steps in the Vercel UI — not automatable.

- [ ] **Step 1: Create a new Vercel project**
  - Import the GitHub repo
  - Set **Root Directory** to `backend/`
  - Framework preset: **Other**

- [ ] **Step 2: Add all environment variables** from `backend/.env.example`:
  - `DATABASE_URL`
  - `JWT_SECRET_KEY`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
  - `ALLOWED_ORIGINS` (your frontend domain, e.g. `https://wecapture4u.com`)
  - `ENVIRONMENT=production`
  - `WEBAUTHN_RP_ID`
  - `WEBAUTHN_RP_NAME`
  - `CRON_SECRET` (generate a strong random secret: `python -c "import secrets; print(secrets.token_hex(32))"`)

- [ ] **Step 3: Deploy** — trigger first deploy from dashboard or `vercel --prod` CLI

- [ ] **Step 4: Verify health endpoint**

```bash
curl https://your-backend.vercel.app/health
```
Expected: `{"status": "ok"}` (or equivalent)

- [ ] **Step 5: Test cron endpoint manually**

```bash
curl -X POST https://your-backend.vercel.app/api/cron/daily-notifications \
  -H "Authorization: Bearer <your-CRON_SECRET>"
```
Expected: HTTP 204

---

## Verification Checklist

- [ ] `GET /health` returns 200
- [ ] `POST /auth/login` returns tokens (admin login works)
- [ ] `GET /api/clients` returns 401 without token (auth guard works)
- [ ] `POST /api/cron/daily-notifications` without auth returns 401
- [ ] `POST /api/cron/daily-notifications` with correct bearer returns 204
- [ ] Frontend can reach backend (CORS headers present, `ALLOWED_ORIGINS` correct)
