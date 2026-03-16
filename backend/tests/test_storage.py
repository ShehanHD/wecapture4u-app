from services.storage import extract_storage_key


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
