# OmniCourse

One page for everything school related at HCMUS: degree audit, curriculum explorer, semester roadmap planner, an AI planner and advisor, and the exact links and steps for the school tasks the app does not perform itself. The first release covers the Advanced Program in Computer Science (APCS).

Course project, Elements of Software Engineering, 5 Oct – 13 Dec 2026. The repository is maintained by LamTer (Project Lead).

## Stack

All versions are pinned exactly, matching the Software Development Plan v1.0 (§4.3.3).

| Layer    | Technology                    | Version                   |
| -------- | ----------------------------- | ------------------------- |
| Database | PostgreSQL                    | 18.6                      |
| Backend  | NestJS / Nest CLI / Swagger   | 12.1.3 / 12.0.8 / 12.0.2  |
| Frontend | Vue                           | 3.5.44                    |
| API      | REST, described by OpenAPI    | 3.2.0                     |
| Tests    | Vitest                        | 5.0.4                     |
| Build    | Vite                          | 8.3.4                     |

Supporting choices (TypeScript 6.0.3, TypeORM, npm 11, Node 22) and the reasons for them are in [ADR 0001](docs/analysis-and-design/adr/0001-technology-stack.md).

## Repository layout

```
src/backend/                NestJS REST API (+ Swagger UI at /api/docs)
src/frontend/               Vue 3 + Vite single-page app
docs/management/            Project plan, weekly reports, meeting notes
docs/requirements/          Vision document, use-case model and specifications
docs/analysis-and-design/   Architecture, models, UI design, ADRs
docs/test/                  Test plan, test cases, test reports
pa/                         Assignment submissions (PA0 … PA5)
```

Documents are written in Markdown and exported to .docx only for submission.

## Versioning

[Semantic versioning](https://semver.org) with [Changesets](https://github.com/changesets/changesets). Backend and frontend share one version (a `fixed` group). Each PR adds a changeset. On merge, the Release workflow opens a **Version Packages** PR that bumps the version and writes `src/*/CHANGELOG.md`. Merging that PR is the release.

## Run it locally

Requirements: Node 22.12+, npm 11 (`npm i -g npm@11`), and Podman or Docker.

```bash
cp .env.example .env
npm install
npm run db:up            # PostgreSQL 18.6 on localhost:5432
npm run build -w src/backend && npm run db:migrate -w src/backend
npm run dev:backend      # http://localhost:3000/api, Swagger at /api/docs
npm run dev:frontend     # http://localhost:5173
```

Checks (the same ones CI runs):

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e -w src/backend    # needs the database
```

## Rules for changing `main`

1. **No direct pushes.** Every change arrives as a pull request.
2. **CI must pass**: the `changeset`, `signed-commits`, `pr-title`, `commit-messages`, `backend` and `frontend` checks.
   PR titles and commit messages follow [Conventional Commits](CONTRIBUTING.md#2-branches-commit-messages-and-pr-titles).
   Every PR includes a [changeset](.changeset/README.md) (`npx changeset`, or `npx changeset --empty` when nothing ships).
3. **Every commit is signed** (SSH or GPG) and shows *Verified* on GitHub. The `signed-commits` check verifies every commit in the PR, because the squash commit GitHub creates on `main` is always signed by GitHub itself.
4. **At least one approving review** from another member. New pushes dismiss earlier approvals.
5. **After approval, the author merges and deploys** (Actions → Deploy → Run workflow).

These rules are enforced by two rulesets on `main`. `protect-main` (pull request, CI, signed commits, no force-push or deletion) has no bypass for anyone. `require-approval` (rule 4) can be bypassed only by the repository admin (LamTer, Project Lead), and only when merging a pull request: the admin can merge their own or anyone's PR without an approval, but still never pushes to `main` directly or merges with red CI. Review duty follows the workstream: the Frontend Lead reviews frontend work, the Backend Lead reviews backend work, and the Project Lead reviews data-model and rule-engine changes. Builds B0–B3 are tagged.

The workflow end to end (Discord tasks, branches, signing, review) and the AI policy are in **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Team

| Member                 | Role                        |
| ---------------------- | --------------------------- |
| Phan Bình Nguyên Lâm   | Project Lead, Developer     |
| Lê Hữu Hoà             | Frontend Lead, Developer    |
| Võ Nguyễn Minh Triết   | Backend Lead, Developer     |
| Nguyễn Anh Dũng        | Developer, Tester           |
| Nguyễn Hữu Quốc Thắng  | Developer, Tester           |
