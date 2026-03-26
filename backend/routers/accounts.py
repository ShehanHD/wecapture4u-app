import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from schemas.accounts import AccountCreate, AccountOut
from services import accounts as svc

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


@router.get("/accounts", response_model=list[AccountOut])
async def list_accounts(
    db: DB, _: Admin,
    type: Optional[str] = Query(None),
    archived: Optional[bool] = Query(None),
):
    return await svc.list_accounts(db, type=type, archived=archived)


@router.post("/accounts", response_model=AccountOut, status_code=201)
async def create_account(body: AccountCreate, db: DB, _: Admin):
    return await svc.create_account(db, code=body.code, name=body.name, type=body.type)


@router.get("/accounts/{id}", response_model=AccountOut)
async def get_account(id: uuid.UUID, db: DB, _: Admin):
    return await svc.get_account(db, id=id)
