"""
Registration service: token generation, verification, and email dispatch
for the client self-registration flow.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from config import settings
from models.email_verification import EmailVerificationToken
from services.auth import generate_opaque_token, hash_token
from services.email import send_email

logger = logging.getLogger(__name__)

VERIFICATION_TOKEN_TTL_HOURS = 24


async def issue_verification_token(user_id: uuid.UUID, db: AsyncSession) -> str:
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
