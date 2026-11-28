# 06-errors-and-limiter report

Commits (base e22e303):
1. refactor(backend): build every coded API error through common/api-errors.ts. Added codedError (general: used by forbidden, notFound, validationFailed, conflict and the four admin 400/413/415 builders) and forbidden. Replaced copies in notifications.service, audit.controller, admin-write.service, admin-errors. Key order kept (before/after the message). Lint rule coded-error-home in scripts/lint.mjs with tests; codedErrorHomes in scripts/layers.mjs.
2. refactor(auth): moved the limiter into auth/sign-in-limiter.ts (reserve, clear, purge), registered in AuthModule. PASSWORD_ATTEMPTS in rate-limits.ts is shared with PASSWORD_LIMIT. The three limiter test cases moved to sign-in-limiter.spec.ts with the same assertions (they wire a real AuthService to a real limiter over the fake repo); auth.service.spec.ts uses a stub limiter.
3. refactor(curriculum-admin): REFERENCES and COUNTED_REFERENCES moved unchanged to curriculum-admin/references.ts (no Nest/TypeORM imports); admin-errors.ts re-exports them. Changeset .changeset/06-errors-and-limiter.md (empty).

Left out: no 403 code for uncoded errors, no AdminErrorDto rename, ai/sse.ts untouched, createdAt guards and session lifetime untouched. No off-limits file touched. No docs named moved things, so none changed.

Look twice: the admin 400/413/415 builders now call codedError (they had to move their object literals, else the lint rule would flag them); signInAttemptKey stays in auth.service.ts to avoid an import cycle; the limiter's spec constructs AuthService.

Verify: RESULT: ALL PASS; COUNTS unit-be=1154 unit-fe=- e2e=365 (baseline 1132 - 364).

