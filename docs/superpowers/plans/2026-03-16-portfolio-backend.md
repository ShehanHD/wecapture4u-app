# weCapture4U — Portfolio Backend

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the portfolio backend — migration 005, SQLAlchemy models, Pydantic schemas, upload pipeline (Pillow → Supabase Storage), and all portfolio + contact FastAPI endpoints.

**Architecture:** All photo uploads go through a shared `upload_to_storage()` helper that validates MIME type, runs Pillow resize/WebP, uploads to Supabase Storage, and returns the public URL. Slug generation is a pure function. Multi-file uploads are all-or-nothing. Rate limiting on `POST /api/contact` uses `slowapi`.

**Depends on:** Plans 1–4 (Foundation, Auth, Admin backend models — `app_settings` table exists).

**Tech Stack:** FastAPI + SQLAlchemy 2.0 async, Pydantic v2, Pillow, `supabase-py`, `slowapi`.

---

## File Structure

```
migrations/
  005_portfolio.sql         # hero_photos, portfolio_categories, portfolio_photos, contact_submissions; app_settings columns
backend/
  models/
    portfolio.py            # HeroPhoto, PortfolioCategory, PortfolioPhoto, ContactSubmission
  schemas/
    portfolio.py            # Pydantic v2 schemas
  services/
    storage.py              # Shared Supabase Storage upload helper
    portfolio.py            # Business logic — slug generation, photo upload pipeline, CRUD
  routers/
    portfolio.py            # All public + admin portfolio endpoints + contact endpoints
    settings.py             # PATCH /api/settings/about + GET /api/settings/public (extended)
  main.py                   # Register portfolio and settings routers
  services/__tests__/
    test_slug.py            # Slug generation unit tests
    test_storage.py         # Storage path extraction unit tests
```

---

## Chunk 1: Migration + Models + Schemas

### Task 1: Migration 005_portfolio.sql

**Files:**
- Create: `migrations/005_portfolio.sql`

- [ ] **Step 1: Write the migration**

```sql
-- migrations/005_portfolio.sql
-- Portfolio: hero_photos, portfolio_categories, portfolio_photos, contact_submissions
-- Extends app_settings with portfolio/about columns
-- Depends on: 001_initial_schema.sql (app_settings table)

-- ─── HERO PHOTOS ──────────────────────────────────────────────────────────────

CREATE TABLE hero_photos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url   TEXT NOT NULL,
    position    INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON hero_photos (position);

-- ─── PORTFOLIO CATEGORIES ─────────────────────────────────────────────────────

CREATE TABLE portfolio_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    cover_url   TEXT NOT NULL,
    position    INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON portfolio_categories (position);

-- ─── PORTFOLIO PHOTOS ─────────────────────────────────────────────────────────

CREATE TABLE portfolio_photos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES portfolio_categories(id) ON DELETE RESTRICT,
    image_url   TEXT NOT NULL,
    position    INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON portfolio_photos (category_id, position);

-- ─── CONTACT SUBMISSIONS ──────────────────────────────────────────────────────

CREATE TABLE contact_submissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    message     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON contact_submissions (created_at DESC);

-- ─── APP SETTINGS EXTENSIONS ──────────────────────────────────────────────────

ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS tagline          TEXT,
    ADD COLUMN IF NOT EXISTS bio              TEXT,
    ADD COLUMN IF NOT EXISTS instagram_url   TEXT,
    ADD COLUMN IF NOT EXISTS facebook_url    TEXT,
    ADD COLUMN IF NOT EXISTS contact_headline TEXT,
    ADD COLUMN IF NOT EXISTS contact_email   TEXT;

-- Ensure the app_settings row exists
INSERT INTO app_settings (tax_enabled, pdf_invoices_enabled)
    VALUES (FALSE, FALSE)
    ON CONFLICT DO NOTHING;
```

---

### Task 2: Portfolio models + schemas + slug unit tests

**Files:**
- Create: `backend/models/portfolio.py`
- Create: `backend/schemas/portfolio.py`
- Create: `backend/services/__tests__/test_slug.py`

- [ ] **Step 1: Write failing slug tests**

```python
# backend/services/__tests__/test_slug.py
import pytest
from backend.services.portfolio import generate_slug


def test_simple_name():
    assert generate_slug("Weddings") == "weddings"


def test_spaces_to_hyphens():
    assert generate_slug("Wedding Portraits") == "wedding-portraits"


def test_special_chars_removed():
    assert generate_slug("Weddings & Portraits!") == "weddings-portraits"


def test_accents_transliterated():
    assert generate_slug("Événements") == "evenements"


def test_consecutive_hyphens_collapsed():
    assert generate_slug("A  --  B") == "a-b"


def test_truncate_to_80():
    long_name = "a" * 100
    result = generate_slug(long_name)
    assert len(result) <= 80


def test_all_non_latin_raises():
    with pytest.raises(ValueError, match="valid URL slug"):
        generate_slug("中文")


def test_empty_string_raises():
    with pytest.raises(ValueError, match="valid URL slug"):
        generate_slug("")
```

- [ ] **Step 2: Run — expect import errors**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/services/__tests__/test_slug.py -v 2>&1 | head -20
```

- [ ] **Step 3: Write models**

```python
# backend/models/portfolio.py
from __future__ import annotations
import uuid
from sqlalchemy import Text, Integer
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from backend.models.base import Base


class HeroPhoto(Base):
    __tablename__ = "hero_photos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at = mapped_column(server_default=func.now(), nullable=False)


class PortfolioCategory(Base):
    __tablename__ = "portfolio_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    cover_url: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at = mapped_column(server_default=func.now(), nullable=False)

    photos: Mapped[list["PortfolioPhoto"]] = relationship(
        "PortfolioPhoto", back_populates="category", lazy="select"
    )


class PortfolioPhoto(Base):
    __tablename__ = "portfolio_photos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at = mapped_column(server_default=func.now(), nullable=False)

    category: Mapped["PortfolioCategory"] = relationship(
        "PortfolioCategory", back_populates="photos"
    )


class ContactSubmission(Base):
    __tablename__ = "contact_submissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at = mapped_column(server_default=func.now(), nullable=False)
```

- [ ] **Step 4: Write Pydantic schemas**

```python
# backend/schemas/portfolio.py
from __future__ import annotations
from typing import Optional
from uuid import UUID
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


class CategoryWithPhotosOut(CategoryOut):
    photos: list["PhotoOut"] = []


class PhotoOut(BaseModel):
    id: UUID
    image_url: str
    position: int
    model_config = {"from_attributes": True}


class ContactSubmissionCreate(BaseModel):
    name: str
    email: EmailStr
    message: str

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 200:
            raise ValueError("name must be 1–200 characters")
        return v

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
    message: str
    created_at: object
    model_config = {"from_attributes": True}


class PublicSettingsOut(BaseModel):
    tagline: Optional[str]
    bio: Optional[str]
    instagram_url: Optional[str]
    facebook_url: Optional[str]
    contact_headline: Optional[str]
    admin_name: Optional[str]
    admin_avatar_url: Optional[str]


class AboutSettingsOut(BaseModel):
    tagline: Optional[str]
    bio: Optional[str]
    instagram_url: Optional[str]
    facebook_url: Optional[str]
    contact_headline: Optional[str]
    contact_email: Optional[str]


class AboutSettingsUpdate(BaseModel):
    tagline: Optional[str] = None
    bio: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None
    contact_headline: Optional[str] = None
    contact_email: Optional[str] = None

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
```

- [ ] **Step 5: Write slug generation in portfolio service (partial)**

```python
# backend/services/portfolio.py
"""
Portfolio service: slug generation, photo upload pipeline, CRUD.
Storage operations use supabase_py client from backend.storage.
"""
from __future__ import annotations
import re
import unicodedata
from fastapi import HTTPException


def generate_slug(name: str) -> str:
    """
    Slug algorithm: lowercase → strip/transliterate accents → replace spaces and
    non-alphanumeric chars with hyphens → collapse consecutive hyphens →
    strip leading/trailing hyphens → truncate to 80 chars.
    """
    # Normalize unicode (NFKD) to decompose accented chars
    normalized = unicodedata.normalize("NFKD", name)
    # Keep only ASCII characters
    ascii_str = normalized.encode("ascii", "ignore").decode("ascii")
    # Lowercase
    lowered = ascii_str.lower()
    # Replace non-alphanumeric (except hyphens) with hyphens
    slug = re.sub(r"[^a-z0-9]+", "-", lowered)
    # Collapse consecutive hyphens
    slug = re.sub(r"-+", "-", slug)
    # Strip leading/trailing hyphens
    slug = slug.strip("-")
    # Truncate
    slug = slug[:80]
    if not slug:
        raise ValueError(
            "Category name must produce a valid URL slug (use letters, numbers, or hyphens)."
        )
    return slug
```

- [ ] **Step 6: Run slug tests — expect PASS**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/services/__tests__/test_slug.py -v
```

Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add migrations/005_portfolio.sql backend/models/portfolio.py backend/schemas/portfolio.py backend/services/portfolio.py backend/services/__tests__/test_slug.py
git commit -m "feat: add portfolio migration, models, schemas, slug generation"
```

---

## Chunk 2: Storage Helper + Service + Routers

### Task 3: Supabase Storage upload helper + storage path extraction tests

**Files:**
- Create: `backend/services/storage.py`
- Create: `backend/services/__tests__/test_storage.py`

- [ ] **Step 1: Write failing storage path tests**

```python
# backend/services/__tests__/test_storage.py
from backend.services.storage import extract_storage_key


def test_extract_key_from_hero_url():
    url = "https://xxx.supabase.co/storage/v1/object/public/portfolio/hero/abc.webp"
    assert extract_storage_key(url) == "hero/abc.webp"


def test_extract_key_from_cover_url():
    url = "https://xxx.supabase.co/storage/v1/object/public/portfolio/covers/uuid.webp"
    assert extract_storage_key(url) == "covers/uuid.webp"


def test_extract_key_from_category_gallery():
    url = "https://xxx.supabase.co/storage/v1/object/public/portfolio/weddings/photo.webp"
    assert extract_storage_key(url) == "weddings/photo.webp"


def test_extract_key_invalid_url_returns_none():
    assert extract_storage_key("https://example.com/not-a-storage-url") is None
```

- [ ] **Step 2: Run — expect import errors**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/services/__tests__/test_storage.py -v 2>&1 | head -20
```

- [ ] **Step 3: Write storage service**

```python
# backend/services/storage.py
"""
Shared Supabase Storage helpers for portfolio and avatar uploads.
"""
from __future__ import annotations
import io
import os
import uuid
from typing import Optional

from fastapi import HTTPException, UploadFile
from PIL import Image

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
PORTFOLIO_BUCKET = "portfolio"
STORAGE_PREFIX = "/storage/v1/object/public/portfolio/"

_supabase_client = None


def _get_supabase():
    global _supabase_client
    if _supabase_client is None:
        from supabase import create_client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_client


def extract_storage_key(url: str) -> Optional[str]:
    """Extract Storage-relative key from a full Supabase public URL.
    E.g. '.../object/public/portfolio/hero/abc.webp' → 'hero/abc.webp'
    """
    if STORAGE_PREFIX not in url:
        return None
    return url.split(STORAGE_PREFIX, 1)[1]


async def validate_image_file(file: UploadFile, max_size_mb: int = 10) -> bytes:
    """Read and validate uploaded image. Returns raw bytes."""
    if file.content_type not in (
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "image/heic", "image/heif", "image/tiff", "image/bmp",
    ):
        raise HTTPException(422, "Only image files are accepted.")

    content = await file.read()
    if len(content) > max_size_mb * 1024 * 1024:
        raise HTTPException(413, f"File too large. Maximum size is {max_size_mb}MB.")
    return content


def process_image(
    content: bytes,
    *,
    max_long_side: int = 1920,
    force_size: tuple[int, int] | None = None,
) -> bytes:
    """
    Resize and convert to WebP.
    - max_long_side: resize so longest side ≤ max_long_side (preserve aspect ratio).
    - force_size: if set (width, height), centre-crop to exact dimensions instead.
    """
    img = Image.open(io.BytesIO(content)).convert("RGB")

    if force_size:
        target_w, target_h = force_size
        # Centre-crop
        src_ratio = img.width / img.height
        tgt_ratio = target_w / target_h
        if src_ratio > tgt_ratio:
            new_h = img.height
            new_w = int(new_h * tgt_ratio)
        else:
            new_w = img.width
            new_h = int(new_w / tgt_ratio)
        left = (img.width - new_w) // 2
        top = (img.height - new_h) // 2
        img = img.crop((left, top, left + new_w, top + new_h))
        img = img.resize((target_w, target_h), Image.LANCZOS)
    else:
        if img.width > max_long_side or img.height > max_long_side:
            img.thumbnail((max_long_side, max_long_side), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=85)
    return buf.getvalue()


def upload_to_storage(
    path: str,
    content: bytes,
    *,
    content_type: str = "image/webp",
) -> str:
    """
    Upload bytes to Supabase Storage at the given path.
    Returns the full public URL.
    Raises HTTPException 503 on Storage failure.
    """
    try:
        sb = _get_supabase()
        sb.storage.from_(PORTFOLIO_BUCKET).upload(
            path,
            content,
            {"content-type": content_type, "upsert": "true"},
        )
        return f"{SUPABASE_URL}{STORAGE_PREFIX}{path}"
    except Exception as e:
        raise HTTPException(503, "Photo storage is unavailable. Please contact the administrator.")


def delete_from_storage(url: str) -> None:
    """Delete a file from Storage by URL. Logs errors; does not raise."""
    key = extract_storage_key(url)
    if not key:
        return
    try:
        sb = _get_supabase()
        sb.storage.from_(PORTFOLIO_BUCKET).remove([key])
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Storage delete failed for key %s: %s", key, e)
```

- [ ] **Step 4: Run storage path tests — PASS**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/services/__tests__/test_storage.py -v
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/storage.py backend/services/__tests__/test_storage.py
git commit -m "feat: add Supabase Storage upload helper and path extraction utility"
```

---

### Task 4: Portfolio service (full) + routers

**Files:**
- Modify: `backend/services/portfolio.py` — add all CRUD functions
- Create: `backend/routers/portfolio.py`
- Create: `backend/routers/settings.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write failing integration tests**

```python
# backend/routers/__tests__/test_portfolio_router.py
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_public_hero_list_no_auth(client: AsyncClient):
    response = await client.get("/api/portfolio/hero")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_public_categories_no_auth(client: AsyncClient):
    response = await client.get("/api/portfolio/categories")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_public_settings_no_auth(client: AsyncClient):
    response = await client.get("/api/settings/public")
    assert response.status_code == 200
    data = response.json()
    assert "tagline" in data
    assert "admin_name" in data


@pytest.mark.asyncio
async def test_contact_submit(client: AsyncClient):
    response = await client.post("/api/contact", json={
        "name": "Test User",
        "email": "test@example.com",
        "message": "Hello from test",
    })
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_upload_hero_requires_admin(client: AsyncClient):
    response = await client.post("/api/portfolio/hero", files={"photo": ("test.jpg", b"fake", "image/jpeg")})
    assert response.status_code == 401
```

- [ ] **Step 2: Run — expect 404s (routers not registered)**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/routers/__tests__/test_portfolio_router.py -v 2>&1 | head -20
```

- [ ] **Step 3: Extend portfolio service with full CRUD**

Append to `backend/services/portfolio.py`:

```python
# (continued from Task 2 slug function)
import uuid as _uuid
from sqlalchemy import select, func as sqlfunc, update as sqlupt
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.portfolio import HeroPhoto, PortfolioCategory, PortfolioPhoto, ContactSubmission
from backend.services.storage import (
    validate_image_file, process_image, upload_to_storage, delete_from_storage
)
from fastapi import UploadFile


MAX_HERO_PHOTOS = 20


async def _next_position(db: AsyncSession, model, **filters) -> int:
    q = select(sqlfunc.coalesce(sqlfunc.max(model.position), 0) + 1)
    for col, val in filters.items():
        q = q.where(getattr(model, col) == val)
    result = await db.execute(q)
    return result.scalar_one()


async def list_hero_photos(db: AsyncSession) -> list[HeroPhoto]:
    result = await db.execute(select(HeroPhoto).order_by(HeroPhoto.position))
    return list(result.scalars().all())


async def upload_hero_photo(db: AsyncSession, file: UploadFile) -> HeroPhoto:
    count = (await db.execute(select(sqlfunc.count()).select_from(HeroPhoto))).scalar_one()
    if count >= MAX_HERO_PHOTOS:
        raise HTTPException(409, "Maximum of 20 hero photos reached.")

    content = await validate_image_file(file)
    processed = process_image(content, max_long_side=1920)
    key = f"hero/{_uuid.uuid4()}.webp"
    url = upload_to_storage(key, processed)

    position = await _next_position(db, HeroPhoto)
    photo = HeroPhoto(image_url=url, position=position)
    db.add(photo)
    await db.flush()
    return photo


async def reorder_hero_photos(db: AsyncSession, items: list[dict]) -> None:
    """items = [{"id": uuid, "position": int}]. Validates ID set and position sequence."""
    existing = (await db.execute(select(HeroPhoto))).scalars().all()
    existing_ids = {p.id for p in existing}
    submitted_ids = {item["id"] for item in items}
    if existing_ids != submitted_ids:
        raise HTTPException(422, "Position array must cover all existing items.")
    positions = sorted(item["position"] for item in items)
    if positions != list(range(1, len(positions) + 1)):
        raise HTTPException(422, "Position array must cover all existing items.")
    for item in items:
        await db.execute(
            sqlupt(HeroPhoto).where(HeroPhoto.id == item["id"]).values(position=item["position"])
        )
    await db.flush()


async def delete_hero_photo(db: AsyncSession, photo_id: _uuid.UUID) -> None:
    count = (await db.execute(select(sqlfunc.count()).select_from(HeroPhoto))).scalar_one()
    if count <= 1:
        raise HTTPException(409, "At least one hero photo is required.")
    result = await db.execute(select(HeroPhoto).where(HeroPhoto.id == photo_id))
    photo = result.scalar_one_or_none()
    if photo is None:
        raise HTTPException(404, "Photo not found")
    old_url = photo.image_url
    await db.delete(photo)
    # Renumber remaining
    remaining = (await db.execute(select(HeroPhoto).order_by(HeroPhoto.position))).scalars().all()
    for idx, p in enumerate(remaining, start=1):
        p.position = idx
    await db.flush()
    delete_from_storage(old_url)


async def list_categories(db: AsyncSession) -> list[PortfolioCategory]:
    result = await db.execute(select(PortfolioCategory).order_by(PortfolioCategory.position))
    return list(result.scalars().all())


async def get_category_by_slug(db: AsyncSession, slug: str) -> PortfolioCategory:
    result = await db.execute(
        select(PortfolioCategory).where(PortfolioCategory.slug == slug)
    )
    cat = result.scalar_one_or_none()
    if cat is None:
        raise HTTPException(404, "Category not found.")
    return cat


async def create_category(
    db: AsyncSession, name: str, cover_file: UploadFile
) -> PortfolioCategory:
    slug = generate_slug(name)
    # Check slug uniqueness
    existing = (await db.execute(
        select(PortfolioCategory).where(PortfolioCategory.slug == slug)
    )).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(409, "A category with this slug already exists.")

    content = await validate_image_file(cover_file)
    processed = process_image(content, max_long_side=1920)
    key = f"covers/{_uuid.uuid4()}.webp"
    cover_url = upload_to_storage(key, processed)

    position = await _next_position(db, PortfolioCategory)
    cat = PortfolioCategory(name=name, slug=slug, cover_url=cover_url, position=position)
    db.add(cat)
    await db.flush()
    return cat


async def update_category(
    db: AsyncSession, category_id: _uuid.UUID,
    name: str | None = None, cover_file: UploadFile | None = None,
) -> PortfolioCategory:
    if name is None and cover_file is None:
        raise HTTPException(422, "At least one of 'name' or 'cover' must be provided.")
    result = await db.execute(select(PortfolioCategory).where(PortfolioCategory.id == category_id))
    cat = result.scalar_one_or_none()
    if cat is None:
        raise HTTPException(404, "Category not found")
    if name is not None:
        cat.name = name
    if cover_file is not None:
        old_url = cat.cover_url
        content = await validate_image_file(cover_file)
        processed = process_image(content, max_long_side=1920)
        key = f"covers/{_uuid.uuid4()}.webp"
        new_url = upload_to_storage(key, processed)
        cat.cover_url = new_url
        await db.flush()
        delete_from_storage(old_url)
    await db.flush()
    return cat


async def delete_category(db: AsyncSession, category_id: _uuid.UUID) -> None:
    result = await db.execute(
        select(PortfolioCategory).where(PortfolioCategory.id == category_id)
    )
    cat = result.scalar_one_or_none()
    if cat is None:
        raise HTTPException(404, "Category not found")
    photo_count = (await db.execute(
        select(sqlfunc.count()).select_from(PortfolioPhoto).where(PortfolioPhoto.category_id == category_id)
    )).scalar_one()
    if photo_count > 0:
        raise HTTPException(409, "Remove all photos from this category first.")
    old_url = cat.cover_url
    await db.delete(cat)
    await db.flush()
    delete_from_storage(old_url)


async def upload_photos(
    db: AsyncSession, category_id: _uuid.UUID, files: list[UploadFile]
) -> list[PortfolioPhoto]:
    if len(files) > 20:
        raise HTTPException(422, "Maximum 20 files per upload.")
    result = await db.execute(
        select(PortfolioCategory).where(PortfolioCategory.id == category_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(404, "Category not found.")

    # Validate all files first (all-or-nothing)
    raw_files: list[bytes] = []
    for f in files:
        content = await validate_image_file(f)
        raw_files.append(content)

    # Upload all
    urls: list[str] = []
    uploaded_keys: list[str] = []
    cat_result = await db.execute(select(PortfolioCategory).where(PortfolioCategory.id == category_id))
    cat = cat_result.scalar_one()
    for content in raw_files:
        processed = process_image(content, max_long_side=1920)
        key = f"{cat.slug}/{_uuid.uuid4()}.webp"
        try:
            url = upload_to_storage(key, processed)
            urls.append(url)
            uploaded_keys.append(key)
        except HTTPException:
            # Rollback already-uploaded files
            for k in uploaded_keys:
                from backend.services.storage import delete_from_storage as _del
                _del(f"{SUPABASE_URL}{STORAGE_PREFIX}{k}")
            raise HTTPException(503, "Upload failed. Please try again.")

    # Acquire row lock and insert all DB rows atomically
    from sqlalchemy import text
    await db.execute(
        text("SELECT id FROM portfolio_categories WHERE id = :cid FOR UPDATE"),
        {"cid": str(category_id)},
    )
    max_pos = (await db.execute(
        select(sqlfunc.coalesce(sqlfunc.max(PortfolioPhoto.position), 0))
        .where(PortfolioPhoto.category_id == category_id)
    )).scalar_one()

    photos = []
    for i, url in enumerate(urls):
        p = PortfolioPhoto(category_id=category_id, image_url=url, position=max_pos + i + 1)
        db.add(p)
        photos.append(p)
    await db.flush()
    return photos


async def delete_photo(db: AsyncSession, photo_id: _uuid.UUID) -> None:
    result = await db.execute(select(PortfolioPhoto).where(PortfolioPhoto.id == photo_id))
    photo = result.scalar_one_or_none()
    if photo is None:
        raise HTTPException(404, "Photo not found")
    old_url = photo.image_url
    category_id = photo.category_id
    await db.delete(photo)
    # Renumber remaining in same category
    remaining = (await db.execute(
        select(PortfolioPhoto)
        .where(PortfolioPhoto.category_id == category_id)
        .order_by(PortfolioPhoto.position)
    )).scalars().all()
    for idx, p in enumerate(remaining, start=1):
        p.position = idx
    await db.flush()
    delete_from_storage(old_url)


async def reorder_photos(
    db: AsyncSession, category_id: _uuid.UUID, items: list[dict]
) -> None:
    existing = (await db.execute(
        select(PortfolioPhoto).where(PortfolioPhoto.category_id == category_id)
    )).scalars().all()
    existing_ids = {p.id for p in existing}
    submitted_ids = {item["id"] for item in items}
    if existing_ids != submitted_ids:
        raise HTTPException(422, "Position array must cover all existing items.")
    positions = sorted(item["position"] for item in items)
    if positions != list(range(1, len(positions) + 1)):
        raise HTTPException(422, "Position array must cover all existing items.")
    for item in items:
        await db.execute(
            sqlupt(PortfolioPhoto).where(PortfolioPhoto.id == item["id"]).values(position=item["position"])
        )
    await db.flush()
```

- [ ] **Step 4: Write portfolio router**

```python
# backend/routers/portfolio.py
from __future__ import annotations
from typing import Annotated, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, UploadFile, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.auth import get_current_admin
from backend.models.portfolio import HeroPhoto, PortfolioCategory, PortfolioPhoto, ContactSubmission
from backend.schemas.portfolio import (
    HeroPhotoOut, CategoryOut, CategoryWithPhotosOut, PhotoOut,
    PositionItem, ContactSubmissionCreate, ContactSubmissionOut,
    PublicSettingsOut, AboutSettingsOut, AboutSettingsUpdate,
)
import backend.services.portfolio as portfolio_svc
import resend
import os

router = APIRouter(prefix="/api", tags=["portfolio"])
DbDep = Annotated[AsyncSession, Depends(get_db)]
AdminDep = Annotated[object, Depends(get_current_admin)]

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")

# ─── PUBLIC ENDPOINTS ─────────────────────────────────────────────────────────

@router.get("/portfolio/hero", response_model=list[HeroPhotoOut])
async def list_hero(db: DbDep):
    return await portfolio_svc.list_hero_photos(db)


@router.get("/portfolio/categories", response_model=list[CategoryOut])
async def list_categories_route(db: DbDep):
    return await portfolio_svc.list_categories(db)


@router.get("/portfolio/categories/{slug}", response_model=CategoryWithPhotosOut)
async def get_category(db: DbDep, slug: str):
    cat = await portfolio_svc.get_category_by_slug(db, slug)
    photos_result = await db.execute(
        select(PortfolioPhoto)
        .where(PortfolioPhoto.category_id == cat.id)
        .order_by(PortfolioPhoto.position)
    )
    return CategoryWithPhotosOut(
        id=cat.id, name=cat.name, slug=cat.slug,
        cover_url=cat.cover_url, position=cat.position,
        photos=[PhotoOut(id=p.id, image_url=p.image_url, position=p.position)
                for p in photos_result.scalars().all()],
    )


@router.get("/settings/public", response_model=PublicSettingsOut)
async def public_settings(db: DbDep):
    from backend.models.admin import AppSettings
    from backend.models.auth import User
    settings_result = await db.execute(select(AppSettings))
    settings = settings_result.scalar_one_or_none()
    admin_result = await db.execute(
        select(User).where(User.role == "admin").order_by(User.created_at.asc()).limit(1)
    )
    admin = admin_result.scalar_one_or_none()
    return PublicSettingsOut(
        tagline=settings.tagline if settings else None,
        bio=settings.bio if settings else None,
        instagram_url=settings.instagram_url if settings else None,
        facebook_url=settings.facebook_url if settings else None,
        contact_headline=settings.contact_headline if settings else None,
        admin_name=admin.full_name if admin else None,
        admin_avatar_url=admin.avatar_url if admin else None,
    )


@router.post("/contact", status_code=201)
async def submit_contact(db: DbDep, data: ContactSubmissionCreate):
    sub = ContactSubmission(name=data.name, email=data.email, message=data.message)
    db.add(sub)
    await db.flush()
    await db.commit()
    # Send email notification
    try:
        from backend.models.admin import AppSettings
        from backend.models.auth import User
        settings_result = await db.execute(select(AppSettings))
        settings = settings_result.scalar_one_or_none()
        admin_result = await db.execute(
            select(User).where(User.role == "admin").order_by(User.created_at.asc()).limit(1)
        )
        admin = admin_result.scalar_one_or_none()
        recipient = (settings.contact_email if settings and settings.contact_email else None) \
            or (admin.email if admin else None)
        if recipient:
            resend.api_key = RESEND_API_KEY
            resend.Emails.send({
                "from": "no-reply@wecapture4u.com",
                "to": recipient,
                "subject": f"New contact: {data.name}",
                "html": f"<p><strong>From:</strong> {data.name} ({data.email})</p><p>{data.message}</p>",
            })
    except Exception:
        pass
    return {"id": str(sub.id)}


# ─── ADMIN ENDPOINTS ──────────────────────────────────────────────────────────

@router.post("/portfolio/hero", response_model=HeroPhotoOut, status_code=201)
async def upload_hero(db: DbDep, admin: AdminDep, photo: UploadFile = File(...)):
    result = await portfolio_svc.upload_hero_photo(db, photo)
    await db.commit()
    return result


@router.patch("/portfolio/hero/positions")
async def reorder_hero(db: DbDep, admin: AdminDep, items: list[PositionItem]):
    await portfolio_svc.reorder_hero_photos(db, [{"id": i.id, "position": i.position} for i in items])
    await db.commit()
    return {"ok": True}


@router.delete("/portfolio/hero/{photo_id}", status_code=204)
async def delete_hero(db: DbDep, admin: AdminDep, photo_id: UUID):
    await portfolio_svc.delete_hero_photo(db, photo_id)
    await db.commit()


@router.post("/portfolio/categories", response_model=CategoryOut, status_code=201)
async def create_category_route(
    db: DbDep, admin: AdminDep,
    name: str = Form(...),
    cover: UploadFile = File(...),
):
    cat = await portfolio_svc.create_category(db, name, cover)
    await db.commit()
    return cat


@router.patch("/portfolio/categories/positions")
async def reorder_categories(db: DbDep, admin: AdminDep, items: list[PositionItem]):
    existing = (await db.execute(select(PortfolioCategory))).scalars().all()
    existing_ids = {c.id for c in existing}
    submitted_ids = {i.id for i in items}
    if existing_ids != submitted_ids:
        from fastapi import HTTPException
        raise HTTPException(422, "Position array must cover all existing items.")
    from sqlalchemy import update as sqlupt
    for item in items:
        await db.execute(
            sqlupt(PortfolioCategory).where(PortfolioCategory.id == item.id).values(position=item.position)
        )
    await db.commit()
    return {"ok": True}


@router.patch("/portfolio/categories/{category_id}", response_model=CategoryOut)
async def update_category_route(
    db: DbDep, admin: AdminDep, category_id: UUID,
    name: Optional[str] = Form(None),
    cover: Optional[UploadFile] = File(None),
):
    cat = await portfolio_svc.update_category(db, category_id, name=name, cover_file=cover)
    await db.commit()
    return cat


@router.delete("/portfolio/categories/{category_id}", status_code=204)
async def delete_category_route(db: DbDep, admin: AdminDep, category_id: UUID):
    await portfolio_svc.delete_category(db, category_id)
    await db.commit()


@router.post("/portfolio/categories/{category_id}/photos", status_code=201)
async def upload_photos_route(
    db: DbDep, admin: AdminDep, category_id: UUID,
    photos: list[UploadFile] = File(...),
):
    result = await portfolio_svc.upload_photos(db, category_id, photos)
    await db.commit()
    return [PhotoOut(id=p.id, image_url=p.image_url, position=p.position) for p in result]


@router.patch("/portfolio/categories/{category_id}/photos/positions")
async def reorder_photos_route(
    db: DbDep, admin: AdminDep, category_id: UUID, items: list[PositionItem]
):
    await portfolio_svc.reorder_photos(db, category_id, [{"id": i.id, "position": i.position} for i in items])
    await db.commit()
    return {"ok": True}


@router.delete("/portfolio/photos/{photo_id}", status_code=204)
async def delete_photo_route(db: DbDep, admin: AdminDep, photo_id: UUID):
    await portfolio_svc.delete_photo(db, photo_id)
    await db.commit()


@router.get("/contact/submissions")
async def list_contact_submissions(
    db: DbDep, admin: AdminDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    q = select(ContactSubmission).order_by(ContactSubmission.created_at.desc()) \
        .offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    items = result.scalars().all()
    total_result = await db.execute(
        select(__import__('sqlalchemy', fromlist=['func']).func.count()).select_from(ContactSubmission)
    )
    return {
        "items": [{"id": str(s.id), "name": s.name, "email": s.email, "message": s.message, "created_at": s.created_at.isoformat()} for s in items],
        "total": total_result.scalar_one(),
        "page": page,
        "page_size": page_size,
    }
```

- [ ] **Step 5: Write settings router**

```python
# backend/routers/settings.py  (partial — about/public settings only; full settings handled in Plan 3)
from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.auth import get_current_admin
from backend.models.admin import AppSettings
from backend.schemas.portfolio import AboutSettingsOut, AboutSettingsUpdate

router = APIRouter(prefix="/api", tags=["settings"])
DbDep = Annotated[AsyncSession, Depends(get_db)]
AdminDep = Annotated[object, Depends(get_current_admin)]


@router.get("/settings/about", response_model=AboutSettingsOut)
async def get_about_settings(db: DbDep, admin: AdminDep):
    result = await db.execute(select(AppSettings))
    settings = result.scalar_one_or_none()
    if settings is None:
        return AboutSettingsOut(tagline=None, bio=None, instagram_url=None,
                                facebook_url=None, contact_headline=None, contact_email=None)
    return AboutSettingsOut(
        tagline=settings.tagline,
        bio=settings.bio,
        instagram_url=settings.instagram_url,
        facebook_url=settings.facebook_url,
        contact_headline=settings.contact_headline,
        contact_email=settings.contact_email,
    )


@router.patch("/settings/about", response_model=AboutSettingsOut)
async def update_about_settings(db: DbDep, admin: AdminDep, data: AboutSettingsUpdate):
    result = await db.execute(select(AppSettings))
    settings = result.scalar_one_or_none()
    if settings is None:
        from fastapi import HTTPException
        raise HTTPException(500, "App settings not initialized. Run migrations.")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)
    await db.commit()
    return await get_about_settings(db, admin)
```

- [ ] **Step 6: Register routers in main.py**

```python
from backend.routers.portfolio import router as portfolio_router
from backend.routers.settings import router as settings_router
app.include_router(portfolio_router)
app.include_router(settings_router)
```

- [ ] **Step 7: Run integration tests**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/routers/__tests__/test_portfolio_router.py -v
```

Expected: All PASS.

- [ ] **Step 8: Run full backend test suite**

```bash
cd /Users/don/Desktop/weCapture4U-app
python -m pytest backend/ -v
```

Expected: All PASS.

- [ ] **Step 9: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/services/portfolio.py backend/routers/portfolio.py backend/routers/settings.py backend/main.py backend/routers/__tests__/test_portfolio_router.py
git commit -m "feat: implement portfolio backend — upload pipeline, CRUD, contact form, public settings"
```
