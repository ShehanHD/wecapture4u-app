# Client Self-Registration

## Goal

Allow clients to register themselves on the public site without admin involvement. Registration requires email verification before portal access is granted. Resend is replaced with Hostinger SMTP for all outgoing email.

## Scope

- Public client self-registration with email verification
- Replace Resend with `aiosmtplib` SMTP across the entire app
- No admin-approval step — verified accounts get immediate portal access

Out of scope: social login, admin-managed invitations, client portal UI changes beyond the new auth pages.

---

## SMTP Migration

Replace `backend/services/email.py` Resend implementation with `aiosmtplib`. The `send_email()` function signature is unchanged — all existing callers work without modification.

**New environment variables** (replace `RESEND_API_KEY` / `RESEND_FROM_EMAIL`):

```
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=noreply@wecapture4u.com
SMTP_PASSWORD=...
SMTP_FROM_EMAIL=noreply@wecapture4u.com
```

Port 465 = SSL/TLS. `aiosmtplib` is used for async compatibility with FastAPI.

---

## Data Model

### Migration A — phone column on users

```sql
ALTER TABLE users ADD COLUMN phone TEXT;
```

Nullable for existing records. Required at registration via API validation.

### Migration B — email_verification_tokens table

```sql
CREATE TABLE email_verification_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);
```

- TTL: 24 hours from creation
- Requesting a new token deletes all existing tokens for that user first
- Raw token is a `secrets.token_urlsafe(32)` — only the SHA-256 hash is stored

---

## Backend

### New endpoints

**`POST /api/auth/register`** — public, no auth required

Request body:
```json
{
  "full_name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+353 87 123 4567",
  "password": "minimum8chars"
}
```

Behaviour:
- If email already registered and verified → return `202` silently (no enumeration)
- If email already registered but unverified → delete old token, issue fresh token, resend verification email, return `202`
- Otherwise: create `users` row (`role=client`, `is_active=False`), create `clients` row (same name/email/phone, `user_id` set), issue verification token, send email, return `202`
- Password minimum: 8 characters (Pydantic validator)
- Always returns `202` — caller cannot determine whether the email was already registered

**`GET /api/auth/verify-email?token=<raw_token>`** — public

- Valid, unexpired, unused → set `user.is_active = True`, mark `token.used_at = now()`, return `200 {"message": "Email verified. You can now sign in."}`
- Expired → `410 Gone {"detail": "Verification link has expired."}`
- Not found / already used → `400 {"detail": "Invalid or already used verification link."}`

**`POST /api/auth/resend-verification`** — public

Request body: `{"email": "jane@example.com"}`

- Always returns `202` (no enumeration)
- If email exists and `is_active=False`: delete old tokens, issue fresh token, send verification email
- If email not found or already active: no-op, still returns `202`

### Login change

In `POST /api/auth/login`: if user found but `is_active=False` → return `403 {"detail": "Please verify your email before signing in."}`.

### New Pydantic schemas

```python
class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: str = Field(min_length=1, max_length=30)
    password: str = Field(min_length=8, max_length=128)

class ResendVerificationRequest(BaseModel):
    email: EmailStr
```

---

## Frontend

### New pages

**`/client/register`** — styled identically to `ClientLogin` (dark navy bg, white card):

Fields: Full Name · Email · Phone · Password · Confirm Password

Zod schema:
```ts
z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(1, 'Phone is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
})
```

On success: form transitions to an inline "check your email" state — no page redirect. Shows: `"We've sent a verification link to <email>. Check your inbox."` with a small "Didn't receive it? Resend" link.

**`/client/verify-email`** — handles the `?token=` link from the email:

On mount: calls `GET /api/auth/verify-email?token=...`

States:
- Loading: spinner
- Success (`200`): "Your email is verified! You can now sign in." + "Sign In" button → `/client/login`
- Expired (`410`): "This link has expired." + "Resend verification email" button → calls `POST /api/auth/resend-verification` then shows "New link sent"
- Invalid (`400`): "This link is no longer valid." + "Sign In" button → `/client/login`

Styled same as login/register (dark navy bg, white card).

### Updated files

**`ClientLogin.tsx`** — add below the form:
```tsx
<p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#778899' }}>
  Don't have an account?{' '}
  <Link to="/client/register" style={{ color: '#4d79ff' }}>Register</Link>
</p>
```

**`App.tsx`** — add routes:
```tsx
<Route path="/client/register" element={<ClientRegister />} />
<Route path="/client/verify-email" element={<VerifyEmail />} />
```

### New API functions & hooks

`frontend/src/api/auth.ts` — add:
- `registerClient(data)` → `POST /api/auth/register`
- `verifyEmail(token)` → `GET /api/auth/verify-email?token=...`
- `resendVerification(email)` → `POST /api/auth/resend-verification`

`frontend/src/hooks/useAuth.ts` — add:
- `useRegister()` — TanStack Query mutation wrapping `registerClient`
- `useVerifyEmail(token)` — TanStack Query query, fires once on mount
- `useResendVerification()` — TanStack Query mutation

### New schemas

`frontend/src/schemas/auth.ts` — add `RegisterSchema` and `VerifyEmailResponseSchema`.

---

## File Map

| File | Action |
|------|--------|
| `backend/services/email.py` | Replace Resend with aiosmtplib |
| `backend/config.py` | Replace RESEND_* with SMTP_* settings |
| `backend/.env.example` | Replace RESEND_* with SMTP_* |
| `backend/models/user.py` | Add `phone` column |
| `backend/models/email_verification.py` | New — `EmailVerificationToken` ORM model |
| `backend/schemas/accounts.py` | Add `RegisterRequest`, `ResendVerificationRequest` |
| `backend/routers/auth.py` | Add register, verify-email, resend-verification endpoints; update login 403 |
| `backend/tests/test_routers_auth.py` | New tests for registration flow |
| `migrations/016_user_phone.sql` | Add phone to users |
| `migrations/017_email_verification_tokens.sql` | New table |
| `frontend/src/api/auth.ts` | New file — register, verifyEmail, resendVerification |
| `frontend/src/hooks/useAuth.ts` | Add useRegister, useVerifyEmail, useResendVerification |
| `frontend/src/schemas/auth.ts` | Add RegisterSchema, VerifyEmailResponseSchema |
| `frontend/src/pages/auth/ClientRegister.tsx` | New page |
| `frontend/src/pages/auth/VerifyEmail.tsx` | New page |
| `frontend/src/pages/auth/ClientLogin.tsx` | Add "Register" link |
| `frontend/src/App.tsx` | Add /client/register and /client/verify-email routes |
