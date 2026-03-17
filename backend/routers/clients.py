import uuid
import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from models.user import User
from schemas.clients import (
    ClientCreate, ClientUpdate, ClientOut, ClientWithStats,
    PortalAccessToggle, CreatePortalAccess,
)
from services import clients as svc

logger = logging.getLogger(__name__)
router = APIRouter()

DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


@router.get("/clients", response_model=list[ClientOut])
async def list_clients(
    db: DB, _: Admin,
    search: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
):
    return await svc.list_clients(db, search=search, tag=tag)


@router.post("/clients", response_model=ClientOut, status_code=201)
async def create_client(body: ClientCreate, db: DB, _: Admin):
    try:
        return await svc.create_client(
            db,
            name=body.name,
            email=body.email,
            phone=body.phone,
            address=body.address,
            tags=body.tags,
            birthday=body.birthday,
            notes=body.notes,
            portal_access=body.portal_access,
            temp_password=body.temp_password,
        )
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="A client with this email already exists.")
        raise


@router.get("/clients/{id}", response_model=ClientWithStats)
async def get_client(id: uuid.UUID, db: DB, _: Admin):
    client = await svc.get_client(db, id=id)
    total_spent = await svc.get_client_total_spent(db, client_id=id)

    is_active = None
    if client.user_id is not None:
        result = await db.execute(select(User.is_active).where(User.id == client.user_id))
        is_active = result.scalar_one_or_none()

    out = ClientWithStats.model_validate(client)
    out.total_spent = float(total_spent)
    out.is_active = is_active
    return out


@router.patch("/clients/{id}", response_model=ClientOut)
async def update_client(id: uuid.UUID, body: ClientUpdate, db: DB, _: Admin):
    return await svc.update_client(
        db, id=id,
        name=body.name, email=body.email, phone=body.phone,
        address=body.address, tags=body.tags, birthday=body.birthday,
        notes=body.notes,
    )


@router.delete("/clients/{id}", status_code=204)
async def delete_client(id: uuid.UUID, db: DB, _: Admin):
    await svc.delete_client(db, id=id)


@router.post("/clients/{id}/portal-access", response_model=ClientOut, status_code=201)
async def create_portal_access(id: uuid.UUID, body: CreatePortalAccess, db: DB, _: Admin):
    return await svc.create_portal_access(db, client_id=id, temp_password=body.temp_password)


@router.patch("/clients/{id}/portal-access", response_model=ClientOut)
async def toggle_portal_access(id: uuid.UUID, body: PortalAccessToggle, db: DB, _: Admin):
    return await svc.toggle_portal_access(db, client_id=id, is_active=body.is_active)
