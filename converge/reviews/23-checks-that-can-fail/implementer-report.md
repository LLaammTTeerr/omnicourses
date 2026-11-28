'# Batch 23 report

## Commits
1. 499968f test: coverage glob gate. repo-config.spec.ts now imports the vitest config, requires each threshold glob to match a production .ts file (via fs.globSync), and requires every production file of src/rules to match one. Proved: key changed to src/rulez/** failed 2 tests; restored. docs/test/test-plan.md lines 33 and 154 corrected (check is enforced; deploy.yml deploys over SSH, main to production after CI, staging on push).
2. 1f5b30a test: frontend fetch calls checked against contract (+ empty changeset). New helper restoreMocksAfterCheckingCalls in src/frontend/src/testing/fetch.ts: checks every call recorded on the mocked fetch with contractHasRoute, then vi.restoreAllMocks(). Replaced vi.restoreAllMocks() in 17 specs. Proved: temporarily changed '\''/plans'\'' to '\''/no-such-route'\'' in plans/api.ts: plans/api.spec failed with "Call is not a route of openapi.json: GET /no-such-route"; restored.

## Part B left out (real drift)
New spec test/schema-drift.e2e-spec.ts failed on first run, so it was removed. createSchemaBuilder().log() up-queries for entity tables (36):
- DROP CONSTRAINT of FKs sessions_user_id_fkey (sessions), onboarding_answers_user_id_fkey, transcript_rows_user_id_fkey, ai_usage_user_id_fkey, guide_texts_guide_id_fkey, and ADD CONSTRAINT FK_085d540d9f418cfbdc7bd55bb19 (sessions.user_id -> users ON DELETE CASCADE), FK_761d44f7053ac408029c27498ef (onboarding_answers.user_id), FK_e2bbfff194abc104a13102ad5a3 (transcript_rows.user_id), FK_9e349c2c13d90da3c4112e37053 (guide_texts.guide_id -> guides): same FKs, but migration names differ from TypeORM'\''s generated names.
- DROP CONSTRAINT of CHECK constraints the migrations create and the entities do not declare: users (ck_users_email_lowercase, has_credential, deletion_pending, student_id); onboarding_answers (11: program_cohort, cohort_year, target_term, target_term_year, target_term_number, credits_per_term, internship_term, internship_term_year, internship_term_number, no_internship, finished); transcript_rows (7: course_code, credits, result, grade, grade_iff_graded, term_year, term_number); guides (ck_guides_id, ck_guides_group); guide_texts (lang, status, version).
Note ai_usage_user_id_fkey is dropped with no matching ADD (only the name differs or the entity lacks the FK). Project Lead decides schema changes. Step B3/B4 not done; the six filtered checks stay.

## Part C
Found 19 specs spying on fetch (not 16): account, admin, calendar, curriculum, guides, notifications, plans, sharing api specs; SignInView, onboarding/store; browser: App, Calendar, Guides, Notifications, Privacy, router, HomeView. Chose "keep recording, add check" for all (fewest lines).
Left out: src/api.spec.ts and src/auth/store.spec.ts: they test the generic request function with deliberately fake routes (/things, /x), rightly outside the contract; untouched. Nothing under dashboard/ touched (it has no direct fetch spies).
it(/expect( counts per file are unchanged:
| file | it( before/after | expect( before/after | restoreAllMocks->helper |
|---|---|---|---|
| account/api.spec.ts | 6/6 | 16/16 | 4 |
| admin/api.spec.ts | 10/10 | 28/28 | 1 |
| App.browser.spec.ts | 1/1 | 8/8 | 1 |
| auth/SignInView.spec.ts | 6/6 | 15/15 | 1 |
| calendar/api.spec.ts | 3/3 | 7/7 | 1 |
| calendar/Calendar.browser.spec.ts | 5/5 | 16/16 | 1 |
| curriculum/api.spec.ts | 4/4 | 8/8 | 1 |
| guides/api.spec.ts | 7/7 | 16/16 | 1 |
| guides/Guides.browser.spec.ts | 2/2 | 5/5 | 1 |
| notifications/api.spec.ts | 4/4 | 11/11 | 1 |
| notifications/Notifications.browser.spec.ts | 2/2 | 6/6 | 1 |
| onboarding/store.spec.ts | 7/7 | 22/22 | 1 |
| plans/api.spec.ts | 8/8 | 20/20 | 1 |
| privacy/Privacy.browser.spec.ts | 1/1 | 3/3 | 1 |
| router.browser.spec.ts | 3/3 | 18/18 | 1 |
| sharing/api.spec.ts | 5/5 | 20/20 | 1 |
| views/HomeView.browser.spec.ts | 5/5 | 12/12 | 1 |

## Look twice
- The helper checks globalThis.fetch.mock.calls, so it also covers calls recorded by mockApi in files that use both.
- AGENTS/docs search: nothing moved or renamed.

## Verify
PASS lint (5s)
PASS typecheck-be (24s)
PASS typecheck-fe (36s)
PASS unit-be (46s)
PASS unit-fe (73s)
PASS build-fe (4s)
PASS build-be (8s)
PASS openapi (5s)
PASS browser (16s)
PASS e2e (84s)
COUNTS unit-be=1227 unit-fe=1402 e2e=368 browser=68   (baseline 3c4da22: 1132 1246 364 68)
RESULT: ALL PASS (typecheck lint unit-be unit-fe build e2e openapi browser)'


## Review round

Blocking finding (auth/store.spec.ts unchecked) was right: 12 of 13 tests mock real routes. Fixed: the main describe afterEach now uses restoreMocksAfterCheckingCalls(); the /x requestAsUser/sendAsUser test moved unchanged into its own describe 'calls outside the contract' with vi.restoreAllMocks(). It is rightly outside the contract (deliberately fake route /x). Test count unchanged (18). All 12 checked calls passed the route check.

Non-blocking items left out: fetchHealth check, apiPath helper, hang(), threshold-key filter, widened-glob test, import order.

Verify: COUNTS unit-be=1227 unit-fe=1402 e2e=368 browser=68; RESULT: ALL PASS

