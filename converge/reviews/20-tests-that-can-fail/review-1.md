# Review round 1: batch 20, tests that can fail (cvb/20-tests-that-can-fail, 094ce47..bc22cd9)

Verdict: changes requested (3 blocking, all small).

## Blocking
1. Every changed spec file (27 files) lost its final newline ("\ No newline at end of file" in the diff). Each base version ended with a newline. .editorconfig says insert_final_newline = true. Fix: add the trailing newline back to every file in the batch. This is a whitespace-only change.
2. src/backend/src/rules/graduation.spec.ts:64. The test used to check verdict.notChecked deep-equal to NOT_CHECKED_CONDITIONS, so every field (id, description, status) of each returned object was checked. Now only the ids are checked. Example: graduationStatus maps the not-checked objects to {id, status} and drops the description. That passed nothing before and fails nothing now. The changed test asserts less than before. Fix: keep the new literal id list and also keep `expect(verdict.notChecked).toEqual(NOT_CHECKED_CONDITIONS)`, or assert every field as a literal.
3. src/frontend/src/notifications/NotificationsView.spec.ts:150-163. The push spy is gone, and with it `expect(push).toHaveBeenCalledTimes(1)`. A component that navigates twice after the read resolves (a double push to /audit) used to fail and now passes. Fix: keep `const push = vi.spyOn(router, 'push')` with not.toHaveBeenCalled / toHaveBeenCalledTimes(1), and add the two route-name assertions next to it.

## Non-blocking
- src/backend/test/curriculum-seed.e2e-spec.ts:257. `notes.length > 0` is the minimum guard. Pinning the exact rows (toEqual of N literal rows) would also catch a seeder that drops some of the groups.
- src/frontend/src/admin/AccessAdmin.spec.ts:320. The removal is justified (fetch had already been called by the loads). The scan offered a stronger alternative: assert the PUT path with the capitalised ID. That would pin the "typed in capitals" behaviour the title names. Consider it in a follow-up.
- src/frontend/src/shell/AppSidebar.spec.ts:43. 'Giao diện tối' depends on jsdom's default theme being light, which the implementer also flagged. It is stable today, but a test-local theme setup would make that dependency explicit.
- src/backend/test/public-routes.e2e-spec.ts:82. It now calls every non-GET route without a token, which is the right fix. It partly overlaps the "answers 401" test at :66, which is fine.

## Checked
- Behaviour: no production file changed. `git diff --stat base..HEAD -- src ':!*.spec.ts' ':!*.e2e-spec.ts'` is empty.
- Contract: openapi.json, migrations and package-lock.json are untouched.
- Every changed test, compared line by line with the base. All of them are equal or stronger, except the two blocking ones above. plans.service, auth revoke/delete, users, sharing, curriculum e2e, academic-calendar, plan-sharing (spy kept, body assertion added) and unread-polling (also adds a 59_999 ms negative check) are strictly stronger.
- Removals: sign-in-limiter class-name assertion (fails only on a rename); AccessAdmin:320 and CurriculumAdmin:1066 expect(fetch).toHaveBeenCalled (always true by then); AuditView teardown test (no production code involved; ORIGINAL_SCROLL is still used at :285); nav.spec "lists each page once" (the literal ordered list at :18 already fixes the routes, each once); phone.every(Boolean) (the next line throws on undefined). All justified.
- Runs: lint passed. Typecheck passed in both workspaces. 9 backend unit specs: 90 passed. 13 frontend specs: 296 passed. 5 changed e2e specs against omnicourse_cv_be: 77 passed.
- Mutations re-run against the new tests. Each now fails, and each file was restored at once; git status is clean afterwards:
  - FOR UPDATE removed from curriculum-admin.service.ts:84
  - MAX_SESSION_LIFETIME_DAYS 30 -> 28
  - IMPORT_JSON_LIMIT_BYTES 7 -> 8 MiB
  - UNREAD_POLL_MS 60000 -> 5000
  - OFFICIAL_NOTES_MAX_LENGTH 2000 -> 5000
  - MAX_INTEGER -> 1e9
  - METER_HEADROOM_CREDITS 6 -> 8
- Completeness against tests-scan.md: every non-dashboard, non-Unsure, non-catalogue finding is handled. api.spec.ts REQUEST_TIMEOUT_MS was skipped with a sound reason: no title or document states the number.
- Repo rules: no comments added, no new dependency, literals sit under named constants, all 7 commits are signed (G) with Conventional subjects and per-area test counts, and there is exactly one new empty changeset.
- Scope: no off-limits file touched.
- The implementer's report was read after these findings were written. It matches the diff, and it does not mention the two lost assertions or the newline loss.
