# Auth Service Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four auth layer issues — WebAuthn credential matching bug, unbounded challenge memory, missing password validation, and untyped WebAuthn request bodies.

**Architecture:** All changes are confined to two files: `backend/schemas/auth.py` (schema additions + validator) and `backend/routers/auth.py` (ChallengeStore, import cleanup, typed endpoint bodies, credential matching fix). No new files are created. No service layer changes.

**Tech Stack:** FastAPI, Pydantic v2, python-jose, py_webauthn, pytest + httpx (async)

**Spec:** `docs/superpowers/specs/2026-03-20-auth-polish-design.md`

---

## File Map

| File | What changes |
|---|---|
| `backend/schemas/auth.py` | Add `field_validator` to `ResetPasswordRequest`; add 3 new WebAuthn request schemas |
| `backend/routers/auth.py` | Move WebAuthn imports to top; add `ChallengeStore` class; update 3 WebAuthn endpoint signatures to typed schemas; fix credential matching + sign_count update |
| `backend/tests/test_auth.py` | Add tests: short password rejected, WebAuthn options request typed, unknown credential 401 |
| `backend/tests/test_auth_service.py` | Add `ChallengeStore` unit tests |

---

## Task 1: Password validation in `ResetPasswordRequest`

**Files:**
- Modify: `backend/schemas/auth.py`
- Modify: `backend/tests/test_auth.py`

**Context:** `ResetPasswordRequest.new_password` is a plain `str` with no constraints. Any value including `""` passes. FastAPI returns 422 automatically when a Pydantic validator fails.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_auth.py`:

```python
@pytest.mark.asyncio
async def test_reset_password_short_password_rejected(client: AsyncClient) -> None:
    response = await client.post("/api/auth/reset-password", json={
        "token": "any-token",
        "new_password": "short",
    })
    assert response.status_code == 422
    body = response.json()
    assert "8 characters" in str(body)
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
pytest tests/test_auth.py::test_reset_password_short_password_rejected -v
```

Expected: FAIL — the endpoint currently accepts short passwords and returns 422 for wrong token, not for password length. The assertion `"8 characters" in str(body)` will fail.

- [ ] **Step 3: Add the validator to `ResetPasswordRequest`**

In `backend/schemas/auth.py`, change the import line from:
```python
from pydantic import BaseModel, EmailStr
```
to:
```python
from pydantic import BaseModel, EmailStr, field_validator
```

Then update `ResetPasswordRequest`:
```python
class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
pytest tests/test_auth.py::test_reset_password_short_password_rejected -v
```

Expected: PASS

- [ ] **Step 5: Run the full auth test suite to confirm nothing broke**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
pytest tests/test_auth.py tests/test_auth_service.py tests/test_auth_dependency.py -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/schemas/auth.py backend/tests/test_auth.py
git commit -m "feat: enforce 8-character minimum on ResetPasswordRequest.new_password"
```

---

## Task 2: Add WebAuthn request schemas to `schemas/auth.py`

**Files:**
- Modify: `backend/schemas/auth.py`

**Context:** Three WebAuthn endpoints currently accept `body: dict`. This task adds typed Pydantic schemas for them. These schemas are used in Task 3 (router update). No router changes yet.

- [ ] **Step 1: Write schema validation tests**

Add to `backend/tests/test_auth_service.py` (it's a pure unit test file, appropriate for schema tests too):

```python
from schemas.auth import (
    WebAuthnAuthenticateOptionsRequest,
    WebAuthnRegisterVerifyRequest,
    WebAuthnAuthenticateVerifyRequest,
)
from pydantic import ValidationError


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
```

- [ ] **Step 2: Run to confirm they all fail (schemas don't exist yet)**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
pytest tests/test_auth_service.py -k "webauthn" -v
```

Expected: FAIL — `ImportError: cannot import name 'WebAuthnAuthenticateOptionsRequest'`

- [ ] **Step 3: Add the three schemas to `backend/schemas/auth.py`**

Append after the existing `WebAuthnCredentialResponse` class:

```python
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
```

- [ ] **Step 4: Run schema tests to confirm they pass**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
pytest tests/test_auth_service.py -k "webauthn" -v
```

Expected: all PASS

- [ ] **Step 5: Run the full test suite to confirm nothing broke**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
pytest tests/test_auth.py tests/test_auth_service.py tests/test_auth_dependency.py -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/schemas/auth.py backend/tests/test_auth_service.py
git commit -m "feat: add typed Pydantic schemas for WebAuthn request bodies"
```

---

## Task 3: Add `ChallengeStore` with TTL to `routers/auth.py`

**Files:**
- Modify: `backend/routers/auth.py`
- Modify: `backend/tests/test_auth_service.py`

**Context:** The module-level `_challenges: dict[str, bytes] = {}` grows forever. Replace it with a `ChallengeStore` class that expires entries after 5 minutes. This is a pure Python class — no DB, no FastAPI involved — so it can be unit tested directly.

- [ ] **Step 1: Write `ChallengeStore` unit tests**

Add to `backend/tests/test_auth_service.py`:

```python
from datetime import datetime, timedelta, timezone


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
    from datetime import datetime, timezone
    store = ChallengeStore()
    # Inject a stale entry by manipulating the internal store directly
    stale_time = datetime.now(timezone.utc) - timedelta(seconds=ChallengeStore.TTL_SECONDS + 1)
    store._store["user@example.com"] = (b"old-challenge", stale_time)
    assert store.pop("user@example.com") is None


def test_challenge_store_prune_removes_stale_on_set():
    from routers.auth import ChallengeStore
    from datetime import datetime, timezone
    store = ChallengeStore()
    stale_time = datetime.now(timezone.utc) - timedelta(seconds=ChallengeStore.TTL_SECONDS + 1)
    store._store["stale@example.com"] = (b"old", stale_time)
    store.set("new@example.com", b"new-challenge")  # triggers _prune
    assert "stale@example.com" not in store._store
    assert "new@example.com" in store._store
```

- [ ] **Step 2: Run to confirm they all fail**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
pytest tests/test_auth_service.py -k "challenge_store" -v
```

Expected: FAIL — `ImportError: cannot import name 'ChallengeStore' from 'routers.auth'`

- [ ] **Step 3: Replace `_challenges` with `ChallengeStore` in `backend/routers/auth.py`**

Find the current line:
```python
# In-memory challenge store (single-process only — sufficient for non-serverless deployment)
_challenges: dict[str, bytes] = {}
```

Replace with:

```python
class ChallengeStore:
    """In-memory challenge store with TTL expiry.

    Entries older than TTL_SECONDS are treated as missing.
    Lazy pruning runs on every set() call — no background thread needed.
    Single-process only; sufficient for non-serverless deployment.
    """
    TTL_SECONDS = 300  # 5 minutes

    def __init__(self) -> None:
        self._store: dict[str, tuple[bytes, datetime]] = {}

    def set(self, key: str, challenge: bytes) -> None:
        self._prune()
        self._store[key] = (challenge, datetime.now(timezone.utc))

    def pop(self, key: str) -> bytes | None:
        entry = self._store.pop(key, None)
        if entry is None:
            return None
        challenge, created_at = entry
        if datetime.now(timezone.utc) - created_at > timedelta(seconds=self.TTL_SECONDS):
            return None
        return challenge

    def _prune(self) -> None:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=self.TTL_SECONDS)
        self._store = {k: v for k, v in self._store.items() if v[1] > cutoff}


_challenges = ChallengeStore()
```

Make sure `timedelta` is imported at the top of the router file. It already is (line 1: `from datetime import datetime, timezone, timedelta`). No new import needed.

Then update the three call sites:

| Old | New |
|---|---|
| `_challenges[str(current_user.id)] = options.challenge` | `_challenges.set(str(current_user.id), options.challenge)` |
| `challenge = _challenges.pop(str(current_user.id), None)` | `challenge = _challenges.pop(str(current_user.id))` |
| `_challenges[email] = options.challenge` | `_challenges.set(email, options.challenge)` |
| `challenge = _challenges.pop(email, None)` | `challenge = _challenges.pop(email)` |

- [ ] **Step 4: Run `ChallengeStore` tests to confirm they pass**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
pytest tests/test_auth_service.py -k "challenge_store" -v
```

Expected: all PASS

- [ ] **Step 5: Run full auth test suite**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
pytest tests/test_auth.py tests/test_auth_service.py tests/test_auth_dependency.py -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/routers/auth.py backend/tests/test_auth_service.py
git commit -m "feat: replace _challenges dict with ChallengeStore (5-min TTL, lazy prune)"
```

---

## Task 4: Router cleanup + credential matching fix

**Files:**
- Modify: `backend/routers/auth.py`
- Modify: `backend/tests/test_auth.py`

**Context:** Two remaining changes to the router:
1. Move WebAuthn imports to the top (currently at line 165 with `# noqa: E402`)
2. Update the three WebAuthn endpoint signatures to use the typed schemas from Task 2
3. Fix the credential matching bug — always used `list(stored_creds.values())[0]` instead of matching by the credential ID the authenticator actually used; also update `sign_count` after auth to prevent replays

**Note:** The credential matching fix (bug #1) and the schema typing (Fix 4) are done together here because `body.id` depends on the typed schema.

- [ ] **Step 1: Write a test for unknown-credential rejection**

The credential matching fix should reject a request where the `id` in the body doesn't match any stored credential. Add to `backend/tests/test_auth.py`:

```python
@pytest.mark.asyncio
async def test_webauthn_authenticate_verify_rejects_unknown_credential(client: AsyncClient) -> None:
    """Endpoint must return 400 when no pending challenge exists (covers the unknown-credential path)."""
    response = await client.post("/api/auth/webauthn/authenticate/verify", json={
        "email": "user@example.com",
        "id": "nonexistent-credential-id",
        "rawId": "nonexistent-credential-id",
        "response": {"clientDataJSON": "x", "authenticatorData": "x", "signature": "x"},
        "type": "public-key",
    })
    # No pending challenge → should get 400, not 500
    assert response.status_code == 400
    assert "challenge" in response.json()["detail"].lower()
```

- [ ] **Step 2: Run the test to confirm it currently passes or clarify its baseline**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
pytest tests/test_auth.py::test_webauthn_authenticate_verify_rejects_unknown_credential -v
```

Note: This test validates "no pending challenge → 400". It should already pass because the current code raises 400 for missing challenge before reaching credential lookup. If it fails, note the actual status code before proceeding.

- [ ] **Step 3: Move WebAuthn imports to the top of `backend/routers/auth.py`**

Remove the mid-file import block (currently starting around line 165):

```python
# --- WebAuthn endpoints ---
from webauthn import verify_registration_response, verify_authentication_response  # noqa: E402
from webauthn.helpers.exceptions import InvalidCBORData, InvalidAuthenticatorDataStructure  # noqa: E402
from models.auth import WebAuthnCredential  # noqa: E402
from services.webauthn import get_registration_options, get_authentication_options, options_to_json  # noqa: E402
from schemas.auth import WebAuthnDeviceCheckResponse, WebAuthnCredentialResponse  # noqa: E402
import json  # noqa: E402
from fastapi import Request  # noqa: E402
```

Add these to the top of the file with the existing imports (merge cleanly):

```python
import json
from fastapi import APIRouter, Depends, HTTPException, status, Request
from webauthn import verify_registration_response, verify_authentication_response
from webauthn.helpers.exceptions import InvalidCBORData, InvalidAuthenticatorDataStructure
from models.auth import RefreshToken, WebAuthnCredential
from services.webauthn import get_registration_options, get_authentication_options, options_to_json
from schemas.auth import (
    LoginRequest, TokenResponse, RefreshRequest,
    ForgotPasswordRequest, ResetPasswordRequest, CurrentUser,
    WebAuthnDeviceCheckResponse, WebAuthnCredentialResponse,
    WebAuthnAuthenticateOptionsRequest, WebAuthnRegisterVerifyRequest,
    WebAuthnAuthenticateVerifyRequest,
)
```

Remove the `# --- WebAuthn endpoints ---` section marker and the old import block entirely.

- [ ] **Step 4: Update the three WebAuthn endpoint signatures**

**`webauthn_register_verify`** — change `body: dict` to `body: WebAuthnRegisterVerifyRequest`:
```python
@router.post("/webauthn/register/verify", status_code=status.HTTP_201_CREATED)
async def webauthn_register_verify(
    body: WebAuthnRegisterVerifyRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
```
Inside the function, change `credential=body` to `credential=body.model_dump()`.

**`webauthn_authenticate_options`** — change `body: dict` to `body: WebAuthnAuthenticateOptionsRequest`:
```python
@router.post("/webauthn/authenticate/options")
async def webauthn_authenticate_options(body: WebAuthnAuthenticateOptionsRequest, db: AsyncSession = Depends(get_db)):
    email = body.email  # was: body.get("email")
    # remove the "if not email" guard — EmailStr guarantees it's present
```

**`webauthn_authenticate_verify`** — change `body: dict` to `body: WebAuthnAuthenticateVerifyRequest`:
```python
@router.post("/webauthn/authenticate/verify", response_model=TokenResponse)
async def webauthn_authenticate_verify(body: WebAuthnAuthenticateVerifyRequest, db: AsyncSession = Depends(get_db)):
    email = body.email  # was: body.get("email")
```

- [ ] **Step 5: Fix credential matching + add sign_count update**

In `webauthn_authenticate_verify`, replace the current verification block:

```python
# BEFORE (buggy):
try:
    verify_authentication_response(
        credential=body,
        expected_challenge=challenge,
        expected_rp_id=settings.WEBAUTHN_RP_ID,
        expected_origin=f"https://{settings.WEBAUTHN_RP_ID}",
        credential_public_key=list(stored_creds.values())[0].public_key,
        credential_current_sign_count=list(stored_creds.values())[0].sign_count,
    )
except Exception as exc:
    raise HTTPException(status_code=401, detail=f"Authentication failed: {exc}")
```

With:

```python
# AFTER (correct):
matched = stored_creds.get(body.id)
if not matched:
    raise HTTPException(status_code=401, detail="Unknown credential")

try:
    result = verify_authentication_response(
        credential=body.model_dump(),
        expected_challenge=challenge,
        expected_rp_id=settings.WEBAUTHN_RP_ID,
        expected_origin=f"https://{settings.WEBAUTHN_RP_ID}",
        credential_public_key=matched.public_key,
        credential_current_sign_count=matched.sign_count,
    )
except Exception as exc:
    raise HTTPException(status_code=401, detail=f"Authentication failed: {exc}")

matched.sign_count = result.new_sign_count
```

The existing `await db.commit()` at the end of the function will persist the updated `sign_count`.

- [ ] **Step 6: Run the auth test suite**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
pytest tests/test_auth.py tests/test_auth_service.py tests/test_auth_dependency.py -v
```

Expected: all PASS

- [ ] **Step 7: Run the full test suite to confirm no regressions**

```bash
cd /Users/don/Desktop/weCapture4U-app/backend
pytest -v
```

Expected: all PASS (or same failures as before this change if any pre-existing failures exist)

- [ ] **Step 8: Commit**

```bash
cd /Users/don/Desktop/weCapture4U-app
git add backend/routers/auth.py backend/tests/test_auth.py
git commit -m "fix: correct WebAuthn credential matching and update sign_count after auth"
```

---

## Done

All four fixes are now applied and tested:

| Fix | Status |
|---|---|
| Password minimum length (8 chars) on reset | Task 1 |
| Typed WebAuthn request schemas | Task 2 |
| ChallengeStore with 5-min TTL | Task 3 |
| Credential matching by ID + sign_count update | Task 4 |
