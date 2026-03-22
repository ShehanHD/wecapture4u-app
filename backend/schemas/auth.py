from pydantic import BaseModel, EmailStr, field_validator
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

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


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


# --- WebAuthn request bodies ---
class WebAuthnAuthenticateOptionsRequest(BaseModel):
    email: EmailStr


class WebAuthnRegisterVerifyRequest(BaseModel):
    id: str
    rawId: str
    response: dict
    type: str


class WebAuthnAuthenticateVerifyRequest(BaseModel):
    email: EmailStr
    id: str
    rawId: str
    response: dict
    type: str
