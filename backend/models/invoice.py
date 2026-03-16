import uuid
from sqlalchemy import Column, String, Boolean, Numeric, ForeignKey, Date, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from models.base import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="RESTRICT"), nullable=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    # status: 'draft' | 'sent' | 'partially_paid' | 'paid' — enforced by migration enum
    status = Column(String, nullable=False, server_default="draft")
    subtotal = Column(Numeric(10, 2), nullable=False, server_default="0")
    discount = Column(Numeric(10, 2), nullable=False, server_default="0")
    tax = Column(Numeric(10, 2), nullable=False, server_default="0")
    total = Column(Numeric(10, 2), nullable=False, server_default="0")
    deposit_amount = Column(Numeric(10, 2), nullable=False, server_default="0")
    balance_due = Column(Numeric(10, 2), nullable=False, server_default="0")
    requires_review = Column(Boolean, nullable=False, server_default="false")
    due_date = Column(Date, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    client = relationship("Client", back_populates="invoices", lazy="select")
    job = relationship("Job", back_populates="invoices", lazy="select")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan", lazy="select")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    # revenue_account_id FKs to accounts table (003_accounting.sql).
    # No relationship until Plan 8.
    revenue_account_id = Column(UUID(as_uuid=True), nullable=True)
    description = Column(String, nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False, server_default="1")
    unit_price = Column(Numeric(10, 2), nullable=False)
    # amount = quantity × unit_price — computed by service layer, stored for query perf
    amount = Column(Numeric(10, 2), nullable=False, server_default="0")

    invoice = relationship("Invoice", back_populates="items", lazy="select")
