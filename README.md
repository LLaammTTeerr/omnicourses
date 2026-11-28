# OmniCourse

One page for everything school related at HCMUS: degree audit, curriculum explorer, semester roadmap planner, an AI planner and advisor, and the exact links and steps for the school tasks the app does not perform itself. The first release covers the Advanced Program in Computer Science (APCS).

Course project, Elements of Software Engineering, 5 Oct – 13 Dec 2026. The repository is maintained by LamTer (Project Lead).

## Live demo and status

| Environment | URL                                     | Deploys                                                                    |
| ----------- | --------------------------------------- | -------------------------------------------------------------------------- |
| Production  | https://omnicourses.lamter.cc           | Every merge to `main`, once CI passes on the merged commit                 |
| Staging     | https://stag-omnicourses.lamter.cc      | Every push to the `staging` branch; serves the API docs at `/api/docs`     |

**To try it:** open the sign-in page and follow *Create an account*. Any email works, since there is no email verification step yet. Then onboard with **APCS, cohort 2024 or 2025**, the curricula seeded so far. Enter made-up courses and grades only, never your real transcript. For a ready-made demo account, ask the Project Lead; no shared password is published here, because this repository is public.

## What is built

This table is the one place that says what is built. It describes `main` as of 27 November 2026. A pull request that adds or removes a route or a screen updates this table in the same pull request. Feature numbers and names follow the [Vision](report/assignments/PA2/Vision.tex). Where the built code differs from a use case, [design-differences.md](docs/analysis-and-design/design-differences.md) gives the details.

| Feature | API (under `/api`) | Screen | Not built yet |
| --- | --- | --- | --- |
| F1 Account and onboarding | `auth/*`, `users/me` (`GET`, `PATCH`), `users/me/onboarding`, `users/me/export`, `DELETE users/me` | Sign-up, sign-in, onboarding, settings (student ID and class, sessions, export, deletion) | Google sign-in, email verification |
| F2 Transcript import | `users/me/transcript` (`GET`, `PUT`) | Transcript page: paste a grades table (deterministic parser) or type rows in, with review, curriculum lookup and a diff summary before saving | File upload (out of scope: [ADR 0007](docs/analysis-and-design/adr/0007-transcript.md#amendment-15-november-2026-paste-or-type-no-file)) |
| F3 Degree audit dashboard | `users/me/audit` | Dashboard, degree audit | Estimated graduation term, past-term view |
| F4 Curriculum explorer | `programs`, `programs/:program/curricula/:cohort`, `courses/:code` | Explorer, with recorded prerequisites, readiness states (`passed`, `in progress`, `failed`, `available`, `locked`) and downstream unlocked courses | Prerequisite graph |
| F5 Semester roadmap planner | `plans`, `plans/:id`, `plans/:id/issues`, `plans/:id/issues/drops`, `plans/:id/placements`, `plans/:id/duplicate` | Plan list, plan editor with the rule engine's checks | Fix suggestions |
| F6 AI plan generator | none | none | All of F6 |
| F7 What-if simulator | none (a plan can be copied with `plans/:id/duplicate`) | none | All of F7 |
| F8 AI academic advisor chat | none (the AI gateway in `src/backend/src/ai/` has no route; [#77](https://github.com/LLaammTTeerr/omnicourses/pull/77) is open) | none | All of F8 |
| F9 Plan export and sharing | `plans/:id/share`, `shared-plans/:token` (public) | Share dialog in the planner, public `/shared/:token` page, browser Print/PDF layout | none |
| F10 Notifications: school dates | `academic-calendar`, `admin/programs/:programId/calendar-events` | Calendar page, `/admin/calendar` administration screen | none |
| F10 Notifications: inbox | `notifications`, `notifications/unread-count`, `notifications/read-all`, `notifications/:id/read` | Inbox page, bell with the unread count | Popover, filters |
| F11 Quicklinks and guides | `guides`, `guides/:id` (public) | Guide list and guide pages, open without signing in | Values from the student's own data, problem reports. The first guides stay drafts until they are checked on the school portals |
| F12 Curriculum administration | `admin/*`: programs, cohorts, requirement groups, course links, prerequisites, offering terms, catalog courses, CSV import, access grants | `/admin`: curriculum, catalog, CSV import, access | Entry of a program's training type and of credit totals, the change-history log |

The exact routes and their fields are in the OpenAPI contract, [`src/backend/openapi.json`](src/backend/openapi.json).

**Prerequisites:** every APCS 2024 and 2025 course is recorded as having no prerequisite, except CS470, which needs CS469. That one rule is printed in the APCS curriculum PDFs (p. 8 for 2024, p. 9 for 2025), and the Project Lead decided on 24 November 2026 to keep it; for the other courses the Project Lead's decision of 15 November 2026 is the source. The planner checks them against these records.

**Known gap:** no offering terms are recorded yet, so the planner's check for them shows *Not recorded yet* instead of passing or failing a course.

Release notes are in the changelogs, [backend](src/backend/CHANGELOG.md) and [frontend](src/frontend/CHANGELOG.md), written by the Release workflow (see [Versioning](#versioning)).

## Stack

PostgreSQL, NestJS, Vue 3 with Vite, Vitest, TypeScript, TypeORM and OpenAPI. Every version is pinned exactly. The pinned versions are listed once, in [AGENTS.md](AGENTS.md#stack-pinned-exactly-do-not-use-ranges); the reasons for them are in [ADR 0001](docs/analysis-and-design/adr/0001-technology-stack.md).

## Repository layout

```
src/backend/                NestJS REST API (+ Swagger UI at /api/docs, off in production unless API_DOCS=true)
src/frontend/               Vue 3 + Vite single-page app
docs/management/            Two early weekly reports in Markdown (the record is in report/weekly)
docs/requirements/          Use-case specifications, guides plan (the Vision is in report/)
docs/analysis-and-design/   Architecture (C4), models, UI design, ADRs
docs/test/                  Test plan, test cases, test reports
report/                     Academic reports & assignment submissions (PA1 … PA5, weekly)
```

Engineering documentation in `docs/` is written in Markdown; academic reports and assignment submissions in `report/` are written in XeLaTeX and built to PDF via `report/build.sh`.

## Versioning

[Semantic versioning](https://semver.org) with [Changesets](https://github.com/changesets/changesets). Backend and frontend share one version. How to add a changeset and how a release happens: [CONTRIBUTING.md §3](CONTRIBUTING.md#3-pull-requests) and [.changeset/README.md](.changeset/README.md).

## Run it locally

Requirements: the Node version in `.nvmrc`, the npm version in [AGENTS.md](AGENTS.md#stack-pinned-exactly-do-not-use-ranges), and Podman or Docker.

```bash
cp .env.example .env
npm install
npm run db:up            # PostgreSQL 18.6 on localhost:5432
npm run build -w src/backend && npm run db:migrate -w src/backend
npm run db:seed           # curriculum seed data (APCS, CLC), insert-only
npm run dev:backend      # http://localhost:3000/api, Swagger at /api/docs
npm run dev:frontend     # http://localhost:5173
```

Checks (the same ones CI runs):

```bash
npm run verify                     # lint, typecheck, unit tests, build
npm run test:e2e                   # needs the database
```

## Rules for changing `main`

Every change reaches `main` through a signed, reviewed pull request that passes CI. Production then deploys by itself. The full workflow (Discord tasks, branches, commit messages, signing, changesets, review, merge, deploy, releases and the AI policy) is in **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Team

| Member                 | Role                        |
| ---------------------- | --------------------------- |
| Phan Bình Nguyên Lâm   | Project Lead, Developer     |
| Lê Hữu Hoà             | Frontend Lead, Developer    |
| Võ Nguyễn Minh Triết   | Backend Lead, Developer     |
| Nguyễn Anh Dũng        | Developer, Tester           |
| Nguyễn Hữu Quốc Thắng  | Developer, Tester           |
