import json
import base64
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from webauthn import verify_registration_response, verify_authentication_response
from webauthn.helpers.exceptions import InvalidCBORData, InvalidAuthenticatorDataStructure

from database import get_db
from models.user import User, PasswordResetToken, UserRole
from models.client import Client
from models.email_verification import EmailVerificationToken
from models.auth import RefreshToken, WebAuthnCredential
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
from services.webauthn import get_registration_options, get_authentication_options, options_to_json
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
    body: WebAuthnRegisterVerifyRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    challenge = _challenges.pop(str(current_user.id))
    if not challenge:
        raise HTTPException(status_code=400, detail="No pending registration challenge.")

    try:
        verification = verify_registration_response(
            credential=body.model_dump(),
            expected_challenge=challenge,
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.webauthn_origin,
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

    credential_id = base64.urlsafe_b64encode(verification.credential_id).rstrip(b'=').decode('ascii')

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
async def webauthn_authenticate_options(body: WebAuthnAuthenticateOptionsRequest, db: AsyncSession = Depends(get_db)):
    if body.email:
        # Email-based flow: only allow credentials for this user
        result = await db.execute(select(User).where(User.email == body.email))
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
        _challenges.set(body.email, options.challenge)
        return json.loads(options_to_json(options))
    else:
        # Usernameless flow: empty allowCredentials — device picks the credential
        challenge_id = str(uuid.uuid4())
        options = get_authentication_options([])
        _challenges.set(challenge_id, options.challenge)
        response = json.loads(options_to_json(options))
        response["challenge_id"] = challenge_id
        return response


@router.post("/webauthn/authenticate/verify", response_model=TokenResponse)
async def webauthn_authenticate_verify(body: WebAuthnAuthenticateVerifyRequest, db: AsyncSession = Depends(get_db)):
    # Retrieve challenge — keyed by email (email flow) or challenge_id (usernameless flow)
    challenge_key = body.email if body.email else body.challenge_id
    if not challenge_key:
        raise HTTPException(status_code=400, detail="email or challenge_id required.")
    challenge = _challenges.pop(challenge_key)
    if not challenge:
        raise HTTPException(status_code=400, detail="No pending authentication challenge.")

    if body.email:
        # Email flow: look up user directly
        user_result = await db.execute(select(User).where(User.email == body.email))
        user = user_result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")
        cred_result = await db.execute(
            select(WebAuthnCredential).where(WebAuthnCredential.user_id == user.id)
        )
        stored_creds = {c.credential_id: c for c in cred_result.scalars().all()}
        matched = stored_creds.get(body.id)
    else:
        # Usernameless flow: find credential by ID, then get user from it
        cred_result = await db.execute(
            select(WebAuthnCredential).where(WebAuthnCredential.credential_id == body.id)
        )
        matched = cred_result.scalar_one_or_none()
        if matched:
            user_result = await db.execute(select(User).where(User.id == matched.user_id))
            user = user_result.scalar_one_or_none()
            if not user or not user.is_active:
                user = None
        else:
            user = None

    if not matched or not user:
        raise HTTPException(status_code=401, detail="Unknown credential")

    try:
        result = verify_authentication_response(
            credential=body.model_dump(),
            expected_challenge=challenge,
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.webauthn_origin,
            credential_public_key=matched.public_key,
            credential_current_sign_count=matched.sign_count,
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {exc}")

    matched.sign_count = result.new_sign_count

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
