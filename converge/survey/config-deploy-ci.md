# Survey of four surfaces (read-only)

Worktree: .claude/worktrees/cv-stack, branch refactor/cv-21-structure-adr. Nothing was edited, installed or run.
Tags: [agent] = an agent can do it without a decision. [decision: Lead] = touches .github/ or deploy/, the Project Lead's.

## 1. Configuration and environment variables

Model:
- One owner: src/backend/src/config/env.ts, 13 variables read through getters (the frontend reads VITE_API_URL once, src/frontend/src/api.ts:6).
- scripts/lint.mjs:136 (no-direct-process-env) forbids process.env anywhere else in the backend. The owner is enforced.
- Copies of the list: .env.example (all 13 except NODE_ENV), deploy/server/setup.sh:71-80 (writes the server env file), deploy/server/omnicourse-deploy (VITE_API_URL=/api at build), architecture.md and ADRs (mention a few names and defaults).
- Defaults live in env.ts and are repeated as values in .env.example (PORT 3000, CORS, TTL 7, grace 30, AI timeout 30000, daily calls 20); the API URL default is in api.ts and .env.example.
- No check ties env.ts to .env.example. repo-config.spec.ts exists and reads repo files, but only checks compose ports.

Findings (2):

1.1 [agent] .env.example can drift from env.ts silently.
- Fix: one unit test in repo-config.spec.ts that lists the names read in env.ts and the keys in .env.example (commented ones included) and fails on any difference, plus equal defaults for the integer settings.
- Evidence: env.ts:16-63 (names and defaults), .env.example:1-23, repo-config.spec.ts:1-14 (only compose.yaml). NODE_ENV is read at env.ts:44 and is not in .env.example. A new setting needs a line there by memory only.
- Cost today: each new variable is edited in 2-3 places by hand; nothing fails if one is forgotten.
- Change: add a describe('.env.example') block to src/backend/src/repo-config.spec.ts. Write scope: that one file. Exempt NODE_ENV in a named constant (set by the host, not by developers).
- Effort S. Risk low (test only). Confidence high.
- Proof: npm test -w src/backend passes; remove one line from .env.example, the test fails.
- Decision: none.

1.2 [decision: Lead] The server env file is a third list, and the AI variables are provisioned nowhere.
- Fix: say in deploy/README.md how OPENROUTER_API_KEY, AI_MODEL_STRUCTURED and AI_MODEL_CHAT reach /etc/omnicourse/<env>.env, and decide whether setup.sh should add new keys to existing files.
- Evidence: setup.sh:63-80 writes the file only when it does not exist, with 6 keys; grep for OPENROUTER and AI_ in deploy/ and README.md finds nothing. So an existing host never gets a new variable from a re-run, and the AI routes answer 503 ai_unavailable until someone edits the file by hand (the behaviour is by design, ADR 0003, but the step is undocumented).
- Cost today: each new required production setting is a manual host edit that no file records.
- Change: a paragraph in deploy/README.md "The host" (doc only), optionally an "append missing keys" loop in setup.sh. Write scope: deploy/README.md, deploy/server/setup.sh.
- Effort S (doc) / M (script). Risk low / medium (touches the host script). Confidence medium: the key may be documented in a private place I cannot see.
- Proof: doc review; for the script, run setup.sh on a scratch host and diff the env file.
- Decision: Lead (deploy is theirs).

Looked at and left alone: env.ts itself (small getters, blank and invalid values fall back, TRUST_PROXY boolean warning); env.spec.ts (135 lines, covers loading order and each getter); compose.yaml credentials (loopback only, already tested); VITE_API_URL (one reader, one build-time override); no variable is documented but never read (all 13 are read).

## 2. Dependency management

Model:
- Three package.json (root, backend, frontend), one package-lock.json, npm workspaces, changesets with the two workspaces fixed to one version.
- A node one-liner over all three files shows every dependency and devDependency is an exact x.y.z. AGENTS.md rule holds today.
- Runtime pins repeated by hand: Node 22.22.1 in .nvmrc, setup.sh:11, AGENTS.md:11, deploy/README.md:39; npm 11.21.1 in ci.yml:20, release.yml:18, setup.sh:12, AGENTS.md:11,144; PostgreSQL 18.6 in compose.yaml:4, ci.yml:115, setup.sh:13, README.md:73, deploy/README.md:40.
- CI installs from the lockfile with npm ci (fails by itself if lock and package.json differ). Root engines is ">=22.12.0" and ">=11.0.0", a floor, not the pin.
- Only the frontend and backend versions are checked (changesets fixed group); no check on the pins above.

Findings (2):

2.1 [agent] The runtime pins (Node, npm, PostgreSQL) have no check and live in 4-5 places each.
- Fix: one unit test that reads .nvmrc, setup.sh (NODE_VERSION, NPM_VERSION, PG_IMAGE), compose.yaml, ci.yml and release.yml (NPM_VERSION, postgres image) and AGENTS.md line 11, and fails when two values differ.
- Evidence: the lines listed above. Nothing compares them; a Node bump in .nvmrc leaves the server on the old Node (setup.sh:11) and CI runs a different one from production.
- Cost today: a version bump is 5 files found by grep; a missed copy shows up only as a production-versus-CI difference.
- Change: add a describe('pinned runtimes') block to src/backend/src/repo-config.spec.ts. It only reads .github/ files; it edits none. Write scope: that one file. If it finds an existing mismatch I did not see, fixing the mismatch in .github/ or deploy/ is the Lead's.
- Effort S. Risk low. Confidence high.
- Proof: test passes on the current tree (I saw all copies equal); change one copy in a scratch checkout and it fails.
- Decision: none for the test; Lead for any later edit in .github/ or deploy/.

2.2 [agent] The exact-pin rule has no guard.
- Fix: a unit test (or a lint rule in scripts/lint.mjs) that fails when a dependency version in any of the three package.json is not x.y.z.
- Evidence: no .npmrc with save-exact, no lint rule for it (scripts/lint.mjs has no package.json check); the rule lives only in AGENTS.md:11. It holds today by discipline. AGENTS.md also writes "TypeORM 1.1" while package.json has 1.1.2 (src/backend/package.json), a prose-only copy.
- Cost today: one `npm i` without -E adds a caret and nobody notices until a lockfile change.
- Change: a block in repo-config.spec.ts using the same read helper, or an .npmrc with save-exact=true (a one-line file; also needs the Lead's nod because it changes everyone's npm behaviour). Write scope: repo-config.spec.ts.
- Effort S. Risk low. Confidence high.
- Proof: the test passes now; add a "^" in a scratch copy and it fails.
- Decision: none for the test.

Looked at and left alone: lockfile policy (npm ci in every job, version-packages regenerates the lock with --ignore-scripts, scope job in ci.yml:67-90 checks a version PR touches only version lines); changesets config; engines floor (cosmetic).

## 3. Build, deployment and CI

Model:
- ci.yml: changeset check, signed-commits, scope, backend (typecheck, unit, build, e2e, openapi export), frontend (lint, typecheck, unit, browser, build). release.yml: Version Packages PR. deploy.yml: pick environment, ssh to the forced-command script, tag. reset-staging.yml: reset staging every other day.
- Server side: deploy/server/omnicourse-deploy (build, backup, migrate and seed, switch, health check, roll back), omnicourse-root (the two sudo helpers), setup.sh (one-time host setup), systemd units, nginx site.
- Locally: npm run verify = lint, typecheck, unit tests, build for both workspaces. Not covered locally by one command: e2e (needs db), browser tests, changeset check, signed-commits check, pr-title check.
- No dead script: root and workspace scripts are each called by a doc, a workflow or a test (checked db:*, admin:bootstrap, regulations:extract, test:live, openapi).
- No Dockerfile or Procfile.

Findings (3), all [decision: Lead]. I do not propose agent edits to .github/.

3.1 [decision: Lead] Environment facts are written in three places with no check: port, host, branch.
- Fix: keep one table (setup.sh ENVS is the natural owner) and add a repo-config.spec.ts check that the deploy script, setup.sh, deploy.yml URL and deploy/README agree.
- Evidence: ports 3101/3102 at omnicourse-deploy:18-19 and setup.sh:19 (and nginx via setup.sh sed), deploy/README.md:42,86,95; host names at setup.sh:19 and deploy.yml:75; branch main/staging at omnicourse-deploy:18-19 and deploy.yml:55-60.
- Cost today: moving a port or a host is 4 files; nginx and the deploy health check would silently look at different ports (the deploy would roll back, so it fails loudly but late).
- Change: a read-only test is agent work only if the Lead agrees that tests may read deploy/ and .github/ (2.1 does the same). Write scope: repo-config.spec.ts.
- Effort S. Risk low. Confidence medium.
- Proof: test passes today; change a port in one file in a scratch copy and it fails.
- Decision: Lead (deploy is theirs).

3.2 [decision: Lead] The setup block (checkout, setup-node, npm@11 install, npm ci) is repeated in three jobs, and NPM_VERSION in two workflows.
- Fix: a composite action .github/actions/setup-npm used by all three jobs, with NPM_VERSION read from one place.
- Evidence: ci.yml:128-133, ci.yml:152-156, release.yml:28-33; NPM_VERSION at ci.yml:20 and release.yml:18 (and setup.sh:12).
- Cost today: an npm bump is 3 edits in .github/ plus setup.sh; a missed one means CI and Release use different npm (2.1's test would catch it).
- Change: new .github/actions/setup-npm/action.yml and 3 call sites. Write scope: .github/.
- Effort M. Risk medium (a CI change cannot be tested except by a PR; a broken composite action blocks every merge). Confidence high.
- Proof: open a PR from a branch; all required checks run the same steps and pass.
- Decision: Lead. Do not do this as agent work. With 2.1 in place the duplication is guarded, so the refactor is optional.

3.3 [decision: Lead] The one command a developer runs locally is a subset of CI, and AGENTS.md says "what CI runs".
- Fix: either say plainly in AGENTS.md which CI steps verify skips (e2e, browser, changeset, signed commits, pr-title), or add root scripts test:e2e and test:browser aliases so the list in AGENTS.md:15-23 is all one-word commands.
- Evidence: package.json:12-19 (verify has no e2e or browser; test:browser exists at root, test:e2e does not), AGENTS.md:18 comment "what CI runs without the database and browser jobs" already says part of it; ci.yml:157 runs lint only in the frontend job, so a backend-only failure of lint is reported by the frontend job.
- Cost today: low. A developer needs to know -w src/backend for e2e. This is the weakest finding; I would not spend a day on it.
- Change: add one root script "test:e2e": "npm run test:e2e -w src/backend" (package.json, not .github/). Effort S. Risk low. Confidence medium.
- Proof: npm run test:e2e with the database up runs the same suite as CI.
- Decision: Lead only for moving lint into its own CI job; the root alias is an agent change.

Looked at and left alone: deploy script (flock per env, ancestor check, backup before migrate, health check and rollback; sound); setup.sh idempotence and hash-checked Node download; nginx site CSP script hashes are already checked by lint.mjs:211; systemd units (hardened, no duplicates); reset-staging and conventions workflows; the changeset and signed-commit steps in ci.yml (long inline shell, but each runs once and is commented).

## 4. Logging and background work

Model:
- Failures are logged with Nest Logger; the shared helper is common/failure-kind.ts: failureKind (class name plus SQLSTATE, never the message), failureStack, logFailure(logger, line, error).
- Three recurring jobs: account purge (hourly setInterval, account-purge.service.ts:17-21), notifications (self-rescheduling setTimeout, 10-minute cap and Vietnam midnight, notification-schedule.ts:25-45), sign-in attempt purge (no timer: runs after every reserve(), sign-in-limiter.ts:33,40, 100 rows per call).
- Also a lazy "create due notifications before a read" path with its own throttled log (notifications.service.ts:116-136).
- Callers of logFailure: account-purge.service.ts and notification-schedule.ts. Others use failureKind directly (ai-cost-guard, gateway-llm, openrouter-model.client, notifications.service).
- Entry-point scripts (migrate.ts, seed.ts, bootstrap-cli.ts) use console.error.

Findings (2):

4.1 [agent] notifications.service.ts re-implements logFailure's stack branch.
- Fix: have NotificationsService.logFailure call logFailure's stack branch through a shared helper, or export a small logLine(logger, line, stack) from failure-kind.ts and use it in both.
- Evidence: failure-kind.ts:44-48 (stack ? error(text, stack) : error(text)) and notifications.service.ts:134-135 (identical if/else); the service also calls failureKind and failureStack separately at :85-86 and :119.
- Cost today: a change to how a stack is logged (for example redaction) must be made in two places; the second is easy to miss.
- Change: export logLine(logger, line, stack?) from failure-kind.ts, call it from logFailure and notifications.service.ts:134-135. Write scope: failure-kind.ts, notifications.service.ts, failure-kind.spec.ts.
- Effort S. Risk low. Confidence high.
- Proof: failure-kind.spec.ts and the notifications unit and e2e tests pass unchanged; logged text identical.
- Decision: none.

4.2 [decision: Lead, low severity] migrate.ts prints the whole error object, in a place that ends up in a public log.
- Fix: print failureKind(error) (as seed.ts and logFailure do for messages) instead of the full error, or confirm the exposure is acceptable.
- Evidence: database/migrate.ts:11 console.error(error) versus seed.ts:17 (message only) and the rule in AGENTS.md ("never log a provider error message"). deploy/server/omnicourse-deploy runs migrate.js over the forced-command SSH and the output returns to the Actions log of a public repository. A TypeORM QueryFailedError carries the SQL and its parameters.
- Cost today: low. Migrations rarely have parameters. Only a failing deploy shows it.
- Change: one line in migrate.ts, but a developer also loses the stack when the migration fails locally, so keep failureStack. Write scope: src/backend/src/database/migrate.ts.
- Effort S. Risk low. Confidence low on severity (I did not check what a migration failure prints).
- Proof: force a failing migration on a scratch database, compare the output.
- Decision: Lead (it is a trade between debugging and what the deploy log shows).

Looked at and left alone: the two timers (setInterval versus a self-rescheduling setTimeout are different on purpose: one is fixed hourly, one lands on Vietnam midnight; both unref the timer, stop in onModuleDestroy, and swallow and log errors, so a shared helper would have two callers and hide the difference); the sign-in attempt purge running inside reserve() (bounded to 100 rows, uses SKIP LOCKED; expired rows of an idle system stay until the next sign-in, which I judged a retention question, not a defect: the rows hold a key and a time only); failureKind/isRefusal (small, tested, used consistently); the notification read-failure throttle (specific, tested); frontend failureKind in api.ts (a separate function for the browser with different kinds).
