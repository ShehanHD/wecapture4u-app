import uuid
from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from schemas.expenses import ExpenseCreate, ExpenseOut, ExpensePayPayload, ExpensePaymentStatus, ExpenseUpdate
from services import expenses as svc

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


@router.get("/expenses", response_model=list[ExpenseOut])
async def list_expenses(
    db: DB, _: Admin,
    expense_account_id: Optional[uuid.UUID] = Query(None),
    payment_status: Optional[ExpensePaymentStatus] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
):
    return await svc.list_expenses(
        db,
        expense_account_id=expense_account_id,
        payment_status=payment_status,
        start_date=start_date,
        end_date=end_date,
    )


@router.post("/expenses", response_model=ExpenseOut, status_code=201)
async def create_expense(body: ExpenseCreate, db: DB, _: Admin):
    return await svc.create_expense(
        db,
        date=body.date,
        description=body.description,
        expense_account_id=body.expense_account_id,
        amount=body.amount,
        payment_status=body.payment_status,
        payment_account_id=body.payment_account_id,
        receipt_url=body.receipt_url,
        notes=body.notes,
    )


@router.get("/expenses/{id}", response_model=ExpenseOut)
async def get_expense(id: uuid.UUID, db: DB, _: Admin):
    return await svc.get_expense(db, id=id)


@router.patch("/expenses/{id}", response_model=ExpenseOut)
async def update_expense(id: uuid.UUID, body: ExpenseUpdate, db: DB, _: Admin):
    return await svc.update_expense(
        db,
        id=id,
        date=body.date,
        description=body.description,
        expense_account_id=body.expense_account_id,
        amount=body.amount,
        payment_status=body.payment_status,
        payment_account_id=body.payment_account_id,
        receipt_url=body.receipt_url,
        notes=body.notes,
    )


@router.delete("/expenses/{id}", status_code=204)
async def delete_expense(id: uuid.UUID, db: DB, _: Admin):
    await svc.delete_expense(db, id=id)


@router.post("/expenses/{id}/pay", response_model=ExpenseOut)
async def pay_expense(id: uuid.UUID, body: ExpensePayPayload, db: DB, _: Admin):
    return await svc.pay_expense(
        db,
        id=id,
        payment_account_id=body.payment_account_id,
        payment_date=body.payment_date,
    )
