# @omnicourse/backend

## 0.2.0

### Minor Changes

- [#14](https://github.com/LLaammTTeerr/omnicourses/pull/14) [`488aa80`](https://github.com/LLaammTTeerr/omnicourses/commit/488aa808fe38c499cf02e5442bb61d5dba9a296a) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Students can download everything OmniCourse holds about them (`GET /api/users/me/export`) and delete their account (`DELETE /api/users/me`, password required). Deletion signs them out everywhere and completes after 30 days; signing in before then cancels it.

- [#12](https://github.com/LLaammTTeerr/omnicourses/pull/12) [`1a53b41`](https://github.com/LLaammTTeerr/omnicourses/commit/1a53b413e5b71ad08b606f3dd38e8c58e8c66b21) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Add the AI gateway (`LlmService`): typed `structured()` replies and streamed `chat()` with tools through OpenRouter, a per-user daily cap, and a clear 503 `ai_unavailable` when the model can't answer.

- [#36](https://github.com/LLaammTTeerr/omnicourses/pull/36) [`38f06ac`](https://github.com/LLaammTTeerr/omnicourses/commit/38f06ac8610335dae7a69ca9234ca5fa9857c000) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Seed the APCS 2024 and 2025 curricula and the nine CLC 2025 specialisations, with their requirement groups and courses, using `npm run db:seed`.

- [#65](https://github.com/LLaammTTeerr/omnicourses/pull/65) [`9a42280`](https://github.com/LLaammTTeerr/omnicourses/commit/9a42280603ea0f48aba332649dfb50c53250ef5b) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Signed-in students can read the programs, a cohort's curriculum with its requirement groups and courses, and any catalog course (`GET /api/programs`, `GET /api/programs/{program}/curricula/{cohort}`, `GET /api/courses/{code}`).

- [#54](https://github.com/LLaammTTeerr/omnicourses/pull/54) [`a8bd0c9`](https://github.com/LLaammTTeerr/omnicourses/commit/a8bd0c9830e1a166922f2ac150e8c8d2c8727cac) Thanks [@Anhdung1478](https://github.com/Anhdung1478)! - Add the guides pages: anyone can browse, search and read the school-task guides in Vietnamese or English without signing in. The first four guides stay drafts until they are checked on the portals.

- [#29](https://github.com/LLaammTTeerr/omnicourses/pull/29) [`45a58e2`](https://github.com/LLaammTTeerr/omnicourses/commit/45a58e2e050819c2a55c26a3ebba54262803914d) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Students can save their transcript (`PUT /api/users/me/transcript`) and read it back (`GET /api/users/me/transcript`): course, credits, term and result (a grade, in progress, exempt, pass or fail) for each course taken, with retakes kept as separate rows.

### Patch Changes

- [#56](https://github.com/LLaammTTeerr/omnicourses/pull/56) [`2784c37`](https://github.com/LLaammTTeerr/omnicourses/commit/2784c371fc4065a4e54e39c736de1f25ab163645) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - A blank or invalid `SESSION_TTL_DAYS` or `PORT` now falls back to its default (7 days, port 3000) instead of signing everyone out at once or picking a random port.

- [#59](https://github.com/LLaammTTeerr/omnicourses/pull/59) [`a7dd2c5`](https://github.com/LLaammTTeerr/omnicourses/commit/a7dd2c5e6cc18cca8bec75798d5f15000771e0fa) Thanks [@Anhdung1478](https://github.com/Anhdung1478)! - The API docs now describe the sign-in token as an opaque bearer token instead of a JWT.

- [#63](https://github.com/LLaammTTeerr/omnicourses/pull/63) [`99cd0ad`](https://github.com/LLaammTTeerr/omnicourses/commit/99cd0adf39f9d75eed3e54ea4fede29743660d3f) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Security pass fixes: two sign-ups with the same email now answer 409 instead of 500, the health check no longer reveals the database version, the API docs are hidden in production, and responses no longer advertise Express.

- [#62](https://github.com/LLaammTTeerr/omnicourses/pull/62) [`e47b7be`](https://github.com/LLaammTTeerr/omnicourses/commit/e47b7be5672c92749fafce9a22b43c2c3af76261) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Behind a reverse proxy, rate limits now count each visitor separately (`TRUST_PROXY`), and the API can listen on one interface only (`LISTEN_HOST`).

- [#58](https://github.com/LLaammTTeerr/omnicourses/pull/58) [`402166c`](https://github.com/LLaammTTeerr/omnicourses/commit/402166c2053c0c3de76725be8a4aa7f801fbc84e) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Internal restructuring of the account, AI gateway, guides and seed code; no API change.

- [#23](https://github.com/LLaammTTeerr/omnicourses/pull/23) [`900b1b8`](https://github.com/LLaammTTeerr/omnicourses/commit/900b1b82169686813f3a4a7e82d4a1aa4ade5f05) Thanks [@VoNguyenMinhTriet](https://github.com/VoNguyenMinhTriet)! - Created a simple schema for storing course information. No data has been added so far.
  This is still incomplete, so accesses should be via a view, so that the internals can be more easily modified.

## 0.1.0

### Minor Changes

- [#8](https://github.com/LLaammTTeerr/omnicourses/pull/8) [`c3c527c`](https://github.com/LLaammTTeerr/omnicourses/commit/c3c527c45222652d593917297bb6c1a33b37610b) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Add email and password sign-up and sign-in with rotating, revocable sessions (`/api/auth/*`, `/api/users/me`). Every API route now requires a bearer token unless marked public.
