# Deployment Design — weCapture4U
**Date:** 2026-03-15
**Status:** Approved — Ready for Implementation

---

## Hosting Architecture

| Layer | Service | Notes |
|---|---|---|
| Frontend | Hostinger | Static HTML/JS/CSS — React Vite production build uploaded via FTP or File Manager |
| Backend | **TBD** — see Backend Provider Requirements below | FastAPI Python app |
| Database | Supabase | PostgreSQL + Storage — already chosen |

### Backend Provider Requirements

The backend provider is not yet decided. Any provider chosen **must** satisfy all of the following:

| Requirement | Why |
|---|---|
| **Python / FastAPI support** | Backend is FastAPI (Python 3.11) |
| **Always-on / no sleep** | APScheduler runs inside the FastAPI process. If the server sleeps, all scheduled jobs (reminders, alerts) stop firing silently. |
| **HTTPS** | Required for WebAuthn biometric login (W3C spec). Plain HTTP will cause biometric registration and login to fail entirely. |
| **Persistent process** | APScheduler is not a cron job — it runs inside the app process. Serverless / function-based platforms (AWS Lambda, Cloudflare Workers, Vercel) do **not** work. |
| **Environment variable / secrets management** | 11 backend env vars including JWT secret and API keys |
| **Outbound HTTP** | FastAPI calls Resend for email and Supabase for storage — outbound HTTP must not be blocked |

### Candidate Providers (free tier)

| Provider | Always-on | Notes |
|---|---|---|
| **Fly.io** | ✓ (with `auto_stop_machines = false`) | Best free option. CLI-based deploy. `fly.toml` config file. |
| **Koyeb** | ✓ | Simpler setup than Fly.io. 0.1 vCPU (very limited), 512MB RAM. 1 service on free tier. |
| **Railway** | ✓ | $5 free credit/month, then pay-as-you-go. Simplest deploy experience. |
| **Render** | ✗ (sleeps after 15 min) | Free tier not suitable — APScheduler will stop. Paid plan ($7/mo) adds always-on. |

> The spec uses Fly.io as a reference for the deploy steps and `fly.toml` config. If a different provider is chosen, the steps will differ but all requirements above still apply.

---

## Environment Variables

### Frontend (`.env.production`)

| Variable | Value / Description |
|---|---|
| `VITE_API_URL` | Full URL of the FastAPI backend (e.g. `https://wecapture4u.fly.dev`) |

### Backend (`.env` / Fly.io secrets)

| Variable | Value / Description |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string (pooled, port 6543) |
| `JWT_SECRET_KEY` | Minimum 32-character random secret for signing JWTs. Generate with: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` |
| `ADMIN_REFRESH_TOKEN_EXPIRE_HOURS` | `8` — admin session expires after 8 hours of inactivity |
| `CLIENT_REFRESH_TOKEN_EXPIRE_HOURS` | `24` — client session expires after 24 hours of inactivity |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Verified sender address (e.g. `noreply@yourdomain.com`) |
| `SUPABASE_URL` | Supabase project URL (for Storage access via supabase-py) |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (not the anon key — needed for Storage uploads bypassing RLS) |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins (e.g. `https://www.yourdomain.com,https://yourdomain.com,http://localhost:5173`) |
| `WEBAUTHN_RP_ID` | Relying Party ID — must match the domain exactly (e.g. `wecapture4u.com`). Used by `py_webauthn` at registration and authentication. Mismatch causes biometric flows to fail silently. In development: `localhost`. |
| `WEBAUTHN_RP_NAME` | Human-readable app name shown to users during biometric prompt (e.g. `weCapture4U`). |
| `ENVIRONMENT` | `production` / `development` |

---

## CORS Configuration

FastAPI CORS middleware. Origins loaded from `ALLOWED_ORIGINS` env var (split on comma). In development, also allow `http://localhost:5173`.

Middleware config:
- `allow_origins`: list from env var
- `allow_credentials`: `True` (needed for Authorization header)
- `allow_methods`: `["*"]`
- `allow_headers`: `["*"]`

> **Critical:** Never hardcode origins. If `ALLOWED_ORIGINS` is missing in production, FastAPI should raise a startup error, not silently allow all origins.

---

## Health Check Endpoint

FastAPI must expose `GET /api/health` → returns `{"status": "ok"}` with 200. No auth required. Used by Fly.io health checks.

---

## Frontend Build & Deploy (Hostinger)

1. Set `VITE_API_URL` in `.env.production` to the Fly.io backend URL.
2. Run `npm run build` → produces `dist/` folder.
3. Upload contents of `dist/` to Hostinger via FTP or File Manager (into `public_html/`).
4. Add `.htaccess` file in `public_html/` for React Router SPA support (all routes → `index.html`):

```
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QR,L]
```

> ⚠️ **LAUNCH BLOCKER — `.htaccess` is required.** Without it, Hostinger's Apache server returns a `404` for any URL that isn't the root (e.g. refreshing `/client/jobs/123` or navigating directly to `/admin/accounting`). The app will appear broken to users. This file must be present in `public_html/` alongside `index.html` before going live.

5. HTTPS: Hostinger provides free SSL via Let's Encrypt — enable in Hostinger panel under SSL/TLS.

---

## Backend Deploy (Fly.io)

1. Install Fly CLI: `brew install flyctl` (macOS)
2. Login: `flyctl auth login`
3. From project root: `flyctl launch` → select region, name the app (e.g. `wecapture4u-api`), **do not** create a Fly Postgres (using Supabase).
4. Set secrets: `flyctl secrets set DATABASE_URL="..." JWT_SECRET_KEY="..." RESEND_API_KEY="..." ...` (all env vars listed above)
5. Configure `fly.toml` (see template below).
6. Deploy: `flyctl deploy`
7. Check logs: `flyctl logs`

### `Dockerfile` for FastAPI

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### `fly.toml` Template

```toml
app = "wecapture4u-api"
primary_region = "fra"  # Frankfurt — close to Europe

[build]

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  memory = "256mb"
  cpu_kind = "shared"
  cpus = 1
```

> ⚠️ **LAUNCH BLOCKER — `auto_stop_machines = false` is required.** Without this setting, Fly.io will put the machine to sleep after inactivity. APScheduler runs inside the FastAPI process — when the machine sleeps, the scheduler stops entirely. Appointment reminders, birthday alerts, and invoice overdue notifications will silently never fire. Set `auto_stop_machines = false` and `min_machines_running = 1` in `fly.toml` before the first deploy and never change them.

### Fly.io Health Check Configuration

In `fly.toml` `[http_service]` section:
- Path: `GET /api/health`
- Interval: 10s
- Timeout: 5s
- Grace period: 30s

---

## HTTPS Requirement

WebAuthn (biometric login) **only works on HTTPS origins**. Both the frontend and backend must be served over HTTPS in production:

- **Frontend:** Hostinger free SSL (Let's Encrypt) — enable in panel
- **Backend:** Fly.io serves HTTPS automatically via its proxy (`force_https = true` in `fly.toml`)

---

## Database Migrations

Supabase migrations run manually before deploy:

1. Write migration SQL files in `migrations/` folder (numbered sequentially).
2. Run against Supabase using the Supabase SQL editor or `psql` with the connection string.
3. Always run migrations **before** deploying new backend code that depends on them.
4. Run in order — each migration may depend on the previous one.

### Migration Plan

| File | Contents |
|---|---|
| `001_initial_schema.sql` | `users`, `clients`, `session_types`, `appointments`, `job_stages`, `jobs`, `invoices`, `invoice_items`, `app_settings`, `notifications`, `password_reset_tokens` |
| `002_webauthn.sql` | `webauthn_credentials`, `refresh_tokens` |
| `003_accounting.sql` | `accounts`, `journal_entries`, `journal_lines`, `invoice_payments`, `expenses` + seed chart of accounts |
| `004_client_portal.sql` | `booking_requests` + `jobs.delivery_url` column |
| `005_portfolio.sql` | `hero_photos`, `portfolio_categories`, `portfolio_photos`, `contact_submissions` + `app_settings` portfolio columns + indexes |
| `006_seo.sql` | `app_settings` SEO columns (`meta_title`, `meta_description`, `og_image_url`) |

---

## Pre-Launch Checklist

- [ ] `VITE_API_URL` set correctly in `.env.production` before `npm run build`
- [ ] All Fly.io secrets set (`flyctl secrets list` to verify keys exist — including `WEBAUTHN_RP_ID` and `WEBAUTHN_RP_NAME`)
- [ ] `ALLOWED_ORIGINS` includes the exact Hostinger domain (with and without `www` if both are used)
- [ ] HTTPS enabled on Hostinger domain
- [ ] `fly.toml` has `auto_stop_machines = false` and `min_machines_running = 1`
- [ ] `GET /api/health` returns 200 after deploy (`curl https://wecapture4u.fly.dev/api/health`)
- [ ] Database migrations applied before backend deploy
- [ ] Supabase Storage bucket `avatars` created with public read access
- [ ] Supabase Storage bucket `portfolio` created with public read access
- [ ] Test login (password), biometric registration, and password reset end-to-end in production
- [ ] Test a booking request from client portal to verify CORS is working

---

## Out of Scope (Deployment)

- CI/CD pipeline (GitHub Actions) — manual deploys for now
- Staging environment — single production environment for this iteration
- Custom domain for backend (Fly.io subdomain is fine for now)
- Database backups beyond Supabase's built-in point-in-time recovery
- CDN for static assets beyond what Hostinger provides
