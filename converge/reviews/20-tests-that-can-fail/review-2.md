# Review round 2: batch 20, tests that can fail (cvb/20-tests-that-can-fail, 094ce47..2c1f6e2)

Verdict: approve. All three round-1 blocking findings are fixed, and the fix commit adds nothing else.

## Round-1 fixes
1. Final newlines: fixed. Every file in `git diff --name-only base..HEAD` now ends with a newline (checked with tail -c1). Under `git show -w`, commit 2c1f6e2 changes only two files, graduation.spec.ts and NotificationsView.spec.ts. The other 21 files in it get the newline and nothing else.
2. graduation.spec.ts:72: fixed. `expect(verdict.notChecked).toEqual(NOT_CHECKED_CONDITIONS)` is back, next to the new literal id list. Against base, the test now only gains assertions. Mutation: drop `description` from each notChecked object in graduation.ts. The test fails now.
3. NotificationsView.spec.ts:157-165: fixed. The push spy is back, with not.toHaveBeenCalled() before answer() and toHaveBeenCalledTimes(1) after it. The route-name checks sit beside them. Against base, the only change is two added lines. Mutation: call navigate() twice in NotificationsView.vue follow(). The test fails now.

## Blocking
None.

## Non-blocking
- The subject of 2c1f6e2 says "25 files", but the commit touches 23. It is only a wording slip, but a reader who counts will be confused. If the branch gets reworded anyway, change the subject to 23.
- The round-1 non-blocking notes still apply: curriculum-seed.e2e-spec.ts:257 could pin the exact rows, AccessAdmin.spec.ts:320 could assert the PUT path with the capitalised ID, and AppSidebar.spec.ts:43 depends on jsdom's default light theme.

## Checked
- No production file changed: `git diff --stat base..HEAD -- src ':!*.spec.ts' ':!*.e2e-spec.ts'` is empty. openapi.json, the migrations and package-lock.json are untouched. There is exactly one new changeset.
- All 8 commits are signed (G) and use Conventional subjects.
- Runs at HEAD: 9 changed backend unit specs, 90 passed. 13 changed frontend specs, 296 passed. 5 changed e2e specs against omnicourse_cv_be, 77 passed. Typecheck passed and lint passed.
- Mutations re-run against HEAD. Each test now fails, and each file was restored with git checkout at once. git status is clean afterwards.
  - The two restored assertions, as above.
  - FOR UPDATE removed from curriculum-admin.service.ts:84
  - MAX_SESSION_LIFETIME_DAYS 30 -> 28
  - IMPORT_JSON_LIMIT_BYTES 7 -> 8 MiB
  - UNREAD_POLL_MS 60000 -> 5000
  - OFFICIAL_NOTES_MAX_LENGTH 2000 -> 5000
- Scope: no off-limits file is touched.
