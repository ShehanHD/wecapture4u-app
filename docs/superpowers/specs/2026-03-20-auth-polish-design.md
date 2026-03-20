# Auth Service Polish — Design Spec

**Date:** 2026-03-20
**Scope:** `backend/routers/auth.py`, `backend/schemas/auth.py`, `backend/services/auth.py`
**Approach:** Option B — Minimal targeted fixes + Pydantic schema improvements

---

## Background

The auth layer (JWT + opaque refresh tokens, WebAuthn, password reset) is architecturally correct but has four concrete issues: a credential-matching bug in WebAuthn authentication, unbounded challenge memory growth, missing password validation, and untyped WebAuthn request bodies. This spec covers all four fixes plus moving WebAuthn imports to the top of the router file.

---

## Fix 1 — WebAuthn credential matching bug

**File:** `backend/routers/auth.py` — `webauthn_authenticate_verify`

**Problem:** The endpoint always passes `list(stored_creds.values())[0]` to `verify_authentication_response`, regardless of which credential the authenticator actually used. This means multi-credential users always verify against the wrong key (first stored), and single-credential users get lucky. It also skips updating `sign_count` after successful auth, which is required to prevent replay attacks.

**Note:** This fix depends on the typed `WebAuthnAuthenticateVerifyRequest` schema defined in Fix 4. `body.id` is a typed attribute on that schema. The fixes should be applied together.

**Fix:**
1. Extract `credential_id` from the request body (`body.id`).
2. Look it up in `stored_creds` (keyed by `credential_id`). Raise 401 if not found.
3. Pass the matched credential's `public_key` and `sign_count` to `verify_authentication_response`.
4. After successful verification, update `matched.sign_count` with `result.new_sign_count` and commit. `new_sign_count` is confirmed to exist on py_webauthn's `VerifiedAuthentication` return type.

```python
matched = stored_creds.get(body.id)
if not matched:
    raise HTTPException(status_code=401, detail="Unknown credential")

result = verify_authentication_response(
    credential=body.model_dump(),
    expected_challenge=challenge,
    expected_rp_id=settings.WEBAUTHN_RP_ID,
    expected_origin=f"https://{settings.WEBAUTHN_RP_ID}",
    credential_public_key=matched.public_key,
    credential_current_sign_count=matched.sign_count,
)
matched.sign_count = result.new_sign_count
await db.commit()
```

---

## Fix 2 — Challenge store TTL

**File:** `backend/routers/auth.py` — `_challenges` module-level dict

**Problem:** `_challenges: dict[str, bytes]` accumulates entries indefinitely. If a user requests options but never completes the flow (tab closed, network drop), the challenge leaks in memory forever. In a long-running process with many users this grows without bound.

**Fix:** Replace the plain dict with a `ChallengeStore` class that:
- Stores `(challenge_bytes, created_at)` tuples
- Prunes expired entries on every `set()` call (lazy cleanup, no background thread needed)
- Returns `None` from `pop()` for expired entries (treated as missing)
- TTL: 5 minutes (300 seconds)

```python
class ChallengeStore:
    TTL_SECONDS = 300

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
        age = datetime.now(timezone.utc) - created_at
        if age > timedelta(seconds=self.TTL_SECONDS):
            return None
        return challenge

    def _prune(self) -> None:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=self.TTL_SECONDS)
        self._store = {k: v for k, v in self._store.items() if v[1] > cutoff}

_challenges = ChallengeStore()
```

Call sites change from:
- `_challenges[key] = value` → `_challenges.set(key, value)`
- `_challenges.pop(key, None)` → `_challenges.pop(key)` (the `, None` default is dropped — `ChallengeStore.pop` always returns `bytes | None`)

---

## Fix 3 — Password validation

**File:** `backend/schemas/auth.py` — `ResetPasswordRequest`

**Problem:** `new_password: str` accepts any value including empty string. No minimum length is enforced at the schema boundary.

**Fix:** Add a `field_validator` enforcing minimum 8 characters.

```python
from pydantic import field_validator

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

FastAPI will return a 422 with a clear validation error message if this fails — no router change needed.

---

## Fix 4 — WebAuthn request schemas + import cleanup

**Files:** `backend/schemas/auth.py` (add schemas), `backend/routers/auth.py` (use schemas, move imports)

**Problem:** Three WebAuthn endpoints accept `body: dict` — no Pydantic parsing, no validation, no OpenAPI docs. WebAuthn imports are placed mid-file (line 165) with `# noqa: E402` comments.

### New schemas (`schemas/auth.py`)

```python
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

### Router changes (`routers/auth.py`)

- Move all WebAuthn-related imports to the top of the file.
- Update endpoint signatures:
  - `webauthn_authenticate_options(body: WebAuthnAuthenticateOptionsRequest, ...)`
  - `webauthn_register_verify(body: WebAuthnRegisterVerifyRequest, ...)`
  - `webauthn_authenticate_verify(body: WebAuthnAuthenticateVerifyRequest, ...)`
- Replace `body.get("email")` / `body.get("id")` with typed `body.email` / `body.id`.
- Pass `body.model_dump()` to the py_webauthn library where it previously received raw `body`.

---

## Files Changed

| File | Change |
|---|---|
| `backend/schemas/auth.py` | Add 3 WebAuthn request schemas; add `field_validator` to `ResetPasswordRequest` |
| `backend/routers/auth.py` | Move imports to top; add `ChallengeStore`; fix credential matching + sign_count update; use typed schemas |

`backend/services/auth.py` — no changes needed.

---

## What is NOT in scope

- Refresh token family revocation on suspicious reuse (deferred)
- Moving WebAuthn DB logic to `services/webauthn.py` (Option C — future)
- Rate limiting on auth endpoints (separate concern)
- `webauthn/authenticate/options` user-existence leak (low priority — consistent 400 is cosmetic, the real fix is the schema typing)
