import pytest
from services.portfolio import generate_slug


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
