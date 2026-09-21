# Campus Radar — Backend Server

A production-grade, security-first backend for Campus Radar — a private social platform for verified Sanjivani University students.

## Key Architectural Principles

1. **Backend as Source of Truth**: Authorization decisions are never delegated to the frontend. Roles are looked up fresh in the database on every sensitive request, never extracted blindly from JWT claims.
2. **404 Masking for Administrative Entry Points**: Public access to `/admin` returns `404 Not Found` for all users. The administrative entry point is non-public and protected by server-side role checks and TOTP MFA.
3. **Strict University Email Verification**: Only emails strictly matching `*@sanjivani.edu.in` are permitted to register.
4. **Argon2id Password Hashing**: State-of-the-art password hashing using Argon2id with 64 MB memory cost.
5. **Token Rotation with Token Family Reuse Detection**: Refresh tokens are rotated on each use. If an old or revoked token is reused, all tokens in the entire family are immediately invalidated.
6. **Student Anonymity Guarantee**: Confessions generate server-side pseudonyms (`Ghost Owl #482`). In student-facing feeds and queries, author identities are strictly excluded from SQL projections.
7. **Append-Only Audit Trail**: Administrative and moderation actions are permanently logged in `audit_logs` with timestamps, actor IDs, IP addresses, and user agents.

## Quick Start

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your PostgreSQL credentials in `DATABASE_URL` are correct.

### 3. Run Database Migrations
```bash
npm run migrate
```

### 4. Seed Super Administrator
```bash
npm run seed:admin
```
This prints the initial admin credentials and base32 TOTP secret for authenticator apps.

### 5. Start the Server
Development server with hot reload:
```bash
npm run dev
```

Production build and execution:
```bash
npm run build
npm start
```
