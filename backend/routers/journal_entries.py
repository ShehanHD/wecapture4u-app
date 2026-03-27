import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from schemas.journal import JournalEntryListOut, JournalEntryOut
from services import journal_entries as svc

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


@router.get("/journal-entries", response_model=list[JournalEntryListOut])
async def list_entries(
    db: DB, _: Admin,
    status: Optional[str] = Query(None),
    reference_type: Optional[str] = Query(None),
):
    return await svc.list_entries(db, status=status, reference_type=reference_type)


@router.get("/journal-entries/{id}", response_model=JournalEntryOut)
async def get_entry(id: uuid.UUID, db: DB, _: Admin):
    return await svc.get_entry(db, id=id)
