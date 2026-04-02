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
