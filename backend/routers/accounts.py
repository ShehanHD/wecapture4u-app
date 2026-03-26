import uuid
from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin

from schemas.accounts import AccountCreate, AccountLedgerOut, AccountOut, AccountUpdate
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


@router.get("/accounts/{id}/ledger", response_model=AccountLedgerOut)
async def get_account_ledger(
    id: uuid.UUID, db: DB, _: Admin,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
):
    return await svc.get_account_ledger(db, id=id, start_date=start_date, end_date=end_date)


@router.get("/accounts/{id}", response_model=AccountOut)
async def get_account(id: uuid.UUID, db: DB, _: Admin):
    return await svc.get_account(db, id=id)


@router.patch("/accounts/{id}", response_model=AccountOut)
async def update_account(id: uuid.UUID, body: AccountUpdate, db: DB, _: Admin):
    return await svc.update_account(db, id=id, name=body.name, archived=body.archived)


@router.delete("/accounts/{id}", status_code=204)
async def delete_account(id: uuid.UUID, db: DB, _: Admin):
    await svc.delete_account(db, id=id)
