# Test

Test plan, test cases and test reports. Automated tests live next to the code (`*.spec.ts`, `src/backend/test/*.e2e-spec.ts`) and run in CI on every pull request.

See [Test plan v2](test-plan.md) for B0 carry-over, B1–B3 checks, performance measurements and acceptance criteria. It is a plan for review, not a report that the builds have passed. [B0 detailed cases](test-cases-b0.md) retain their existing IDs; Dũng expands the later-build checks into detailed cases and execution reports. The [B0 test report](report-b0.md) records what happened to each B0 case.

See [Browser tests](browser-tests.md) for Chromium installation, run commands, smoke-test scope and the pending real-API sign-in journey.

[B1 detailed cases](test-cases-b1.md) expand the test plan's USER-01, GUIDE-01, PERF-01 and A11Y-01 checks; the other B1 checks are added with their owners' expected results.

[Advisor red team](advisor-red-team.md) records the adversarial test of the F8 advisor harness: 81 attacks, how each one ended, the fixes and the residual risks. Its replies run in CI as `src/backend/src/advisor/red-team/red-team.spec.ts`.
