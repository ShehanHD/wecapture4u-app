import uuid
from sqlalchemy import Column, Text, Numeric, ForeignKey, Date, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from models.base import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    expense_account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    payment_status = Column(
        SAEnum('paid', 'payable', name='expense_payment_status', create_type=False),
        nullable=False,
    )
    payment_account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=True)
    receipt_url = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    expense_account = relationship("Account", foreign_keys=[expense_account_id], lazy="select")
    payment_account = relationship("Account", foreign_keys=[payment_account_id], lazy="select")
