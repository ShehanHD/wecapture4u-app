import uuid
from sqlalchemy import Column, String, Text, Boolean, Numeric, ForeignKey, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from models.base import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    session_type_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=False, server_default="{}")
    session_time = Column(String, nullable=True)  # 'morning' | 'afternoon' | 'evening'
    title = Column(String, nullable=False)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    location = Column(String, nullable=True)
    # status: 'pending' | 'confirmed' | 'cancelled' — PostgreSQL enum enforced by migration
    status = Column(SAEnum('pending', 'confirmed', 'cancelled', name='appointment_status', create_type=False), nullable=False, server_default="pending")
    # addons: fixed list ['album', 'thank_you_card', 'enlarged_photos']
    addons = Column(ARRAY(Text), nullable=False, server_default="{}")
    deposit_paid = Column(Boolean, nullable=False, server_default="false")
    deposit_amount = Column(Numeric(10, 2), nullable=False, server_default="0")
    # deposit_account_id FKs to accounts table (created in 003_accounting.sql).
    # No SQLAlchemy relationship until Plan 8 (Accounting).
    deposit_account_id = Column(UUID(as_uuid=True), nullable=True)
    contract_signed = Column(Boolean, nullable=False, server_default="false")
    price = Column(Numeric(10, 2), nullable=False, server_default="0")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    client = relationship("Client", back_populates="appointments", lazy="select")
    # session_types resolved at query time via session_type_ids array (no ORM relationship)
    job = relationship("Job", back_populates="appointment", uselist=False, lazy="select")
