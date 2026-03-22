# backend/routers/cron.py
import logging
from fastapi import APIRouter, Header, HTTPException, status

from config import settings
from scheduler import run_daily_notifications

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cron", tags=["cron"])


@router.get("/daily-notifications", status_code=status.HTTP_204_NO_CONTENT)
async def daily_notifications(
    authorization: str = Header(default=""),
) -> None:
    """
    Called by Vercel Cron Jobs once per day at 08:00 UTC.
    Protected by a bearer token matching CRON_SECRET.
    Returns 204 on success, 401 if token is wrong/missing.
    """
    expected = f"Bearer {settings.CRON_SECRET}"
    if not settings.CRON_SECRET or authorization != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.info("Cron trigger received — running daily notifications")
    await run_daily_notifications()
