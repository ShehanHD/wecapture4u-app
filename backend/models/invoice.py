import uuid
from sqlalchemy import Column, String, Text, Boolean, Numeric, ForeignKey, Date, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from models.base import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="RESTRICT"), nullable=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    status = Column(SAEnum('draft', 'sent', 'partially_paid', 'paid', name='invoice_status', create_type=False), nullable=False, server_default="draft")
    subtotal = Column(Numeric(10, 2), nullable=False, server_default="0")
    discount = Column(Numeric(10, 2), nullable=False, server_default="0")
    tax = Column(Numeric(10, 2), nullable=False, server_default="0")
    total = Column(Numeric(10, 2), nullable=False, server_default="0")
    balance_due = Column(Numeric(10, 2), nullable=False, server_default="0")
    requires_review = Column(Boolean, nullable=False, server_default="false")
    due_date = Column(Date, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    client = relationship("Client", back_populates="invoices", lazy="select")
    job = relationship("Job", back_populates="invoices", lazy="select")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan", lazy="select")
    payments = relationship(
        "InvoicePayment",
        back_populates="invoice",
        cascade="all, delete-orphan",
        lazy="select",
        order_by="InvoicePayment.paid_at",
    )


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    revenue_account_id = Column(UUID(as_uuid=True), nullable=True)
    description = Column(String, nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False, server_default="1")
    unit_price = Column(Numeric(10, 2), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False, server_default="0")

    invoice = relationship("Invoice", back_populates="items", lazy="select")


class InvoicePayment(Base):
    __tablename__ = "invoice_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    paid_at = Column(Date, nullable=False)
    method = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    invoice = relationship("Invoice", back_populates="payments", lazy="select")
