import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict


AccountType = Literal["asset", "liability", "equity", "revenue", "expense"]


class AccountCreate(BaseModel):
    code: str
    name: str
    type: AccountType


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    archived: Optional[bool] = None


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    type: str
    normal_balance: str
    is_system: bool
    archived: bool
    created_at: datetime
    balance: Optional[Decimal] = None  # populated by service layer from posted journal lines
