import uuid
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from models.notification import Notification
from services import email as email_svc

logger = logging.getLogger(__name__)


async def create_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    type_: str,
    title: str,
    body: str,
    send_email: bool = False,
    recipient_email: Optional[str] = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        type=type_,
        title=title,
        body=body,
        read=False,
        sent_email=False,
    )
    db.add(notification)
    await db.flush()

    if send_email and recipient_email:
        try:
            await email_svc.send_email(to=recipient_email, subject=title, html=f"<p>{body}</p>")
            notification.sent_email = True
        except Exception:
            logger.exception("Failed to send notification email to %s", recipient_email)

    return notification
