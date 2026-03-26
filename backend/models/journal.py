import uuid
from sqlalchemy import Column, String, Text, Numeric, ForeignKey, Date, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from models.base import Base


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    reference_type = Column(String, nullable=True)
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    status = Column(
        SAEnum('draft', 'posted', 'voided', name='journal_entry_status', create_type=False),
        nullable=False,
        server_default="draft",
    )
    created_by = Column(
        SAEnum('system', 'manual', name='journal_created_by', create_type=False),
        nullable=False,
    )
    void_of = Column(UUID(as_uuid=True), ForeignKey("journal_entries.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    lines = relationship("JournalLine", back_populates="entry", cascade="all, delete-orphan", lazy="select")


class JournalLine(Base):
    __tablename__ = "journal_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entry_id = Column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False)
    debit = Column(Numeric(10, 2), nullable=False, server_default="0")
    credit = Column(Numeric(10, 2), nullable=False, server_default="0")
    description = Column(Text, nullable=True)

    entry = relationship("JournalEntry", back_populates="lines", lazy="select")
    account = relationship("Account", back_populates="journal_lines", lazy="select")
