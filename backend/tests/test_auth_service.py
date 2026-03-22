import pytest
from datetime import datetime, timezone, timedelta
from services.auth import (
    hash_password, verify_password,
    create_access_token, decode_access_token,
    generate_opaque_token, hash_token,
)
from schemas.auth import (
    WebAuthnAuthenticateOptionsRequest,
    WebAuthnRegisterVerifyRequest,
    WebAuthnAuthenticateVerifyRequest,
)
from pydantic import ValidationError


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


# --- WebAuthn Schema Tests ---
def test_webauthn_authenticate_options_requires_valid_email():
    with pytest.raises(ValidationError):
        WebAuthnAuthenticateOptionsRequest(email="not-an-email")


def test_webauthn_authenticate_options_accepts_valid_email():
    req = WebAuthnAuthenticateOptionsRequest(email="user@example.com")
    assert req.email == "user@example.com"


def test_webauthn_register_verify_requires_all_fields():
    with pytest.raises(ValidationError):
        WebAuthnRegisterVerifyRequest(id="abc")  # missing rawId, response, type


def test_webauthn_register_verify_accepts_valid_body():
    req = WebAuthnRegisterVerifyRequest(
        id="credential-id",
        rawId="raw-credential-id",
        response={"clientDataJSON": "...", "attestationObject": "..."},
        type="public-key",
    )
    assert req.id == "credential-id"
    assert req.type == "public-key"


def test_webauthn_authenticate_verify_requires_email_and_id():
    with pytest.raises(ValidationError):
        WebAuthnAuthenticateVerifyRequest(id="cid")  # missing email, rawId, response, type


def test_webauthn_authenticate_verify_accepts_valid_body():
    req = WebAuthnAuthenticateVerifyRequest(
        email="user@example.com",
        id="credential-id",
        rawId="raw-id",
        response={"clientDataJSON": "...", "authenticatorData": "...", "signature": "..."},
        type="public-key",
    )
    assert req.email == "user@example.com"
    assert req.id == "credential-id"


# --- ChallengeStore Tests ---
def test_challenge_store_set_and_pop():
    from routers.auth import ChallengeStore
    store = ChallengeStore()
    store.set("user@example.com", b"challenge-bytes")
    result = store.pop("user@example.com")
    assert result == b"challenge-bytes"


def test_challenge_store_pop_missing_returns_none():
    from routers.auth import ChallengeStore
    store = ChallengeStore()
    assert store.pop("nobody@example.com") is None


def test_challenge_store_pop_consumed_returns_none():
    from routers.auth import ChallengeStore
    store = ChallengeStore()
    store.set("user@example.com", b"challenge-bytes")
    store.pop("user@example.com")  # consume
    assert store.pop("user@example.com") is None  # gone


def test_challenge_store_expired_returns_none():
    from routers.auth import ChallengeStore
    store = ChallengeStore()
    stale_time = datetime.now(timezone.utc) - timedelta(seconds=ChallengeStore.TTL_SECONDS + 1)
    store._store["user@example.com"] = (b"old-challenge", stale_time)
    assert store.pop("user@example.com") is None


def test_challenge_store_prune_removes_stale_on_set():
    from routers.auth import ChallengeStore
    store = ChallengeStore()
    stale_time = datetime.now(timezone.utc) - timedelta(seconds=ChallengeStore.TTL_SECONDS + 1)
    store._store["stale@example.com"] = (b"old", stale_time)
    store.set("new@example.com", b"new-challenge")  # triggers _prune
    assert "stale@example.com" not in store._store
    assert "new@example.com" in store._store
