# backend/routers/reports.py
from __future__ import annotations
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.auth import require_admin
from services import reports as svc

router = APIRouter(prefix="/api/reports", tags=["reports"])

DB = Annotated[AsyncSession, Depends(get_db)]
Admin = Annotated[object, Depends(require_admin)]


def _csv_response(csv_str: str, filename: str) -> StreamingResponse:
    return StreamingResponse(
        iter([csv_str]),
        media_type="text/csv",
<<<<<<< HEAD
        headers={"Content-Disposition": f"attachment; filename={filename}"},
=======
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
>>>>>>> main
    )


@router.get("/pl")
async def get_pl(
    db: DB,
    _: Admin,
    start_date: date = Query(...),
    end_date: date = Query(...),
    format: str | None = Query(None),
):
    data = await svc.get_pl(db, start_date, end_date)
    if format == "csv":
        return _csv_response(svc.pl_to_csv(data), "pl.csv")
    return data


@router.get("/balance-sheet")
async def get_balance_sheet(
    db: DB,
    _: Admin,
    as_of_date: date = Query(...),
    format: str | None = Query(None),
):
    data = await svc.get_balance_sheet(db, as_of_date)
    if format == "csv":
        return _csv_response(svc.balance_sheet_to_csv(data), "balance_sheet.csv")
    return data


@router.get("/trial-balance")
async def get_trial_balance(
    db: DB,
    _: Admin,
    as_of_date: date = Query(...),
    format: str | None = Query(None),
):
    data = await svc.get_trial_balance(db, as_of_date)
    if format == "csv":
        return _csv_response(svc.trial_balance_to_csv(data), "trial_balance.csv")
    return data


@router.get("/cash-flow")
async def get_cash_flow(
    db: DB,
    _: Admin,
    start_date: date = Query(...),
    end_date: date = Query(...),
    format: str | None = Query(None),
):
    data = await svc.get_cash_flow(db, start_date, end_date)
    if format == "csv":
        return _csv_response(svc.cash_flow_to_csv(data), "cash_flow.csv")
    return data


@router.get("/tax-summary")
async def get_tax_summary(
    db: DB,
    _: Admin,
    start_date: date = Query(...),
    end_date: date = Query(...),
    format: str | None = Query(None),
):
    data = await svc.get_tax_summary(db, start_date, end_date)
    if format == "csv":
        return _csv_response(svc.tax_summary_to_csv(data), "tax_summary.csv")
    return data


@router.get("/ar-aging")
async def get_ar_aging(
    db: DB,
    _: Admin,
    as_of_date: date = Query(...),
    format: str | None = Query(None),
):
    data = await svc.get_ar_aging(db, as_of_date)
    if format == "csv":
        return _csv_response(svc.ar_aging_to_csv(data), "ar_aging.csv")
    return data
