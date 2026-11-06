# @omnicourse/backend

## 0.2.0

### Minor Changes

- [#14](https://github.com/LLaammTTeerr/omnicourses/pull/14) [`488aa80`](https://github.com/LLaammTTeerr/omnicourses/commit/488aa808fe38c499cf02e5442bb61d5dba9a296a) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Students can download everything OmniCourse holds about them (`GET /api/users/me/export`) and delete their account (`DELETE /api/users/me`, password required). Deletion signs them out everywhere and completes after 30 days; signing in before then cancels it.

- [#12](https://github.com/LLaammTTeerr/omnicourses/pull/12) [`1a53b41`](https://github.com/LLaammTTeerr/omnicourses/commit/1a53b413e5b71ad08b606f3dd38e8c58e8c66b21) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Add the AI gateway (`LlmService`): typed `structured()` replies and streamed `chat()` with tools through OpenRouter, a per-user daily cap, and a clear 503 `ai_unavailable` when the model can't answer.

- [#36](https://github.com/LLaammTTeerr/omnicourses/pull/36) [`38f06ac`](https://github.com/LLaammTTeerr/omnicourses/commit/38f06ac8610335dae7a69ca9234ca5fa9857c000) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Seed the APCS 2024 and 2025 curricula and the nine CLC 2025 specialisations, with their requirement groups and courses, using `npm run db:seed`.

- [#29](https://github.com/LLaammTTeerr/omnicourses/pull/29) [`45a58e2`](https://github.com/LLaammTTeerr/omnicourses/commit/45a58e2e050819c2a55c26a3ebba54262803914d) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Students can save their transcript (`PUT /api/users/me/transcript`) and read it back (`GET /api/users/me/transcript`): course, credits, term and result (a grade, in progress, exempt, pass or fail) for each course taken, with retakes kept as separate rows.

### Patch Changes

- [#23](https://github.com/LLaammTTeerr/omnicourses/pull/23) [`900b1b8`](https://github.com/LLaammTTeerr/omnicourses/commit/900b1b82169686813f3a4a7e82d4a1aa4ade5f05) Thanks [@VoNguyenMinhTriet](https://github.com/VoNguyenMinhTriet)! - Created a simple schema for storing course information. No data has been added so far.
  This is still incomplete, so accesses should be via a view, so that the internals can be more easily modified.

## 0.1.0

### Minor Changes

- [#8](https://github.com/LLaammTTeerr/omnicourses/pull/8) [`c3c527c`](https://github.com/LLaammTTeerr/omnicourses/commit/c3c527c45222652d593917297bb6c1a33b37610b) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Add email and password sign-up and sign-in with rotating, revocable sessions (`/api/auth/*`, `/api/users/me`). Every API route now requires a bearer token unless marked public.
