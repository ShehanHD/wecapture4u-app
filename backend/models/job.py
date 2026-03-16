import uuid
from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey, Date, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from models.base import Base


class JobStage(Base):
    __tablename__ = "job_stages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False)  # hex, e.g. '#f59e0b'
    position = Column(Integer, nullable=False)
    is_terminal = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    jobs = relationship("Job", back_populates="stage", lazy="select")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("job_stages.id", ondelete="RESTRICT"), nullable=False)
    shoot_date = Column(Date, nullable=True)
    delivery_deadline = Column(Date, nullable=True)
    # delivery_url added by 004_client_portal.sql migration
    delivery_url = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    client = relationship("Client", back_populates="jobs", lazy="select")
    appointment = relationship("Appointment", back_populates="job", lazy="select")
    stage = relationship("JobStage", back_populates="jobs", lazy="select")
    invoices = relationship("Invoice", back_populates="job", lazy="select")
