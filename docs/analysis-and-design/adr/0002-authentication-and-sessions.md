# ADR 0002: Authentication and sessions

- Status: accepted
- Date: 2026-10-23
- Deciders: Lâm (owner of `auth`, `users`)
- Reviewer: Triết (Backend Lead)

## Context

F1 (Vision §5) needs sign-up and sign-in. The security NFR (Vision §6) requires "passwords hashed with a modern algorithm" and "sessions that rotate, expire and can be revoked". Every other module needs to know who is calling by 29 Oct (Work Breakdown, Handoffs).

## Decisions

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **Opaque random token (32 bytes, base64url), stored only as SHA-256** in a `sessions` row | JWT (`@nestjs/jwt`) | Revocation needs a server-side row either way, so a JWT adds a library and a signing key without removing the lookup. A leaked database exposes no usable token, only hashes. `auth.service.spec.ts` asserts the stored hash is the token's SHA-256. |
| **Rotation on `POST /auth/refresh`**: new token, same session row, expiry restarts, old token dead at once | Fixed-lifetime tokens | Meets "rotate" and "expire". The e2e test checks that the old token returns 401 right after a refresh. |
| **Expiry 7 days** (`SESSION_TTL_DAYS`) | Short access token + refresh token pair | One token type is simpler for a student project. The client refreshes on start-up, so an active user never sees the expiry. |
| **Revocation**: `POST /auth/sign-out` (this device), `DELETE /auth/sessions/:id` (any of my devices) | Sign-out only | "Can be revoked" covers a lost phone. `revoke()` is scoped by `user_id`, so nobody can revoke someone else's session (unit test). |
| **Bearer header**, not cookies | httpOnly cookie | CORS is origin-only today. Cookies would need `credentials: true`, SameSite policy and CSRF protection. Bearer works the same from Swagger UI, tests and the SPA. Trade-off: the SPA must keep the token out of reach of XSS (memory or sessionStorage, strict CSP). Revisit if we serve the SPA and API from one origin. |
| **argon2id via `@node-rs/argon2` 2.2.2**, library defaults | `argon2` (node-gyp postinstall), bcrypt | argon2id is the OWASP Password Storage Cheat Sheet first choice. `@node-rs/argon2` ships prebuilt binaries as optional platform packages with no install script, so it installs under npm 11's install-scripts allowlist and in CI without a compiler. A unit test hashes and verifies for real, so a missing binding fails CI. |
| **Same error and timing for unknown email and wrong password** | Separate messages | Unknown emails are verified against a dummy hash, so response time does not reveal whether an account exists. Sign-up still returns 409 on a taken email; that is accepted because the sign-up form has to say so anyway. |
| **Default-deny global `AuthGuard`** with `@Public()` opt-out | Per-controller `@UseGuards` | A new route is protected even if its author forgets. `health` and the two password endpoints are the only public routes (widened by ADR 0010). |
| **Rate limit**: `@nestjs/throttler` 6.7.1, 10 requests/min per IP on sign-up and sign-in, 120/min elsewhere | None until the Sprint 5 security pass | Password endpoints are brute-force targets from day one. The throttler peer range includes Nest 12. |
| **`users` table holds identity only**: email (lowercase, CHECK), nullable `password_hash` and `google_sub` (CHECK: at least one), `email_verified_at`, `consent_at` | Adding program, cohort and roles now | Onboarding columns reference Triết's curriculum tables (28 Oct). Admin roles belong to F12 (Thắng). `consent_at` meets the privacy NFR (Luật 91/2025/QH15). |
| **Migrations as imported classes**, run by `npm run db:migrate` and by the e2e setup | TypeORM CLI with a glob path | Globs differ between `.ts` (tests) and `.js` (dist). An imported class that is missing fails typecheck. |

## Deferred

- **Google OAuth**: needs an OAuth client ID and secret from Google Cloud. `google_sub` is already in the table.
- **Email verification**: needs a mail sender. `email_verified_at` is already in the table.
- **Trust proxy**: the rate limit keys on `req.ip`. Behind the staging host's proxy every request shares one IP, so set Express `trust proxy` when the host is chosen, or one person's typos lock everyone out of sign-in.
- **Account export and delete**: Sprint 3. Deleting a user cascades to their sessions.
