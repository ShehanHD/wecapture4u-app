# backend/schemas/profile.py
from pydantic import BaseModel, EmailStr
import uuid
from datetime import datetime


class ProfileResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    avatar_url: str | None
    role: str

    model_config = {"from_attributes": True}


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    current_password: str | None = None  # required when changing email


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class CredentialResponse(BaseModel):
    credential_id: str
    device_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
