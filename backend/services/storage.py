"""
Shared Supabase Storage helpers for portfolio and avatar uploads.
"""
from __future__ import annotations
import io
import logging
import uuid
from typing import Optional

from fastapi import HTTPException, UploadFile
from PIL import Image

from config import settings

logger = logging.getLogger(__name__)

PORTFOLIO_BUCKET = "portfolio"
STORAGE_PREFIX = "/storage/v1/object/public/portfolio/"

_supabase_client = None


def _get_supabase():
    global _supabase_client
    if _supabase_client is None:
        from supabase import create_client
        _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
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
        return f"{settings.SUPABASE_URL}{STORAGE_PREFIX}{path}"
    except Exception as e:
        logger.error("Storage upload failed for path %s: %s", path, e)
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
        logger.error("Storage delete failed for key %s: %s", key, e)
