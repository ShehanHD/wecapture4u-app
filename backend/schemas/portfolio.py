from __future__ import annotations
import json
from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, field_validator, EmailStr
import re


class HeroPhotoOut(BaseModel):
    id: UUID
    image_url: str
    position: int
    model_config = {"from_attributes": True}


class PositionItem(BaseModel):
    id: UUID
    position: int


class CategoryOut(BaseModel):
    id: UUID
    name: str
    slug: str
    cover_url: str
    position: int
    model_config = {"from_attributes": True}


class PhotoOut(BaseModel):
    id: UUID
    image_url: str
    position: int
    model_config = {"from_attributes": True}


class CategoryWithPhotosOut(CategoryOut):
    photos: list[PhotoOut] = []


class ContactSubmissionCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    message: str

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 200:
            raise ValueError("name must be 1–200 characters")
        return v

    @field_validator("phone")
    @classmethod
    def phone_length(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if len(v) > 30:
            raise ValueError("phone must be 30 characters or fewer")
        return v or None

    @field_validator("message")
    @classmethod
    def message_length(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 5000:
            raise ValueError("message must be 1–5000 characters")
        return v


class ContactSubmissionOut(BaseModel):
    id: UUID
    name: str
    email: str
    phone: Optional[str] = None
    message: str
    created_at: datetime
    model_config = {"from_attributes": True}


DEFAULT_STATS = [
    {"value": "500", "accent": "+", "label": "Sessions completed"},
    {"value": "10", "accent": "+", "label": "Years of experience"},
    {"value": "5", "accent": " ★", "label": "Average client rating"},
    {"value": "48", "accent": "h", "label": "Photo delivery time"},
]


class StatItem(BaseModel):
    value: str
    accent: str
    label: str


class PublicSettingsOut(BaseModel):
    tagline: Optional[str] = None
    bio: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None
    contact_headline: Optional[str] = None
    admin_name: Optional[str] = None
    admin_avatar_url: Optional[str] = None
    stats: list[StatItem] = []


class AboutSettingsOut(BaseModel):
    tagline: Optional[str] = None
    bio: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None
    contact_headline: Optional[str] = None
    contact_email: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    og_image_url: Optional[str] = None
    stats: list[StatItem] = []


class AboutSettingsUpdate(BaseModel):
    tagline: Optional[str] = None
    bio: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None
    contact_headline: Optional[str] = None
    contact_email: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    stats: Optional[list[StatItem]] = None

    @field_validator("contact_email")
    @classmethod
    def valid_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if "@" not in v or len(v) > 254:
            raise ValueError("contact_email must be a valid email address.")
        return v

    @field_validator("instagram_url", "facebook_url")
    @classmethod
    def valid_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not re.match(r'^https?://', v):
            raise ValueError("must be a valid HTTP/HTTPS URL.")
        return v
