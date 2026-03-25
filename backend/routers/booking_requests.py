import logging
import uuid
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from models.booking_request import BookingRequest
from models.client import Client
from schemas.booking_request import BookingRequestOut, BookingRequestUpdate
from services.email import send_email

logger = logging.getLogger(__name__)
router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


def _to_out(req: BookingRequest, client_name: str) -> BookingRequestOut:
    return BookingRequestOut(
        id=req.id,
        client_id=req.client_id,
        client_name=client_name,
        preferred_date=req.preferred_date,
        time_slot=req.time_slot,
        session_type_id=req.session_type_id,
        addons=req.addons or [],
        message=req.message,
        status=req.status,
        admin_notes=req.admin_notes,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )


@router.get("/booking-requests", response_model=list[BookingRequestOut])
async def list_booking_requests(
    db: DB,
    _: Admin,
    status: Optional[Literal["pending", "confirmed", "rejected"]] = Query("pending"),
):
    q = (
        select(BookingRequest, Client.name.label("client_name"))
        .join(Client, BookingRequest.client_id == Client.id)
        .order_by(BookingRequest.created_at.desc())
    )
    if status:
        q = q.where(BookingRequest.status == status)
    result = await db.execute(q)
    return [_to_out(req, name) for req, name in result.all()]


@router.patch("/booking-requests/{id}", response_model=BookingRequestOut)
async def update_booking_request(
    id: uuid.UUID,
    body: BookingRequestUpdate,
    db: DB,
    _: Admin,
):
    result = await db.execute(
        select(BookingRequest, Client.name.label("client_name"), Client.email.label("client_email"))
        .join(Client, BookingRequest.client_id == Client.id)
        .where(BookingRequest.id == id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Booking request not found")

    req, client_name, client_email = row
    req.status = body.status
    req.admin_notes = body.admin_notes
    await db.flush()
    await db.refresh(req)

    if client_email:
        try:
            if body.status == "confirmed":
                await send_email(
                    to=client_email,
                    subject="Your booking request has been confirmed",
                    html=(
                        f"<p>Hi {client_name},</p>"
                        f"<p>Your booking request for <strong>{req.preferred_date}</strong> has been confirmed.</p>"
                        + (f"<p>{body.admin_notes}</p>" if body.admin_notes else "")
                        + "<p>Log in to your portal to view your job details.</p>"
                    ),
                )
            else:
                await send_email(
                    to=client_email,
                    subject="Update on your booking request",
                    html=(
                        f"<p>Hi {client_name},</p>"
                        f"<p>Unfortunately your booking request for <strong>{req.preferred_date}</strong> could not be confirmed.</p>"
                        + (f"<p>{body.admin_notes}</p>" if body.admin_notes else "")
                        + "<p>Feel free to submit a new request at a different date.</p>"
                    ),
                )
        except Exception:
            logger.warning("Failed to send booking %s email to %s", body.status, client_email)

    return _to_out(req, client_name)
