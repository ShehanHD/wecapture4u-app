import pytest
import uuid
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from services.notifications import create_notification


@pytest.mark.asyncio
async def test_create_notification_inserts_row():
    db = AsyncMock(spec=AsyncSession)

    notification = await create_notification(
        db=db,
        user_id=uuid.uuid4(),
        type_="appointment_reminder",
        title="Reminder",
        body="Your appointment is tomorrow at 10:00",
        send_email=False,
    )

    db.add.assert_called_once()
    db.flush.assert_called_once()
    assert notification.type == "appointment_reminder"
    assert notification.read is False
    assert notification.sent_email is False


@pytest.mark.asyncio
async def test_create_notification_calls_resend_when_send_email_true():
    db = AsyncMock(spec=AsyncSession)

    with patch("services.email.send_email", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = None
        await create_notification(
            db=db,
            user_id=uuid.uuid4(),
            type_="birthday",
            title="Happy Birthday!",
            body="Wishing your client a happy birthday.",
            send_email=True,
            recipient_email="client@example.com",
        )
        mock_send.assert_called_once()
