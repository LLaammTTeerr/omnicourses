# Test

Test plan, test cases and test reports. Automated tests live next to the code (`*.spec.ts`, `src/backend/test/*.e2e-spec.ts`) and run in CI on every pull request.

See [Test plan v2](test-plan.md) for B0 carry-over, B1–B3 checks, performance measurements and acceptance criteria. It is a plan for review, not a report that the builds have passed. [B0 detailed cases](test-cases-b0.md) retain their existing IDs; Dũng expands the later-build checks into detailed cases and execution reports. The [B0 test report](report-b0.md) records what happened to each B0 case.

See [Browser tests](browser-tests.md) for Chromium installation, run commands, smoke-test scope and the pending real-API sign-in journey.

[B1 detailed cases](test-cases-b1.md) expand the test plan's USER-01, GUIDE-01, PERF-01 and A11Y-01 checks; the other B1 checks are added with their owners' expected results. The [B1 test report](report-b1.md) records what happened to each B1 case and to the B0 cases run again on B1.

[B2 detailed cases](test-cases-b2.md) hold the B2 checks, the B1 regression run on B2 and the retests of B1 defects; each case says whether it is written, blocked or not started. The [B2 test report](report-b2.md) records the B2 runs and lists what is still to run.

The test plan and the reports are dated records. What is built today is in the [README feature table](../../README.md#what-is-built).

## Evidence policy

- **Automated regression checks belong in Vitest, not in `docs/test/evidence/`.** New repeatable checks must be written as permanent Vitest suites next to the code (`src/**/*.spec.ts` for unit and component tests, `src/backend/test/*.e2e-spec.ts` for API and database tests, and `src/frontend/src/**/*.browser.spec.ts` for Chromium layout and keyboard tests) so CI enforces them on every pull request. Do not add ad-hoc `.mjs` or `.sh` driver scripts or raw console dumps to Git as a substitute for test suites.
- **Keep committed evidence curated and immutable.** `docs/test/evidence/<build>/` stores only dated milestone acceptance summaries (`results-<date>.md`), versioned benchmark fixtures (such as `perf-01-plan.json`), and concise screenshots or measurements cited by a build report (`report-b0.md` to `report-b3.md`).
- **No retry noise, mutable state, or sensitive values.** Never commit aborted or duplicate retry outputs (`*attempt1*`, `*aborted-run*`), mutable run-state files (`*.state.json`, ignored in `.gitignore`), bearer tokens, password hashes, or personal student data (AGENTS.md hard rule 3).
