import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from models.base import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    type = Column(
        SAEnum('asset', 'liability', 'equity', 'revenue', 'expense',
               name='account_type', create_type=False),
        nullable=False,
    )
    normal_balance = Column(
        SAEnum('debit', 'credit', name='normal_balance_type', create_type=False),
        nullable=False,
    )
    is_system = Column(Boolean, nullable=False, server_default="false")
    archived = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # journal_lines relationship added in Task 4 when JournalLine model is defined
    # journal_lines = relationship("JournalLine", back_populates="account", lazy="select")
