from pydantic import BaseModel, EmailStr
import uuid
from datetime import datetime


# --- Login ---
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# --- Refresh ---
class RefreshRequest(BaseModel):
    refresh_token: str


# --- Password Reset ---
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# --- Profile (used by dependencies) ---
class CurrentUser(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    full_name: str
    avatar_url: str | None
    is_active: bool


# --- WebAuthn ---
class WebAuthnDeviceCheckResponse(BaseModel):
    has_credential: bool


class WebAuthnCredentialResponse(BaseModel):
    id: uuid.UUID
    device_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
