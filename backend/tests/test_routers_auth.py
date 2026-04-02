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


@pytest.mark.asyncio
async def test_verify_email_used_token_returns_400(test_client, db_session):
    user = User(
        email=f"used_{uuid4().hex[:8]}@example.com",
        hashed_password=hash_password("pass1234"),
        role=UserRole.client,
        full_name="Used Token",
        is_active=True,  # already active (token was used)
    )
    db_session.add(user)
    await db_session.flush()

    raw = generate_opaque_token()
    db_session.add(EmailVerificationToken(
        user_id=user.id,
        token_hash=hash_token(raw),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        used_at=datetime.now(timezone.utc),  # already used
    ))
    await db_session.flush()

    resp = await test_client.get(f"/api/auth/verify-email?token={raw}")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_login_deactivated_admin_returns_403(test_client, db_session):
    user = User(
        email=f"admin_{uuid4().hex[:8]}@example.com",
        hashed_password=hash_password("adminpass1"),
        role=UserRole.admin,
        full_name="Deactivated Admin",
        is_active=False,
    )
    db_session.add(user)
    await db_session.flush()

    resp = await test_client.post("/api/auth/login", json={
        "email": user.email,
        "password": "adminpass1",
    })
    assert resp.status_code == 403
    assert "deactivated" in resp.json()["detail"].lower()
