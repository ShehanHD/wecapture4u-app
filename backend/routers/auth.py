from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from database import get_db
from models.user import User, PasswordResetToken
from models.auth import RefreshToken
from schemas.auth import (
    LoginRequest, TokenResponse, RefreshRequest,
    ForgotPasswordRequest, ResetPasswordRequest, CurrentUser,
)
from services.auth import (
    verify_password, create_access_token, generate_opaque_token,
    hash_token, refresh_token_expiry, send_password_reset_email, hash_password,
)
from dependencies.auth import get_current_user
from config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
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


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    token_hash = hash_token(body.refresh_token)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
    )
    stored = result.scalar_one_or_none()

    if not stored:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_result = await db.execute(select(User).where(User.id == stored.user_id))
    user = user_result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Rotate: revoke old, issue new
    stored.revoked_at = now
    raw_new = generate_opaque_token()
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_new),
        expires_at=refresh_token_expiry(user.role.value),
    ))

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=raw_new)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    token_hash = hash_token(body.refresh_token)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == token_hash, RefreshToken.user_id == current_user.id)
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Always return 200 to prevent user enumeration
    if not user:
        return {"message": "If that email exists, a reset link has been sent."}

    raw_token = generate_opaque_token()
    db.add(PasswordResetToken(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    ))
    await db.commit()

    # Role-aware reset URL
    base_path = "/reset-password" if user.role.value == "admin" else "/client/reset-password"
    frontend_url = settings.ALLOWED_ORIGINS.split(",")[0].strip() if settings.ALLOWED_ORIGINS else "http://localhost:5173"
    reset_url = f"{frontend_url}{base_path}?token={raw_token}"

    await send_password_reset_email(user.email, reset_url)
    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)) -> dict:
    token_hash = hash_token(body.token)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
    )
    reset_token = result.scalar_one_or_none()

    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This reset link is invalid or has expired. Request a new one.",
        )

    await db.execute(
        update(User)
        .where(User.id == reset_token.user_id)
        .values(hashed_password=hash_password(body.new_password))
    )
    reset_token.used_at = now
    await db.commit()

    return {"message": "Password updated successfully."}


# --- WebAuthn endpoints ---
from webauthn import verify_registration_response, verify_authentication_response  # noqa: E402
from webauthn.helpers.exceptions import InvalidCBORData, InvalidAuthenticatorDataStructure  # noqa: E402
from models.auth import WebAuthnCredential  # noqa: E402
from services.webauthn import get_registration_options, get_authentication_options, options_to_json  # noqa: E402
from schemas.auth import WebAuthnDeviceCheckResponse, WebAuthnCredentialResponse  # noqa: E402
import json  # noqa: E402
from fastapi import Request  # noqa: E402

class ChallengeStore:
    """In-memory challenge store with TTL expiry.

    Entries older than TTL_SECONDS are treated as missing.
    Lazy pruning runs on every set() call — no background thread needed.
    Single-process only; sufficient for non-serverless deployment.
    """
    TTL_SECONDS = 300  # 5 minutes

    def __init__(self) -> None:
        self._store: dict[str, tuple[bytes, datetime]] = {}

    def set(self, key: str, challenge: bytes) -> None:
        self._prune()
        self._store[key] = (challenge, datetime.now(timezone.utc))

    def pop(self, key: str) -> bytes | None:
        entry = self._store.pop(key, None)
        if entry is None:
            return None
        challenge, created_at = entry
        if datetime.now(timezone.utc) - created_at > timedelta(seconds=self.TTL_SECONDS):
            return None
        return challenge

    def _prune(self) -> None:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=self.TTL_SECONDS)
        self._store = {k: v for k, v in self._store.items() if v[1] > cutoff}


_challenges = ChallengeStore()


@router.get("/webauthn/device-check", response_model=WebAuthnDeviceCheckResponse)
async def webauthn_device_check(email: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return WebAuthnDeviceCheckResponse(has_credential=False)

    cred_result = await db.execute(
        select(WebAuthnCredential).where(WebAuthnCredential.user_id == user.id)
    )
    credentials = cred_result.scalars().all()
    return WebAuthnDeviceCheckResponse(has_credential=len(credentials) > 0)


@router.post("/webauthn/register/options")
async def webauthn_register_options(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cred_result = await db.execute(
        select(WebAuthnCredential).where(WebAuthnCredential.user_id == current_user.id)
    )
    existing = [c.public_key for c in cred_result.scalars().all()]
    options = get_registration_options(str(current_user.id), current_user.email, existing)
    _challenges.set(str(current_user.id), options.challenge)
    return json.loads(options_to_json(options))


@router.post("/webauthn/register/verify", status_code=status.HTTP_201_CREATED)
async def webauthn_register_verify(
    body: dict,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    challenge = _challenges.pop(str(current_user.id))
    if not challenge:
        raise HTTPException(status_code=400, detail="No pending registration challenge.")

    try:
        verification = verify_registration_response(
            credential=body,
            expected_challenge=challenge,
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=f"https://{settings.WEBAUTHN_RP_ID}",
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Registration failed: {exc}")

    try:
        from user_agents import parse as parse_ua
        ua_string = request.headers.get("user-agent", "")
        ua = parse_ua(ua_string)
        device_name = f"{ua.device.family} · {ua.browser.family}" if ua.device.family != "Other" else ua.browser.family
    except ImportError:
        device_name = None

    credential_id = (
        verification.credential_id.decode()
        if isinstance(verification.credential_id, bytes)
        else str(verification.credential_id)
    )

    db.add(WebAuthnCredential(
        user_id=current_user.id,
        credential_id=credential_id,
        public_key=verification.credential_public_key,
        sign_count=verification.sign_count,
        device_name=device_name or None,
    ))
    await db.commit()
    return {"message": "Biometric registered successfully."}


@router.post("/webauthn/authenticate/options")
async def webauthn_authenticate_options(body: dict, db: AsyncSession = Depends(get_db)):
    email = body.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="email required")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    cred_result = await db.execute(
        select(WebAuthnCredential).where(WebAuthnCredential.user_id == user.id)
    )
    credentials = cred_result.scalars().all()
    if not credentials:
        raise HTTPException(status_code=404, detail="No credentials registered")

    options = get_authentication_options([c.public_key for c in credentials])
    _challenges.set(email, options.challenge)
    return json.loads(options_to_json(options))


@router.post("/webauthn/authenticate/verify", response_model=TokenResponse)
async def webauthn_authenticate_verify(body: dict, db: AsyncSession = Depends(get_db)):
    email = body.get("email")
    challenge = _challenges.pop(email)
    if not challenge:
        raise HTTPException(status_code=400, detail="No pending authentication challenge.")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    cred_result = await db.execute(
        select(WebAuthnCredential).where(WebAuthnCredential.user_id == user.id)
    )
    stored_creds = {c.credential_id: c for c in cred_result.scalars().all()}

    try:
        verify_authentication_response(
            credential=body,
            expected_challenge=challenge,
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=f"https://{settings.WEBAUTHN_RP_ID}",
            credential_public_key=list(stored_creds.values())[0].public_key,
            credential_current_sign_count=list(stored_creds.values())[0].sign_count,
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {exc}")

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    raw_refresh = generate_opaque_token()
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_refresh),
        expires_at=refresh_token_expiry(user.role.value),
    ))
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


@router.get("/webauthn/credentials", response_model=list[WebAuthnCredentialResponse])
async def list_credentials(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WebAuthnCredential).where(WebAuthnCredential.user_id == current_user.id)
    )
    return result.scalars().all()


@router.delete("/webauthn/credentials/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credential(
    credential_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WebAuthnCredential).where(
            WebAuthnCredential.credential_id == credential_id,
            WebAuthnCredential.user_id == current_user.id,
        )
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    await db.delete(cred)
    await db.commit()
