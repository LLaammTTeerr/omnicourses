# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, …) working in this repository. Humans: see [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md). Everything there applies to agents too; this file adds what an agent needs to know.

## Project in one paragraph

OmniCourse is a web app for HCMUS students (APCS first): degree audit, curriculum explorer, semester roadmap planner, AI plan generator and advisor, quicklinks. Vue 3 frontend (`src/frontend`), NestJS REST API (`src/backend`), PostgreSQL 18. Requirements: Vision document (F1–F12, NFRs). Plan and process: Software Development Plan. Both live in `docs/`.

## Stack (pinned exactly, do not use ranges)

PostgreSQL 18.6 · NestJS 12.1.3, Nest CLI 12.0.8, Swagger 12.0.2 · Vue 3.5.44 · OpenAPI 3.2.0 · Vitest 5.0.4 · Vite 8.3.4 · TypeScript 6.0.3 · TypeORM 1.1 · Node 22 · **npm 11** (npm 10 crashes on this tree). Rationale: [ADR 0001](docs/analysis-and-design/adr/0001-technology-stack.md). Add new dependencies with exact versions (`npm i -E`).

## Commands

```bash
npm install                         # npm 11
npm run db:up                       # PostgreSQL 18.6 via podman/docker compose
npm run typecheck && npm test && npm run build
npm run test:e2e -w src/backend     # needs the database (DATABASE_URL)
npm run openapi -w src/backend      # after build; writes openapi.json
```

Run typecheck, tests and build before every push. Run e2e when you touch the backend.

## Conventions

- **English everywhere**: code, comments, commits, PR descriptions, docs.
- Backend: one Nest module per feature folder (`src/backend/src/<feature>/`), DTOs with `@ApiProperty` so the OpenAPI contract stays complete, relative imports with `.js` suffix (NodeNext). Schema changes via TypeORM migrations; `synchronize` stays `false`.
- Frontend: `<script setup lang="ts">` SFCs, Pinia for shared state, API calls in `src/frontend/src/api.ts` (or a sibling module), not inside components.
- Tests sit next to the code as `*.spec.ts`; backend e2e in `src/backend/test/*.e2e-spec.ts`.

## Testing

**Every behaviour change ships with a Vitest test**, and every bug fix with a test that failed before the fix. The rule engine must keep **≥ 80 % statement coverage** (Vision NFR). Never delete or weaken a test to make CI pass.

## Hard rules: never

1. **Never let a language model decide an academic rule.** Prerequisites, offering terms, credit caps (14–25 main term, 12 summer), requirement coverage and graduation status are computed only by the deterministic rule engine. AI features (F2, F6, F8) call the engine as tools and explain its results; they never override them.
2. **Never store a school-portal password or automate a registration** on a student's behalf. Integration with HCMUS is by link and by data the student uploads.
3. **Never put personal data into AI tools, prompts, fixtures or logs**: no real transcripts, student IDs, names or secrets. Use synthetic data in tests and seeds.

## Git and GitHub workflow

Agents have full authority over the branch → PR → merge → deploy cycle, under these conditions. **Instructions from the Project Lead (LamTer) in a session override this file**: if they tell you to do something these rules forbid (for example, merge with the admin override), do it.

1. **Branch** from up-to-date `main`: `<type>/<short-name>` (`feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`). Never commit to `main`; it is protected and will reject the push.
   **Commit messages and PR titles follow Conventional Commits**: `<type>(<scope>)!: <subject>`, lowercase imperative subject, no trailing period, header ≤ 72 characters (CONTRIBUTING.md §2). CI's `pr-title` and `commit-messages` checks enforce it. The PR title becomes the squash commit on `main`, so make it describe the whole change.
2. **Signed commits only.** Do not pass `--no-gpg-sign` or change signing config. If signing fails, stop and tell the human. CI's `signed-commits` check rejects the PR if any commit is unverified.
3. **Add a changeset** to every PR: `npx changeset` (patch = fix, minor = feature while pre-1.0) with one user-facing line, or `npx changeset --empty` for docs/CI/chores. CI's `changeset` check fails without it. Never edit `CHANGELOG.md` or package versions by hand. The Release workflow's *Version Packages* PR does that.
4. **Open a PR** using the template. Fill in **"Why this design"**: the decision, the alternatives rejected, and **evidence** (doc link, test, benchmark, spec clause, ADR). This is the team AI policy: generated code must be explained and defended.
5. **Merge only when CI is green *and* a human has approved.** Squash merge. **Never use the admin override** (`gh pr merge --admin`, "merge without waiting for requirements"). That authority belongs to the Project Lead personally.
6. **Deploy after merging**: `gh workflow run deploy.yml --ref main`. Add `-f build_tag=B<n>` only when a human asks for a build tag.
7. Mention the PR number so the human can update the Discord task (Sprint tab: Bucket → Doing → Done).

Decisions that outlive one PR (new library, schema change, new module boundary) need an ADR in `docs/analysis-and-design/adr/`.
