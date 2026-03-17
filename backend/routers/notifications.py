import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import get_current_user
from models.notification import Notification
from schemas.notifications import NotificationOut

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/notifications", response_model=list[NotificationOut])
async def list_notifications(
    db: DB,
    current_user=Depends(get_current_user),
    unread: Optional[bool] = Query(None),
    type: Optional[str] = Query(None),
    limit: Optional[int] = Query(None),
):
    q = select(Notification).where(Notification.user_id == current_user.id)
    if unread is True:
        q = q.where(Notification.read.is_(False))
    if type:
        q = q.where(Notification.type == type)
    q = q.order_by(Notification.created_at.desc())
    if limit:
        q = q.limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all())


@router.patch("/notifications/{id}/read", response_model=NotificationOut)
async def mark_notification_read(
    id: uuid.UUID, db: DB, current_user=Depends(get_current_user)
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == id, Notification.user_id == current_user.id
        )
    )
    notif = result.scalar_one_or_none()
    if notif is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.read = True
    await db.flush()
    return notif


@router.post("/notifications/read-all", status_code=200)
async def mark_all_read(db: DB, current_user=Depends(get_current_user)):
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.read.is_(False),
        )
        .values(read=True)
    )
    return {"status": "ok"}
