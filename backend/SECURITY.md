# Security Architecture & Policies — Campus Radar

## 1. Authentication & Session Management
- **Password Storage**: Argon2id (`m=65536, t=3, p=4`).
- **Access Tokens**: Short-lived (15 minutes), signed with HMAC-SHA256. Payload contains `sub` (User UUID) and `jti`, **no role claim**.
- **Role Verification**: Middleware validates the user's role and status directly against the database on authenticated requests.
- **Refresh Tokens**: Long-lived (7 days), stored hashed (`sha256`), grouped by `token_family` UUID.
- **Token Reuse Detection**: If a previously used or revoked token is received, the entire `token_family` is revoked, terminating all attacker and victim sessions.
- **OTP Verification**: Crypto-random 6-digit codes, hashed via HMAC-SHA256 with secret salt. Rate-limited to 5 attempts per code, 60s cooldown between requests, 10-minute expiry.
- **MFA for Admins**: RFC 6238 TOTP with Google Authenticator / Authy compatibility. Window delta tolerance: 1 (±30s).

## 2. Authorization & Privilege Escalation Defenses
- **404 Masking**: Non-admin users attempting to access administrative endpoints receive `404 Not Found` (same response as non-existent URLs).
- **Public `/admin` Disablement**: Explicit 404 response on `/admin` at HTTP level.
- **Role-Based Guards**: Strict verification in `requireRole(['admin', 'super_admin'])`. Only `super_admin` can modify user roles.

## 3. Student Privacy & Anonymity
- Confessions are assigned pseudonyms dynamically on the server (`Ghost Owl #482`).
- Student feed queries NEVER select `author_id` or join author personal identity fields.
- Real user identity is solely stored in the backend database for lawful compliance, disciplinary action, and emergency moderation.

## 4. Input Validation & Injection Prevention
- All database queries utilize parameterized `$1, $2` inputs via `pg`.
- Request bodies, query parameters, and route parameters are validated against strict Zod schemas.
- Text inputs undergo bracket stripping and sanitization to defeat Stored XSS.
- Rate limiters protect auth endpoints against credential stuffing and brute-force attacks.

## 5. Audit Logging
- Append-only `audit_logs` records:
  - Actor ID, actor email, actor role
  - Action name, target type, target ID
  - IP address and User-Agent
  - Structured metadata payload
