# ADR 0001: Technology stack

- Status: accepted
- Date: 2026-10-20
- Deciders: Triết (Backend Lead), Hoà (Frontend Lead), Lâm (Project Lead)

## Context

The SDP (§4.3.3) fixes the core stack: PostgreSQL 18.6, NestJS 12.1.3 with Nest CLI 12.0.8 and Swagger 12.0.2, Vue 3.5.44, REST described by OpenAPI 3.2.0, Vitest 5.0.4, and Vite 8.3.4. This ADR records the supporting choices needed to make those versions work together, with the evidence for each.

## Decisions

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **Pin exact versions** (no `^`) for every dependency | Caret ranges | The SDP table is the submitted record. Exact pins keep the repo and the document in agreement, and every build is reproducible. Upgrades are explicit PRs. |
| **TypeScript 6.0.3**, not 7.x | TS 7.0.2 (latest) | `@nestjs/swagger@12.0.2` declares peer `typescript: ^5.5.0 \|\| ^6.0.0`, and `@nestjs/cli@12.0.8` depends on `typescript ~6.0.2` (`npm view … peerDependencies / dependencies`). |
| **Vitest for the backend too**, through `unplugin-swc` | Jest (Nest's default) | The SDP names Vitest as *the* test tool, and one runner means one config for the testers. Vite's esbuild transform drops `emitDecoratorMetadata`, which Nest DI needs. SWC emits it. `src/health/health.service.spec.ts` resolves `HealthService` through DI, which proves it works. |
| **TypeORM 1.1 + `pg`** via `@nestjs/typeorm` | Prisma, Drizzle, raw `pg` | `@nestjs/typeorm@12.0.2` supports Nest 12 and TypeORM 1.x (peer range). It keeps entities decorator-based like the rest of Nest. `synchronize: false`: schema changes go through migrations, because curriculum data is versioned per cohort (Vision §6). |
| **OpenAPI 3.2.0** via `DocumentBuilder.setOpenAPIVersion('3.2.0')` | Default 3.0.0 | The NFR "API contract published as OpenAPI 3.2.0" (Vision §6). Asserted by `src/bootstrap.spec.ts` and the e2e test against `/api/docs-json`. CI uploads `openapi.json` on every run. |
| **npm 11** (pinned in CI) | npm 10 bundled with Node 22 | `npm@10 install` crashes with `Cannot read properties of null (reading 'edgesOut')` in `loadPeerSet` on this dependency tree (reproduced 2026-10-20). npm 11.21.1 installs cleanly. |
| **Node 22 LTS** | Node 20, Node 24 | Vitest 5 requires `^22.12.0 \|\| ^24 \|\| >=26`, so Node 20 is out. Node 22 is the team's installed LTS. |
| **Postgres in CI as a service container**; local via `compose.yaml` (Podman or Docker) | SQLite for tests | Tests must hit the same engine and version as production. The e2e test asserts the server reports `18.x`. |
| **npm workspaces**, `src/backend` + `src/frontend` | Two repos, pnpm/turborepo | PA0 requires one repository with `/src`. Workspaces need no extra tool. |

## Consequences

- An upgrade (e.g. NestJS 12.2.0, Vitest 5.0.5, already published) is a deliberate PR that also updates the SDP table.
- Moving to TypeScript 7 waits for Swagger and the Nest CLI to support it.
