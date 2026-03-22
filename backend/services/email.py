"""
Shared email helper wrapping the Resend API.
Call send_email() from any service that needs to dispatch transactional email.
"""
from __future__ import annotations

import logging
from typing import Optional

import resend

from config import settings

logger = logging.getLogger(__name__)


async def send_email(
    *,
    to: str,
    subject: str,
    html: str,
    from_email: Optional[str] = None,
) -> None:
    """Send a transactional email via Resend.

    Raises on API error — callers should catch and handle as appropriate.
    Never swallow exceptions here; let callers decide whether to log-and-continue.
    """
    resend.api_key = settings.RESEND_API_KEY
    sender = from_email or settings.RESEND_FROM_EMAIL

    params: resend.Emails.SendParams = {
        "from": sender,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    resend.Emails.send(params)
    logger.debug("Email sent to %s — subject: %s", to, subject)
