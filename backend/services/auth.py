import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt, JWTError
from passlib.context import CryptContext

from config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(
    data: dict[str, Any],
    expires_minutes: int = settings.ACCESS_TOKEN_EXPIRE_MINUTES,
) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload["exp"] = expire
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    # Raises jose.JWTError or jose.ExpiredSignatureError on failure
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def generate_opaque_token() -> str:
    """Generate a cryptographically secure random token (raw — never stored)."""
    return secrets.token_urlsafe(32)


def hash_token(raw_token: str) -> str:
    """SHA-256 hash of a raw token. Only the hash is stored in the DB."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


def refresh_token_expiry(role: str) -> datetime:
    """Return expiry datetime based on user role."""
    if role == "admin":
        hours = settings.ADMIN_REFRESH_TOKEN_EXPIRE_HOURS
    else:
        hours = settings.CLIENT_REFRESH_TOKEN_EXPIRE_HOURS
    return datetime.now(timezone.utc) + timedelta(hours=hours)


async def send_password_reset_email(to_email: str, reset_url: str) -> None:
    """Send password reset email. Failures are logged, not raised."""
    from services.email import send_email
    try:
        from services.email import build_email_html
        await send_email(
            to=to_email,
            subject="Reset your password — weCapture4U",
            html=build_email_html(
                title="Reset your password",
                body_html=(
                    "<p>We received a request to reset your password. "
                    "Click the button below — this link expires in <strong>1 hour</strong>.</p>"
                    "<p style='font-size:12px;color:#778899;'>If you didn't request this, you can safely ignore this email.</p>"
                ),
                cta_label="Reset my password",
                cta_url=reset_url,
            ),
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("Failed to send password reset email: %s", exc)
