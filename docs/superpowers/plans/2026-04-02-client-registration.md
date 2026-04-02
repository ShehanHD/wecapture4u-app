# Client Self-Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow clients to self-register on the public site with email verification, replacing Resend with Hostinger SMTP throughout.

**Architecture:** SMTP migration first (touches `email.py`, `config.py`, `services/auth.py`), then DB migrations, then backend endpoints (new ORM model + router endpoints + login 403 change), then frontend (API functions, hooks, schemas, two new pages, route wiring). Each task is independently committable and testable.

**Tech Stack:** Python/FastAPI (aiosmtplib, pydantic, SQLAlchemy async), PostgreSQL, React/TypeScript (TanStack Query v5, react-hook-form, zod, react-router-dom v6).

---

## File Map

| File | Action |
|------|--------|
| `backend/services/email.py` | Replace Resend with aiosmtplib |
| `backend/services/auth.py` | Update `send_password_reset_email` to use new `send_email()` |
| `backend/config.py` | Replace RESEND_* with SMTP_* settings |
| `backend/.env.example` | Replace RESEND_* with SMTP_* vars |
| `backend/models/user.py` | Add `phone` column |
| `backend/models/email_verification.py` | New — `EmailVerificationToken` ORM model |
| `backend/schemas/auth.py` | Add `RegisterRequest`, `ResendVerificationRequest` |
| `backend/routers/auth.py` | Add register/verify-email/resend-verification endpoints; update login 403 |
| `backend/tests/test_routers_auth.py` | New test file for registration flow |
| `migrations/016_user_phone.sql` | ADD COLUMN phone to users |
| `migrations/017_email_verification_tokens.sql` | New table |
| `frontend/src/api/auth.ts` | New file — registerClient, verifyEmail, resendVerification |
| `frontend/src/hooks/useAuth.ts` | Add useRegister, useVerifyEmail, useResendVerification |
| `frontend/src/schemas/auth.ts` | New file — RegisterSchema, VerifyEmailResponseSchema |
| `frontend/src/pages/auth/ClientRegister.tsx` | New page |
| `frontend/src/pages/auth/VerifyEmail.tsx` | New page |
| `frontend/src/pages/auth/ClientLogin.tsx` | Add "Register" link |
| `frontend/src/routes/index.tsx` | Add /client/register and /client/verify-email routes |

---

## Task 1: SMTP Migration (email.py + config.py)

**Files:**
- Modify: `backend/services/email.py`
- Modify: `backend/services/auth.py`
- Modify: `backend/config.py`
- Modify: `backend/.env.example`

- [ ] **Step 1: Install aiosmtplib**

```bash
cd backend && source venv/bin/activate
pip install aiosmtplib
pip freeze | grep aiosmtplib >> requirements.txt
```

Expected: `aiosmtplib==X.Y.Z` appears in `requirements.txt`.

- [ ] **Step 2: Update config.py**

Replace the `RESEND_API_KEY` and `RESEND_FROM_EMAIL` fields with SMTP settings:

```python
# backend/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    ADMIN_REFRESH_TOKEN_EXPIRE_HOURS: int = 8
    CLIENT_REFRESH_TOKEN_EXPIRE_HOURS: int = 24
    SMTP_HOST: str = "smtp.hostinger.com"
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@wecapture4u.com"
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    ALLOWED_ORIGINS: str = ""
    ENVIRONMENT: str = "development"
    WEBAUTHN_RP_ID: str
    WEBAUTHN_RP_NAME: str
    CRON_SECRET: str = ""

    @property
    def webauthn_origin(self) -> str:
        if self.WEBAUTHN_RP_ID == "localhost":
            return "http://localhost:5173"
        return f"https://{self.WEBAUTHN_RP_ID}"

    @property
    def allowed_origins_list(self) -> list[str]:
        origins = [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
        if self.ENVIRONMENT == "development":
            if "http://localhost:5173" not in origins:
                origins.append("http://localhost:5173")
        return origins

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
```

- [ ] **Step 3: Update email.py to use aiosmtplib**

```python
# backend/services/email.py
"""
Shared email helper using aiosmtplib (Hostinger SMTP / SSL on port 465).
Call send_email() from any service that needs to dispatch transactional email.
"""
from __future__ import annotations

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import aiosmtplib

from config import settings

logger = logging.getLogger(__name__)


async def send_email(
    *,
    to: str,
    subject: str,
    html: str,
    from_email: Optional[str] = None,
) -> None:
    """Send a transactional email via Hostinger SMTP (SSL, port 465).

    Raises on SMTP error — callers should catch and handle as appropriate.
    Never swallow exceptions here; let callers decide whether to log-and-continue.
    """
    sender = from_email or settings.SMTP_FROM_EMAIL

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = to
    message.attach(MIMEText(html, "html"))

    await aiosmtplib.send(
        message,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASSWORD,
        use_tls=True,  # SSL/TLS on port 465
    )
    logger.debug("Email sent to %s — subject: %s", to, subject)
```

- [ ] **Step 4: Update send_password_reset_email in services/auth.py**

The function currently uses Resend directly. Replace it to use the shared `send_email()` function:

```python
async def send_password_reset_email(to_email: str, reset_url: str) -> None:
    """Send password reset email. Failures are logged, not raised."""
    from services.email import send_email
    try:
        await send_email(
            to=to_email,
            subject="Reset your password",
            html=f"""
                <p>Click the link below to reset your password. This link expires in 1 hour.</p>
                <p><a href="{reset_url}">Reset password</a></p>
                <p>If you didn't request this, ignore this email.</p>
            """,
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("Failed to send password reset email: %s", exc)
```

- [ ] **Step 5: Update .env.example**

```
DATABASE_URL="postgresql+asyncpg://user:password@host:6543/postgres"
JWT_SECRET_KEY=c055adebfbc7084e9457dad22aee31ed738c1e4f0c2e5c50874ff2c0b8bd0fb3
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
ADMIN_REFRESH_TOKEN_EXPIRE_HOURS=8
CLIENT_REFRESH_TOKEN_EXPIRE_HOURS=24
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=noreply@wecapture4u.com
SMTP_PASSWORD=
SMTP_FROM_EMAIL=noreply@wecapture4u.com
SUPABASE_URL=https://bicgpqtfjxpxnhqbdozr.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpY2dwcXRmanhweG5ocWJkb3pyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjUyMjE3NSwiZXhwIjoyMDg4MDk4MTc1fQ.LYMKlq8EMnP3Kw3UAjuEkePAcJcSrebb2gWpVR2CbJw
ALLOWED_ORIGINS=https://wecapture4u.com,https://www.wecapture4u.com
ENVIRONMENT=production
WEBAUTHN_RP_ID=wecapture4u.com
WEBAUTHN_RP_NAME=weCapture4U
CRON_SECRET=a358624a788f9eb3947bf136710f08690af224352b39e277f6ed44fab38c19b5
```

- [ ] **Step 6: Verify the app starts**

```bash
cd backend && source venv/bin/activate
python -c "from services.email import send_email; from services.auth import send_password_reset_email; print('Imports OK')"
```

Expected: `Imports OK`

- [ ] **Step 7: Commit**

```bash
git add backend/services/email.py backend/services/auth.py backend/config.py backend/.env.example backend/requirements.txt
git commit -m "feat(email): replace Resend with aiosmtplib SMTP (Hostinger)"
```

---

## Task 2: DB Migrations

**Files:**
- Create: `migrations/016_user_phone.sql`
- Create: `migrations/017_email_verification_tokens.sql`

> **Note:** These migrations must be applied manually to the Supabase database before running tests for Tasks 3+. The implementer should apply them after writing them.

- [ ] **Step 1: Write migration 016**

```sql
-- migrations/016_user_phone.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
```

- [ ] **Step 2: Write migration 017**

```sql
-- migrations/017_email_verification_tokens.sql
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id
  ON email_verification_tokens(user_id);
```

- [ ] **Step 3: Apply migrations to Supabase**

Run both SQL files against the database (Supabase dashboard SQL editor or psql). Verify:

```bash
cd backend && source venv/bin/activate
python -c "
import asyncio
from database import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as db:
        r1 = await db.execute(text(\"SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='phone'\"))
        r2 = await db.execute(text(\"SELECT to_regclass('public.email_verification_tokens')\"))
        print('phone column:', r1.scalar_one_or_none())
        print('table exists:', r2.scalar_one_or_none())

asyncio.run(check())
"
```

Expected:
```
phone column: phone
table exists: email_verification_tokens
```

- [ ] **Step 4: Commit**

```bash
git add migrations/016_user_phone.sql migrations/017_email_verification_tokens.sql
git commit -m "feat(db): add users.phone column and email_verification_tokens table"
```

---

## Task 3: EmailVerificationToken ORM model + phone on User

**Files:**
- Modify: `backend/models/user.py`
- Create: `backend/models/email_verification.py`

- [ ] **Step 1: Add phone column to User model**

In `backend/models/user.py`, add `phone` after `full_name`:

```python
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base
import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    client = "client"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="user_role"), nullable=False)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    token_hash: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
```

- [ ] **Step 2: Create EmailVerificationToken ORM model**

```python
# backend/models/email_verification.py
import uuid
from datetime import datetime
from sqlalchemy import Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    token_hash: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 3: Verify imports**

```bash
cd backend && source venv/bin/activate
python -c "
from models.user import User, UserRole
from models.email_verification import EmailVerificationToken
u = User(email='t@t.com', hashed_password='x', role=UserRole.client, full_name='T', phone='+1234')
print('phone:', u.phone)
print('EVT table:', EmailVerificationToken.__tablename__)
"
```

Expected:
```
phone: +1234
EVT table: email_verification_tokens
```

- [ ] **Step 4: Commit**

```bash
git add backend/models/user.py backend/models/email_verification.py
git commit -m "feat(models): add User.phone column and EmailVerificationToken model"
```

---

## Task 4: Backend schemas + registration service function

**Files:**
- Modify: `backend/schemas/auth.py`
- Create: `backend/services/registration.py`

- [ ] **Step 1: Add RegisterRequest and ResendVerificationRequest to schemas/auth.py**

Append to the end of `backend/schemas/auth.py`:

```python
# --- Registration ---
class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: str = Field(min_length=1, max_length=30)
    password: str = Field(min_length=8, max_length=128)


class ResendVerificationRequest(BaseModel):
    email: EmailStr
```

Also add `from pydantic import BaseModel, EmailStr, field_validator, Field` at the top (add `Field` to existing import).

- [ ] **Step 2: Create services/registration.py**

This service centralises the token-generation and email logic so the router stays thin:

```python
# backend/services/registration.py
"""
Registration service: token generation, verification, and email dispatch
for the client self-registration flow.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from config import settings
from models.email_verification import EmailVerificationToken
from services.auth import generate_opaque_token, hash_token
from services.email import send_email

logger = logging.getLogger(__name__)

VERIFICATION_TOKEN_TTL_HOURS = 24


async def issue_verification_token(user_id, db: AsyncSession) -> str:
    """Delete any existing tokens for user, create a fresh one, return the raw token."""
    await db.execute(
        delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id)
    )
    raw_token = generate_opaque_token()
    db.add(EmailVerificationToken(
        user_id=user_id,
        token_hash=hash_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=VERIFICATION_TOKEN_TTL_HOURS),
    ))
    return raw_token


async def send_verification_email(to_email: str, raw_token: str) -> None:
    """Send the email-verification link. Failures are logged, not raised."""
    frontend_url = settings.ALLOWED_ORIGINS.split(",")[0].strip() if settings.ALLOWED_ORIGINS else "http://localhost:5173"
    verify_url = f"{frontend_url}/client/verify-email?token={raw_token}"
    try:
        await send_email(
            to=to_email,
            subject="Verify your email — weCapture4U",
            html=f"""
                <p>Thanks for registering with weCapture4U!</p>
                <p>Please verify your email address by clicking the link below.
                   This link expires in 24 hours.</p>
                <p><a href="{verify_url}">Verify my email</a></p>
                <p>If you didn't create an account, you can safely ignore this email.</p>
            """,
        )
    except Exception as exc:
        logger.error("Failed to send verification email to %s: %s", to_email, exc)
```

- [ ] **Step 3: Verify imports**

```bash
cd backend && source venv/bin/activate
python -c "
from schemas.auth import RegisterRequest, ResendVerificationRequest
from services.registration import issue_verification_token, send_verification_email
print('RegisterRequest fields:', list(RegisterRequest.model_fields.keys()))
print('Imports OK')
"
```

Expected:
```
RegisterRequest fields: ['full_name', 'email', 'phone', 'password']
Imports OK
```

- [ ] **Step 4: Commit**

```bash
git add backend/schemas/auth.py backend/services/registration.py
git commit -m "feat(auth): add RegisterRequest schema and registration service helpers"
```

---

## Task 5: Backend — register / verify-email / resend-verification endpoints + login 403

**Files:**
- Modify: `backend/routers/auth.py`

- [ ] **Step 1: Write the failing tests first**

Create `backend/tests/test_routers_auth.py`:

```python
import pytest
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from models.user import User, UserRole
from models.email_verification import EmailVerificationToken
from services.auth import hash_password, hash_token, generate_opaque_token
from datetime import datetime, timezone, timedelta


# ---------------------------------------------------------------------------
# POST /api/auth/register
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_register_returns_202(test_client):
    resp = await test_client.post("/api/auth/register", json={
        "full_name": "Jane Smith",
        "email": f"jane_{uuid4().hex[:8]}@example.com",
        "phone": "+353 87 123 4567",
        "password": "securepass123",
    })
    assert resp.status_code == 202


@pytest.mark.asyncio
async def test_register_creates_inactive_user(test_client, db_session):
    email = f"jane_{uuid4().hex[:8]}@example.com"
    await test_client.post("/api/auth/register", json={
        "full_name": "Jane Smith",
        "email": email,
        "phone": "+353 87 123 4567",
        "password": "securepass123",
    })
    from sqlalchemy import select
    result = await db_session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    assert user is not None
    assert user.is_active is False
    assert user.role == UserRole.client
    assert user.phone == "+353 87 123 4567"


@pytest.mark.asyncio
async def test_register_creates_client_record(test_client, db_session):
    from models.client import Client
    from sqlalchemy import select
    email = f"jane_{uuid4().hex[:8]}@example.com"
    await test_client.post("/api/auth/register", json={
        "full_name": "Jane Smith",
        "email": email,
        "phone": "+353 87 123 4567",
        "password": "securepass123",
    })
    result = await db_session.execute(select(Client).where(Client.email == email))
    client = result.scalar_one_or_none()
    assert client is not None
    assert client.name == "Jane Smith"
    assert client.phone == "+353 87 123 4567"


@pytest.mark.asyncio
async def test_register_duplicate_verified_email_returns_202_silently(test_client, db_session):
    """Already-verified email must return 202 without error (no enumeration)."""
    user = User(
        email=f"exists_{uuid4().hex[:8]}@example.com",
        hashed_password=hash_password("somepass1"),
        role=UserRole.client,
        full_name="Existing",
        is_active=True,  # already verified
    )
    db_session.add(user)
    await db_session.flush()
    resp = await test_client.post("/api/auth/register", json={
        "full_name": "Existing",
        "email": user.email,
        "phone": "+353 1 234 5678",
        "password": "somepass1",
    })
    assert resp.status_code == 202


@pytest.mark.asyncio
async def test_register_short_password_fails(test_client):
    resp = await test_client.post("/api/auth/register", json={
        "full_name": "Jane",
        "email": f"jane_{uuid4().hex[:8]}@example.com",
        "phone": "+353 87 000 0000",
        "password": "short",
    })
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/auth/verify-email
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_verify_email_success(test_client, db_session):
    from sqlalchemy import select
    user = User(
        email=f"verify_{uuid4().hex[:8]}@example.com",
        hashed_password=hash_password("pass1234"),
        role=UserRole.client,
        full_name="Verify Me",
        is_active=False,
    )
    db_session.add(user)
    await db_session.flush()

    raw = generate_opaque_token()
    db_session.add(EmailVerificationToken(
        user_id=user.id,
        token_hash=hash_token(raw),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    ))
    await db_session.flush()

    resp = await test_client.get(f"/api/auth/verify-email?token={raw}")
    assert resp.status_code == 200
    assert "verified" in resp.json()["message"].lower()

    result = await db_session.execute(select(User).where(User.id == user.id))
    refreshed = result.scalar_one()
    assert refreshed.is_active is True


@pytest.mark.asyncio
async def test_verify_email_expired_returns_410(test_client, db_session):
    user = User(
        email=f"expired_{uuid4().hex[:8]}@example.com",
        hashed_password=hash_password("pass1234"),
        role=UserRole.client,
        full_name="Expired",
        is_active=False,
    )
    db_session.add(user)
    await db_session.flush()

    raw = generate_opaque_token()
    db_session.add(EmailVerificationToken(
        user_id=user.id,
        token_hash=hash_token(raw),
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),  # already expired
    ))
    await db_session.flush()

    resp = await test_client.get(f"/api/auth/verify-email?token={raw}")
    assert resp.status_code == 410


@pytest.mark.asyncio
async def test_verify_email_invalid_token_returns_400(test_client):
    resp = await test_client.get("/api/auth/verify-email?token=notarealtoken")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/auth/resend-verification
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_resend_verification_always_202(test_client):
    resp = await test_client.post("/api/auth/resend-verification", json={
        "email": "nonexistent@example.com"
    })
    assert resp.status_code == 202


@pytest.mark.asyncio
async def test_resend_verification_replaces_token(test_client, db_session):
    from sqlalchemy import select
    user = User(
        email=f"resend_{uuid4().hex[:8]}@example.com",
        hashed_password=hash_password("pass1234"),
        role=UserRole.client,
        full_name="Resend Me",
        is_active=False,
    )
    db_session.add(user)
    await db_session.flush()

    old_raw = generate_opaque_token()
    db_session.add(EmailVerificationToken(
        user_id=user.id,
        token_hash=hash_token(old_raw),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    ))
    await db_session.flush()

    await test_client.post("/api/auth/resend-verification", json={"email": user.email})

    result = await db_session.execute(
        select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
    )
    tokens = result.scalars().all()
    assert len(tokens) == 1
    assert tokens[0].token_hash != hash_token(old_raw)  # token was replaced


# ---------------------------------------------------------------------------
# POST /api/auth/login — 403 for unverified
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_unverified_user_returns_403(test_client, db_session):
    user = User(
        email=f"unverified_{uuid4().hex[:8]}@example.com",
        hashed_password=hash_password("pass1234x"),
        role=UserRole.client,
        full_name="Unverified",
        is_active=False,
    )
    db_session.add(user)
    await db_session.flush()

    resp = await test_client.post("/api/auth/login", json={
        "email": user.email,
        "password": "pass1234x",
    })
    assert resp.status_code == 403
    assert "verify" in resp.json()["detail"].lower()
```

- [ ] **Step 2: Run tests — verify they all fail**

```bash
cd backend && source venv/bin/activate
pytest tests/test_routers_auth.py -v 2>&1 | tail -30
```

Expected: All tests FAIL (endpoints don't exist yet).

- [ ] **Step 3: Add imports to routers/auth.py**

Add to the import block at the top of `backend/routers/auth.py`:

```python
from models.client import Client
from models.email_verification import EmailVerificationToken
from schemas.auth import (
    LoginRequest, TokenResponse, RefreshRequest,
    ForgotPasswordRequest, ResetPasswordRequest, CurrentUser,
    WebAuthnDeviceCheckResponse, WebAuthnCredentialResponse,
    WebAuthnAuthenticateOptionsRequest, WebAuthnRegisterVerifyRequest,
    WebAuthnAuthenticateVerifyRequest,
    RegisterRequest, ResendVerificationRequest,
)
from services.registration import issue_verification_token, send_verification_email
from services.auth import (
    verify_password, create_access_token, generate_opaque_token,
    hash_token, refresh_token_expiry, send_password_reset_email, hash_password,
)
```

- [ ] **Step 4: Update the login endpoint to return 403 for unverified clients**

The existing login check (`if not user.is_active`) returns a generic "deactivated" message. Change the message for client users who are unverified. Replace the `is_active` check block:

```python
@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        if user.role == UserRole.client:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please verify your email before signing in.",
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact support.",
        )

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    raw_refresh = generate_opaque_token()
    refresh_hash = hash_token(raw_refresh)

    db.add(RefreshToken(
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=refresh_token_expiry(user.role.value),
    ))
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)
```

Also add `from models.user import User, PasswordResetToken, UserRole` (add `UserRole` to existing import).

- [ ] **Step 5: Add the three new endpoints to routers/auth.py**

Add after the `reset_password` endpoint (before `class ChallengeStore`):

```python
@router.post("/register", status_code=status.HTTP_202_ACCEPTED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Public self-registration. Always returns 202 (no email enumeration)."""
    result = await db.execute(select(User).where(User.email == body.email))
    existing = result.scalar_one_or_none()

    if existing:
        if existing.is_active:
            # Already verified — silent no-op
            return {"message": "If that email is new, a verification link has been sent."}
        # Unverified — resend a fresh token
        raw_token = await issue_verification_token(existing.id, db)
        await db.commit()
        await send_verification_email(existing.email, raw_token)
        return {"message": "If that email is new, a verification link has been sent."}

    from services.auth import hash_password
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        role=UserRole.client,
        full_name=body.full_name,
        phone=body.phone,
        is_active=False,
    )
    db.add(user)
    await db.flush()  # get user.id

    client = Client(
        user_id=user.id,
        name=body.full_name,
        email=body.email,
        phone=body.phone,
    )
    db.add(client)

    raw_token = await issue_verification_token(user.id, db)
    await db.commit()
    await send_verification_email(body.email, raw_token)
    return {"message": "If that email is new, a verification link has been sent."}


@router.get("/verify-email", status_code=status.HTTP_200_OK)
async def verify_email(token: str, db: AsyncSession = Depends(get_db)) -> dict:
    """Verify a client's email using the token from the verification link."""
    token_hash = hash_token(token)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token_hash == token_hash,
        )
    )
    stored = result.scalar_one_or_none()

    if stored is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already used verification link.",
        )

    if stored.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Verification link has expired.",
        )

    if stored.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already used verification link.",
        )

    await db.execute(
        update(User).where(User.id == stored.user_id).values(is_active=True)
    )
    stored.used_at = now
    await db.commit()

    return {"message": "Email verified. You can now sign in."}


@router.post("/resend-verification", status_code=status.HTTP_202_ACCEPTED)
async def resend_verification(body: ResendVerificationRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Resend verification email. Always returns 202 (no email enumeration)."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user and not user.is_active:
        raw_token = await issue_verification_token(user.id, db)
        await db.commit()
        await send_verification_email(user.email, raw_token)

    return {"message": "If that email is pending verification, a new link has been sent."}
```

Also ensure `datetime` and `timezone` are imported at the top of the file (they already are in the existing code).

- [ ] **Step 6: Run tests — verify they all pass**

```bash
cd backend && source venv/bin/activate
pytest tests/test_routers_auth.py -v 2>&1 | tail -30
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/routers/auth.py backend/tests/test_routers_auth.py
git commit -m "feat(auth): add client self-registration endpoints and login 403 for unverified"
```

---

## Task 6: Frontend — Zod schemas + API functions + hooks

**Files:**
- Create: `frontend/src/schemas/auth.ts`
- Create: `frontend/src/api/auth.ts`
- Modify: `frontend/src/hooks/useAuth.ts`

- [ ] **Step 1: Create frontend/src/schemas/auth.ts**

```typescript
// frontend/src/schemas/auth.ts
import { z } from 'zod'

export const RegisterSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(1, 'Phone is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
})

export type RegisterFormData = z.infer<typeof RegisterSchema>

export const VerifyEmailResponseSchema = z.object({
  message: z.string(),
})

export type VerifyEmailResponse = z.infer<typeof VerifyEmailResponseSchema>
```

- [ ] **Step 2: Create frontend/src/api/auth.ts**

```typescript
// frontend/src/api/auth.ts
import { api } from '@/lib/axios'
import { VerifyEmailResponseSchema, type VerifyEmailResponse } from '@/schemas/auth'

export interface RegisterPayload {
  full_name: string
  email: string
  phone: string
  password: string
}

export async function registerClient(data: RegisterPayload): Promise<void> {
  await api.post('/api/auth/register', data)
}

export async function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  const { data } = await api.get('/api/auth/verify-email', { params: { token } })
  return VerifyEmailResponseSchema.parse(data)
}

export async function resendVerification(email: string): Promise<void> {
  await api.post('/api/auth/resend-verification', { email })
}
```

- [ ] **Step 3: Add hooks to frontend/src/hooks/useAuth.ts**

The file currently starts with `import { useCallback } from 'react'`. Add the TanStack Query imports at the top of the file, then append the three hook functions at the bottom.

Add to the top of the file (after the existing imports):

```typescript
import { useMutation, useQuery } from '@tanstack/react-query'
import { registerClient, verifyEmail, resendVerification, type RegisterPayload } from '@/api/auth'
```

Append to the end of the file (after the closing `}`  of `useAuth`):

```typescript
export function useRegister() {
  return useMutation({
    mutationFn: (data: RegisterPayload) => registerClient(data),
  })
}

export function useVerifyEmail(token: string | null) {
  return useQuery({
    queryKey: ['verify-email', token],
    queryFn: () => verifyEmail(token!),
    enabled: !!token,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) => resendVerification(email),
  })
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: Build succeeds (no TypeScript errors).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/schemas/auth.ts frontend/src/api/auth.ts frontend/src/hooks/useAuth.ts
git commit -m "feat(auth): add registration API functions, hooks, and Zod schemas"
```

---

## Task 7: Frontend — ClientRegister page

**Files:**
- Create: `frontend/src/pages/auth/ClientRegister.tsx`

- [ ] **Step 1: Create ClientRegister.tsx**

```tsx
// frontend/src/pages/auth/ClientRegister.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RegisterSchema, type RegisterFormData } from '@/schemas/auth'
import { useRegister } from '@/hooks/useAuth'
import { useResendVerification } from '@/hooks/useAuth'

export default function ClientRegister() {
  const registerMutation = useRegister()
  const resendMutation = useResendVerification()
  const [submitted, setSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [resendDone, setResendDone] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterSchema),
  })

  const inputStyle = {
    width: '100%',
    border: '1.5px solid #e0e8ff',
    borderRadius: 10,
    background: '#f8f9ff',
    padding: '11px 14px',
    fontSize: 14,
    color: '#0a0e2e',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  const onSubmit = async (data: RegisterFormData) => {
    await registerMutation.mutateAsync({
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      password: data.password,
    })
    setSubmittedEmail(data.email)
    setSubmitted(true)
  }

  const handleResend = async () => {
    const email = submittedEmail || getValues('email')
    await resendMutation.mutateAsync(email)
    setResendDone(true)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0e2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#fff',
          borderRadius: 20,
          padding: '40px 32px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#0a0e2e' }}>weCapture4U</p>
          <p style={{ fontSize: 13, color: '#778899', marginTop: 4 }}>Create your account</p>
        </div>

        {submitted ? (
          /* Success state — inline, no redirect */
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: '#0a0e2e', marginBottom: 12 }}>
              We've sent a verification link to <strong>{submittedEmail}</strong>. Check your inbox.
            </p>
            {resendDone ? (
              <p style={{ fontSize: 13, color: '#4d79ff' }}>New link sent!</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resendMutation.isPending}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4d79ff',
                  fontSize: 13,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {resendMutation.isPending ? 'Sending…' : "Didn't receive it? Resend"}
              </button>
            )}
            <div style={{ marginTop: 24 }}>
              <Link to="/client/login" style={{ fontSize: 13, color: '#778899' }}>
                ← Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', display: 'block', marginBottom: 6 }}>
                Full Name
              </label>
              <input type="text" style={inputStyle} {...register('full_name')} />
              {errors.full_name && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.full_name.message}</p>}
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input type="email" style={inputStyle} {...register('email')} />
              {errors.email && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.email.message}</p>}
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', display: 'block', marginBottom: 6 }}>
                Phone
              </label>
              <input type="tel" style={inputStyle} {...register('phone')} />
              {errors.phone && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.phone.message}</p>}
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <input type="password" style={inputStyle} {...register('password')} />
              {errors.password && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.password.message}</p>}
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#0a0e2e', display: 'block', marginBottom: 6 }}>
                Confirm Password
              </label>
              <input type="password" style={inputStyle} {...register('confirm_password')} />
              {errors.confirm_password && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.confirm_password.message}</p>}
            </div>

            {registerMutation.isError && (
              <p style={{ color: '#e53e3e', fontSize: 13, textAlign: 'center' }}>
                Registration failed. Please try again.
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || registerMutation.isPending}
              style={{
                width: '100%',
                background: '#4d79ff',
                color: '#fff',
                fontWeight: 700,
                fontSize: 15,
                padding: 14,
                borderRadius: 10,
                border: 'none',
                cursor: (isSubmitting || registerMutation.isPending) ? 'not-allowed' : 'pointer',
                opacity: (isSubmitting || registerMutation.isPending) ? 0.6 : 1,
                marginTop: 4,
              }}
            >
              {(isSubmitting || registerMutation.isPending) ? 'Creating account…' : 'Create Account'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: '#778899' }}>
              Already have an account?{' '}
              <Link to="/client/login" style={{ color: '#4d79ff' }}>Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/auth/ClientRegister.tsx
git commit -m "feat(auth): add ClientRegister page with email-sent inline state"
```

---

## Task 8: Frontend — VerifyEmail page

**Files:**
- Create: `frontend/src/pages/auth/VerifyEmail.tsx`

- [ ] **Step 1: Create VerifyEmail.tsx**

```tsx
// frontend/src/pages/auth/VerifyEmail.tsx
import { useSearchParams, Link } from 'react-router-dom'
import { useVerifyEmail, useResendVerification } from '@/hooks/useAuth'
import { useState } from 'react'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { isPending, isSuccess, isError, error } = useVerifyEmail(token)
  const resendMutation = useResendVerification()
  const [resendEmail, setResendEmail] = useState('')
  const [resendDone, setResendDone] = useState(false)

  // Determine HTTP status from the error response
  const httpStatus = (error as { response?: { status?: number } })?.response?.status

  const cardStyle = {
    width: '100%',
    maxWidth: 400,
    background: '#fff',
    borderRadius: 20,
    padding: '40px 32px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    textAlign: 'center' as const,
  }

  const inputStyle = {
    width: '100%',
    border: '1.5px solid #e0e8ff',
    borderRadius: 10,
    background: '#f8f9ff',
    padding: '11px 14px',
    fontSize: 14,
    color: '#0a0e2e',
    outline: 'none',
    boxSizing: 'border-box' as const,
    marginTop: 12,
  }

  const handleResend = async () => {
    if (!resendEmail) return
    await resendMutation.mutateAsync(resendEmail)
    setResendDone(true)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0e2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={cardStyle}>
        <p style={{ fontSize: 22, fontWeight: 800, color: '#0a0e2e', marginBottom: 8 }}>weCapture4U</p>

        {!token && (
          <>
            <p style={{ color: '#e53e3e', fontSize: 14, marginTop: 16 }}>No verification token found.</p>
            <Link to="/client/login" style={{ display: 'block', marginTop: 20, color: '#4d79ff', fontSize: 14 }}>
              Sign In
            </Link>
          </>
        )}

        {token && isPending && (
          <p style={{ color: '#778899', fontSize: 14, marginTop: 16 }}>Verifying your email…</p>
        )}

        {token && isSuccess && (
          <>
            <p style={{ color: '#0a0e2e', fontSize: 15, marginTop: 16 }}>
              Your email is verified! You can now sign in.
            </p>
            <Link
              to="/client/login"
              style={{
                display: 'inline-block',
                marginTop: 20,
                background: '#4d79ff',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                padding: '12px 28px',
                borderRadius: 10,
                textDecoration: 'none',
              }}
            >
              Sign In
            </Link>
          </>
        )}

        {token && isError && httpStatus === 410 && (
          <>
            <p style={{ color: '#e53e3e', fontSize: 14, marginTop: 16 }}>This link has expired.</p>
            {resendDone ? (
              <p style={{ color: '#4d79ff', fontSize: 13, marginTop: 12 }}>New link sent — check your inbox.</p>
            ) : (
              <div style={{ marginTop: 16 }}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={resendEmail}
                  onChange={e => setResendEmail(e.target.value)}
                  style={inputStyle}
                />
                <button
                  onClick={handleResend}
                  disabled={resendMutation.isPending || !resendEmail}
                  style={{
                    width: '100%',
                    marginTop: 12,
                    background: '#4d79ff',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    padding: '12px 28px',
                    borderRadius: 10,
                    border: 'none',
                    cursor: (resendMutation.isPending || !resendEmail) ? 'not-allowed' : 'pointer',
                    opacity: (resendMutation.isPending || !resendEmail) ? 0.6 : 1,
                  }}
                >
                  {resendMutation.isPending ? 'Sending…' : 'Resend verification email'}
                </button>
              </div>
            )}
          </>
        )}

        {token && isError && httpStatus !== 410 && (
          <>
            <p style={{ color: '#e53e3e', fontSize: 14, marginTop: 16 }}>This link is no longer valid.</p>
            <Link
              to="/client/login"
              style={{
                display: 'inline-block',
                marginTop: 20,
                background: '#4d79ff',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                padding: '12px 28px',
                borderRadius: 10,
                textDecoration: 'none',
              }}
            >
              Sign In
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/auth/VerifyEmail.tsx
git commit -m "feat(auth): add VerifyEmail page (handles success, expired, invalid states)"
```

---

## Task 9: Frontend — Route wiring + ClientLogin "Register" link

**Files:**
- Modify: `frontend/src/routes/index.tsx`
- Modify: `frontend/src/pages/auth/ClientLogin.tsx`

- [ ] **Step 1: Add routes to frontend/src/routes/index.tsx**

Add imports at the top:

```tsx
import ClientRegister from '@/pages/auth/ClientRegister'
import VerifyEmail from '@/pages/auth/VerifyEmail'
```

Add routes inside the public client auth section (after the existing `/client/reset-password` line):

```tsx
{ path: '/client/register', element: <ClientRegister /> },
{ path: '/client/verify-email', element: <VerifyEmail /> },
```

- [ ] **Step 2: Add "Register" link to ClientLogin.tsx**

After the `<Link to="/client/forgot-password">` element and before the closing `</div>` of the card, add:

```tsx
<p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#778899' }}>
  Don't have an account?{' '}
  <Link to="/client/register" style={{ color: '#4d79ff' }}>Register</Link>
</p>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Verify routes are accessible**

```bash
cd frontend && npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/client/register
# Should return 200 (Vite serves the SPA for all routes)
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/index.tsx frontend/src/pages/auth/ClientLogin.tsx
git commit -m "feat(auth): wire /client/register and /client/verify-email routes; add register link to ClientLogin"
```

---

## Task 10: Update CLAUDE.md env vars documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Required Environment Variables section in CLAUDE.md**

In `CLAUDE.md`, find the `### Required Environment Variables (backend)` section and replace `RESEND_API_KEY` / `RESEND_FROM_EMAIL` with the SMTP vars:

```markdown
### Required Environment Variables (backend)

```
DATABASE_URL
JWT_SECRET_KEY
SMTP_HOST           # smtp.hostinger.com
SMTP_PORT           # 465
SMTP_USER           # noreply@wecapture4u.com
SMTP_PASSWORD
SMTP_FROM_EMAIL     # noreply@wecapture4u.com
SUPABASE_URL
SUPABASE_SERVICE_KEY
WEBAUTHN_RP_ID
WEBAUTHN_RP_NAME
ALLOWED_ORIGINS     # comma-separated, e.g. https://wecapture4u.com
ENVIRONMENT         # development | production
```

See `backend/.env.example` for a full template.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md env vars — SMTP replaces Resend"
```
