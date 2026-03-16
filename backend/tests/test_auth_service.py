import pytest
from datetime import datetime, timezone
from services.auth import (
    hash_password, verify_password,
    create_access_token, decode_access_token,
    generate_opaque_token, hash_token,
)


def test_password_hash_and_verify():
    hashed = hash_password("secret123")
    assert verify_password("secret123", hashed) is True
    assert verify_password("wrong", hashed) is False


def test_access_token_encode_decode():
    payload = {"sub": "user-id-123", "role": "admin"}
    token = create_access_token(payload)
    decoded = decode_access_token(token)
    assert decoded["sub"] == "user-id-123"
    assert decoded["role"] == "admin"


def test_access_token_expired_raises():
    from jose import ExpiredSignatureError
    payload = {"sub": "x"}
    token = create_access_token(payload, expires_minutes=-1)
    with pytest.raises(ExpiredSignatureError):
        decode_access_token(token)


def test_opaque_token_is_unique():
    t1 = generate_opaque_token()
    t2 = generate_opaque_token()
    assert t1 != t2


def test_hash_token_is_deterministic():
    raw = "some-token"
    assert hash_token(raw) == hash_token(raw)
    assert hash_token(raw) != raw
