"""
Google Places API helper — fetches live rating, reviews, and review URLs.
Results are cached in memory for 24 hours to avoid hammering the API.
"""
from __future__ import annotations
import logging
import random
import time
from typing import Optional

import httpx

from config import settings

logger = logging.getLogger(__name__)

_FIND_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
_PLACE_NAME = "weCapture4U"
_LOCATION_BIAS = "point:45.608979,9.5144418"
_TTL = 86_400  # 24 hours

# Cached payload
_cache_value: Optional[dict] = None
_cache_expires: float = 0.0


def _build_review_url(place_id: str) -> str:
    return f"https://www.google.com/maps/place/?q=place_id:{place_id}"


def _build_write_review_url(place_id: str) -> str:
    return f"https://search.google.com/local/writereview?placeid={place_id}"


async def fetch_google_info() -> dict:
    """
    Return a dict with keys:
      rating: Optional[float]
      reviews_url: Optional[str]          – links to Maps reviews tab
      write_review_url: Optional[str]     – opens Google's "Write a review" dialog
      reviews: list[dict]                 – up to 5 most relevant reviews
    Returns empty/None values on failure.
    """
    global _cache_value, _cache_expires

    if not settings.GOOGLE_PLACE_API_KEY:
        return _empty()

    if _cache_value is not None and time.time() < _cache_expires:
        return _cache_value

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Step 1: find place → rating + place_id
            find_resp = await client.get(
                _FIND_URL,
                params={
                    "input": _PLACE_NAME,
                    "inputtype": "textquery",
                    "fields": "rating,place_id",
                    "locationbias": _LOCATION_BIAS,
                    "key": settings.GOOGLE_PLACE_API_KEY,
                },
            )
            find_resp.raise_for_status()
            find_data = find_resp.json()

            candidates = find_data.get("candidates", [])
            if not candidates:
                logger.warning("Google Places: no candidates for %s", _PLACE_NAME)
                return _empty()

            candidate = candidates[0]
            rating = candidate.get("rating")
            place_id = candidate.get("place_id")

            if not place_id:
                return _empty()

            # Step 2: place details → reviews
            details_resp = await client.get(
                _DETAILS_URL,
                params={
                    "place_id": place_id,
                    "fields": "reviews",
                    "language": "en",
                    "key": settings.GOOGLE_PLACE_API_KEY,
                },
            )
            details_resp.raise_for_status()
            details_data = details_resp.json()

        raw_reviews = details_data.get("result", {}).get("reviews", [])
        parsed = [
            {
                "author_name": r.get("author_name", ""),
                "author_url": r.get("author_url"),
                "profile_photo_url": r.get("profile_photo_url"),
                "rating": r.get("rating", 5),
                "text": r.get("text", "").strip(),
                "relative_time": r.get("relative_time_description", ""),
            }
            for r in raw_reviews
        ]
        # Weighted shuffle: reviews with a comment get 3× chance of ranking higher
        reviews = sorted(
            parsed,
            key=lambda r: random.random() * (3 if r["text"] else 1),
            reverse=True,
        )

        result = {
            "rating": float(rating) if rating is not None else None,
            "reviews_url": _build_review_url(place_id),
            "write_review_url": _build_write_review_url(place_id),
            "reviews": reviews,
        }

        _cache_value = result
        _cache_expires = time.time() + _TTL
        return result

    except Exception as exc:
        logger.error("Google Places fetch failed: %s", exc)
        return _empty()


def _empty() -> dict:
    return {
        "rating": None,
        "reviews_url": None,
        "write_review_url": None,
        "reviews": [],
    }
