# Batch 20: tests that can fail

Production code unchanged. Format per line: file:line | mutation | survived before | caught after | action.

## Backend unit (commits 4078b94, 0be9eb0, e931ed9)
- auth.service.spec.ts:240-256,274-292 | MAX_SESSION_LIFETIME_DAYS 30 -> 28 | yes | yes | rewritten (THIRTY_DAYS_MS literal)
- auth.service.spec.ts:295-299 | revoke without { revokedAt } | yes | yes | rewritten (full update arguments)
- auth.service.spec.ts:106-114 | expiry clean-up with MoreThan instead of LessThanOrEqual | yes | yes | rewritten (delete arguments)
- curriculum-admin.dto.spec.ts:34-42 | MAX_INTEGER 2147483647 -> 1e9 | yes | yes | rewritten (INT4_MAX literal)
- curriculum-admin.dto.spec.ts:45-66 | OFFICIAL_NOTES 2000 -> 5000, CONFIRM_IMPACT 128 -> 256 | yes | yes | rewritten (literals 2000, 128). REVIEW_VERSION table entry now literal too (not mutated separately).
- import-body-limit.spec.ts:78-97,119,133 | IMPORT_JSON_LIMIT_BYTES 7 MiB -> 8 MiB / 7 MiB - 1 | partly (8 MiB was already caught by the literal 413 message; the boundary bodies scaled and passed) | yes | rewritten (SEVEN_MIB literal). Report was partly wrong for 8 MiB.
- graduation.spec.ts:64 | not-checked id renamed | yes | yes | rewritten (literal ids)
- plans.service.spec.ts:62 | slotCredits dropped from inserted rows | yes | yes | rewritten (full rows)
- plans.service.spec.ts:84 | duplicate message reworded | yes | yes | rewritten (regex on the message)
- sign-in-limiter.spec.ts:230 | none (class name) | n/a | n/a | removed assertion and unused import: it fails only if the class is renamed
- curriculum-admin.service.spec.ts:44 | FOR UPDATE removed | yes | yes | rewritten (index >= 0 first)
- users.service.spec.ts:53 | findByEmail returns null | yes | yes | rewritten (resolves value)
- users.service.spec.ts:83 | create returns unsaved entity and does not await save | yes | yes | rewritten (save argument and result)
- sharing.service.spec.ts:184 | delete from another entity | yes | yes | rewritten (PlanShare)

## Backend e2e (commit af7b16d)
- academic-calendar.e2e-spec.ts:256 | updated_at stops updating | yes | yes | rewritten (strict >)
- curriculum-seed.e2e-spec.ts:253-257 | seeder removes the groups | reasoned yes (not run: no cheap mutation) | reasoned yes | rewritten (length guard added)
- curriculum.e2e-spec.ts:164-170 | course credits answered as 0 | yes (for this test; another test caught it) | yes | rewritten (MTH251, 4)
- public-routes.e2e-spec.ts:82-84 | @Public() on POST /auth/refresh | yes (test 66 caught it, not this one) | yes | rewritten (derived from served routes)
- plan-sharing.e2e-spec.ts:541-563 | transcript never read for a reader | no (the spy caught it) | yes | strengthened (body assertion on already_passed; spy kept)

## Frontend admin (commit bf330e5)
- AccessAdmin.spec.ts:320 | none | n/a | n/a | removed: fetch was already called by the test's own loads
- CurriculumAdmin.spec.ts:1066 | none | n/a | n/a | removed: same

## Frontend rest (commit d2476e7)
- AuditView.spec.ts:304 | none | n/a | n/a | removed: tests the spec's own teardown
- groups.spec.ts:17 | glyph swapped, short name changed | yes | yes | rewritten (literal table)
- unread-polling.spec.ts:37 | UNREAD_POLL_MS 60000 -> 5000 | yes | yes | rewritten (ONE_MINUTE_MS, plus a ONE_MINUTE_MS - 1 check)
- NotificationsView.spec.ts:150 | link follows to the wrong route | yes | yes | rewritten (route name before and after)
- PlanEditorView.spec.ts:1205 | MAX_PLAN_TERMS 30 -> 31 | yes | yes | rewritten (PLAN_TERM_CAP literal)
- board.spec.ts:48 | termsBetween end term dropped | caught by the literal tests above it and by this one before and after | yes | rewritten (literal terms); report claim of survival not reproduced
- issue-view.spec.ts:11 | METER_HEADROOM_CREDITS 6 -> 10 | yes | yes | rewritten (78.57 and 89.29)
- sharing/view.spec.ts:161 | no demonstrable mutation: the only other table holds functions, so any switch fails before and after | n/a | n/a | rewritten (literal English titles)
- AppSidebar.spec.ts:43 | theme title text changed | yes | yes | rewritten ('Giao diện tối')
- nav.spec.ts:38 | none | n/a | n/a | removed: the literal list at :18 already fixes the routes once each
- nav.spec.ts:42-47 | none | n/a | n/a | removed phone.every(Boolean) only (the next line throws on undefined); kept toHaveLength(4)
- paste.spec.ts:169 | header line reason changed to 'columns' | yes | yes | rewritten ('term')

## Left out
- api.spec.ts:93-130 (REQUEST_TIMEOUT_MS): skipped, no title or document states the number (ADR 0003 is the backend AI timeout); the tests mean "default applied".
- Left by design: SettingsView.spec.ts findings (message catalogue, PR #199); all src/frontend/src/dashboard/*.spec.ts findings (DashboardView.spec.ts:155-160, 187-193, 277-282, dashboard.spec.ts:100) for the frontend owner; all "Unsure" items.
- Docs: nothing moved or renamed, no doc change.

## Look twice
- public-routes.e2e-spec.ts:82 now calls every non-GET route without a token.
- import-body-limit: the 8 MiB mutation was already caught by the message literal.
- AppSidebar literal depends on the default theme being light in jsdom.
