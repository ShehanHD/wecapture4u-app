import uuid
from sqlalchemy import Column, Text, ForeignKey, DateTime, Date, Enum as SAEnum, JSON
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from models.base import Base


class BookingRequest(Base):
    __tablename__ = "booking_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    preferred_date = Column(Date, nullable=False)
    time_slot = Column(
        SAEnum("morning", "afternoon", "evening", "all_day", name="time_slot", create_type=False),
        nullable=False,
    )
    session_type_id = Column(UUID(as_uuid=True), ForeignKey("session_types.id", ondelete="SET NULL"), nullable=True)
    addons = Column(ARRAY(Text), nullable=False, server_default="{}")
    message = Column(Text, nullable=True)
    status = Column(
        SAEnum("pending", "confirmed", "rejected", name="booking_request_status", create_type=False),
        nullable=False,
        server_default="pending",
    )
    admin_notes = Column(Text, nullable=True)
    session_slots = Column(JSON, nullable=False, server_default="'[]'::jsonb")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    client = relationship("Client", lazy="select")
