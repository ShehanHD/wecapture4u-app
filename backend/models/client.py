import uuid
from sqlalchemy import Column, String, Text, Date, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from models.base import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    tags = Column(ARRAY(Text), nullable=False, server_default="{}")
    birthday = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    portal_user = relationship("User", foreign_keys=[user_id], lazy="select")
    appointments = relationship("Appointment", back_populates="client", lazy="select")
    jobs = relationship("Job", back_populates="client", lazy="select")
    invoices = relationship("Invoice", back_populates="client", lazy="select")
