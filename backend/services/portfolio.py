"""
Portfolio service: slug generation, photo upload pipeline, CRUD.
Storage operations use the shared storage service.
"""
from __future__ import annotations
import re
import unicodedata
import uuid as _uuid

from fastapi import HTTPException, UploadFile
from sqlalchemy import select, func as sqlfunc, update as sqlupt, text
from sqlalchemy.ext.asyncio import AsyncSession

from models.portfolio import HeroPhoto, PortfolioCategory, PortfolioPhoto, ContactSubmission
from services.storage import validate_image_file, process_image, upload_to_storage, delete_from_storage


MAX_HERO_PHOTOS = 20


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
    db: AsyncSession,
    category_id: _uuid.UUID,
    name: str | None = None,
    cover_file: UploadFile | None = None,
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
        select(sqlfunc.count()).select_from(PortfolioPhoto)
        .where(PortfolioPhoto.category_id == category_id)
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
    cat = result.scalar_one_or_none()
    if cat is None:
        raise HTTPException(404, "Category not found.")

    # Validate all files first (all-or-nothing)
    raw_files: list[bytes] = []
    for f in files:
        content = await validate_image_file(f)
        raw_files.append(content)

    # Upload all — rollback on any failure
    urls: list[str] = []
    uploaded_keys: list[str] = []
    for content in raw_files:
        processed = process_image(content, max_long_side=1920)
        key = f"{cat.slug}/{_uuid.uuid4()}.webp"
        try:
            url = upload_to_storage(key, processed)
            urls.append(url)
            uploaded_keys.append(key)
        except HTTPException:
            for k in uploaded_keys:
                delete_from_storage(k)
            raise HTTPException(503, "Upload failed. Please try again.")

    # Acquire row lock and insert all DB rows atomically
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
            sqlupt(PortfolioPhoto)
            .where(PortfolioPhoto.id == item["id"])
            .values(position=item["position"])
        )
    await db.flush()
