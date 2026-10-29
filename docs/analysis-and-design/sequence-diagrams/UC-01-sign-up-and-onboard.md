# Sequence diagrams: UC-01 Sign up and onboard

- Use case: UC-01 (`docs/requirements/use-cases/`, PR #16)
- Owner: Lâm
- Drawn from the code on `main`: `src/backend/src/auth/`, `src/backend/src/users/` ([ADR 0002](../adr/0002-authentication-and-sessions.md))
- Not drawn yet: onboarding (its API waits on Triết's curriculum tables) and sign-in with Google (deferred, ADR 0002)

Participants are the Nest classes that take part. `ThrottlerGuard` and `AuthGuard` are global guards, registered in that order, so they run before every controller method, and the `ValidationPipe` runs after them. The Vue app's side (where the token is kept, what a 401 does) is the plan in issue #13 and is not built yet.

## Basic flow, steps 1–5: sign up

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant SPA as Vue app
    participant Throttle as ThrottlerGuard
    participant Guard as AuthGuard
    participant Ctrl as AuthController
    participant Auth as AuthService
    participant Users as UsersService
    participant DB as PostgreSQL

    Student->>SPA: email, password, display name, consent
    SPA->>Throttle: POST /api/auth/sign-up
    Throttle->>Throttle: count for this IP and route (10/min)
    Throttle->>Guard: allowed
    Guard->>Guard: route is @Public(), skip token check
    Guard->>Ctrl: signUp(dto, user-agent)
    Note over Ctrl: ValidationPipe already checked the DTO:<br/>email, password 10–128, display name 1–100,<br/>acceptedTerms = true (A2: 400 otherwise)
    Ctrl->>Auth: signUp(dto)
    Auth->>Users: findByEmail(email)
    Users->>DB: SELECT users WHERE email = lowercased email
    DB-->>Users: none
    Auth->>Auth: argon2id hash(password)
    Auth->>Users: create(email, passwordHash, displayName, consentAt = now)
    Users->>DB: INSERT users
    Auth->>Auth: token = 32 random bytes, base64url
    Auth->>DB: INSERT sessions (user_id, sha256(token), user_agent, expires_at = now + 7 days)
    Auth-->>Ctrl: { token, expiresAt, user }
    Ctrl-->>SPA: 201 AuthResultDto
    SPA->>SPA: keep token in memory and sessionStorage
    SPA-->>Student: onboarding (step 6)
```

**A1, email already registered:** at the `findByEmail` step the user exists, and `AuthService` throws `ConflictException`, so the response is 409. Nothing is written.

**A3, too many attempts:** `ThrottlerGuard` answers 429 before any controller code runs.

## A5: sign in

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant SPA as Vue app
    participant Ctrl as AuthController
    participant Auth as AuthService
    participant Users as UsersService
    participant DB as PostgreSQL

    Student->>SPA: email, password
    SPA->>Ctrl: POST /api/auth/sign-in (public, 10/min per IP)
    Ctrl->>Auth: signIn(dto)
    Auth->>Users: findByEmail(email)
    Users->>DB: SELECT users
    alt account found with a password
        Auth->>Auth: argon2 verify(passwordHash, password)
    else unknown email
        Auth->>Auth: argon2 verify(dummyHash, password), result ignored
        Note over Auth: same work either way, so the response time<br/>does not reveal whether the email exists
    end
    alt valid
        Auth->>DB: INSERT sessions (sha256(token), expires_at = now + 7 days)
        Auth-->>Ctrl: { token, expiresAt, user }
        Ctrl-->>SPA: 200 AuthResultDto
    else invalid
        Auth-->>Ctrl: UnauthorizedException
        Ctrl-->>SPA: 401 "Invalid email or password"
    end
```

A6, where sign-in restores an account scheduled for deletion, is added to this diagram when PR #14 merges.

## Every signed-in request

```mermaid
sequenceDiagram
    autonumber
    participant SPA as Vue app
    participant Guard as AuthGuard
    participant Auth as AuthService
    participant DB as PostgreSQL
    participant Ctrl as Any controller

    SPA->>Guard: GET /api/... with Authorization: Bearer token
    Guard->>Auth: authenticate(token)
    Auth->>DB: SELECT sessions JOIN users WHERE token_hash = sha256(token)
    DB-->>Auth: session or none
    alt live session (not revoked, not expired)
        Auth-->>Guard: { user, session }
        Guard->>Ctrl: request.user, request.session set
        Ctrl-->>SPA: 200, via @CurrentUser()
    else unknown, revoked or expired
        Guard-->>SPA: 401
        SPA->>SPA: clear token, show sign-in
    end
```

## Staying signed in: token rotation

```mermaid
sequenceDiagram
    autonumber
    participant SPA as Vue app
    participant Guard as AuthGuard
    participant Auth as AuthService
    participant DB as PostgreSQL

    Note over SPA: on app start-up
    SPA->>Guard: POST /api/auth/refresh with the current token
    Guard->>Auth: authenticate(token)
    Auth-->>Guard: { user, session }
    Guard->>Auth: refresh(session)
    Auth->>DB: UPDATE sessions SET token_hash = sha256(new), rotated_at = now, expires_at = now + 7 days
    Auth-->>SPA: 200 { new token, expiresAt, user }
    Note over SPA,DB: the old token's hash is gone, so it returns 401 from now on
```

## Signing out

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant SPA as Vue app
    participant Ctrl as AuthController
    participant Auth as AuthService
    participant DB as PostgreSQL

    alt this device
        Student->>SPA: Sign out
        SPA->>Ctrl: POST /api/auth/sign-out
        Ctrl->>Auth: signOut(current session)
        Auth->>DB: UPDATE sessions SET revoked_at = now WHERE id = current
        Ctrl-->>SPA: 204
    else another device
        Student->>SPA: Sessions page → revoke one
        SPA->>Ctrl: DELETE /api/auth/sessions/:id
        Ctrl->>Auth: revoke(user.id, id)
        Auth->>DB: UPDATE sessions SET revoked_at = now WHERE id = :id AND user_id = user.id
        Note over Auth,DB: scoped by user_id: 0 rows → 404,<br/>so nobody can revoke someone else's session
        Ctrl-->>SPA: 204
    end
```
