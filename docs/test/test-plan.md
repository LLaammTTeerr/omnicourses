# Test plan v2: Elaboration and Construction

- Owner: Thắng
- Version: 2.0, 1 November 2026; extends version 0.2 (29 October)
- Status: ready for team review for PA3; a plan, not a test report or build approval
- Covers: B0 carry-over, B1 (15 November), B2 (29 November), B3 (13 December 2026)
- Reviewers: Dũng for cases and reports, Triết for academic results and data, Hoà for browser journeys, Lâm for scope and acceptance

## 1. Purpose

This plan defines the checks and evidence needed to accept B1 and the Construction builds B2–B3. It retains B0 cases and their historical exceptions so unfinished checks cannot disappear. Thắng owns the plan, shared test tools and acceptance findings. Dũng expands the checks into detailed cases, runs regression and writes reports. Feature owners implement their tests and fix defects. Lâm decides whether to accept a build and approves any scope exception.

Version 2 adds audit, planner and administration checks across B1–B3, repeatable performance measurements, and a B1 acceptance window of **13–15 November**. It updates the implementation baseline and uses Vision v2 for the NFRs. It does not implement the cases, approve proposed ADRs or certify academic data.

### Sources and branch review

The review used `main` at **20a0e60** and remote branch heads fetched on **1 November 2026**. Links below pin unmerged sources so a later branch edit cannot silently change this plan's basis. A merged file may still say **proposed** or **draft**; merging alone is not evidence that its decisions were accepted.

| Source reviewed | State at review | Use in this plan |
| --- | --- | --- |
| [Vision v2, §5–6](../../report/assignments/PA2/Vision.tex), [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), [GLOSSARY.md](../../GLOSSARY.md) | On `main`; Vision revision 1 November | Feature scope, NFR targets, ownership and vocabulary. |
| [SDP v2, §4.2.1–4.2.3][sdp], branch `docs/sdp-v2`, PR #20, `1e8d8c4` | Open draft | Build dates and handoffs. Curriculum administration is B2. Specific agreed guide batches in UC-10 refine the broad B3 guides release row. |
| [UC-01][uc01], [UC-02][uc02], [UC-07][uc07], branch `docs/use-cases-lam`, PR #16, `9d1f13b` | Open drafts | Onboarding, transcript review/import and plan generation. Unconfirmed limits and timeout behavior are tracked in §8. |
| [ADR 0005][schema], branch `feat/db-course-info-schema`, PR #23, `d4125b2` | Open; ADR proposed | Programs, cohorts, shared catalog and group links. Does not provide prerequisite/offering-term storage. |
| [Seed data and tests][seeds], branch `feat/apcs-seed-data`, PR #36, `4ad5b83` | Open, based on #23 | APCS 2024/2025 and CLC data; reviewed data versus metadata the schema cannot yet load. Seed presence is not proof of complete rule coverage. |
| [ADR 0006][generator], branch `docs/plan-generator-adr`, PR #27, `58cbca8` | Open proposal | Deterministic generation, cancellation and timeout questions. Its 30-second plan-generation wording needs reconciliation with Vision v2. |
| [UC-08](../requirements/use-cases/UC-08-ask-the-advisor-chat.md), [UC-09](../requirements/use-cases/UC-09-share-or-export-a-plan.md), [UC-10](../requirements/use-cases/UC-10-follow-a-school-task-guide.md), [UC-11](../requirements/use-cases/UC-11-maintain-curriculum.md), [guides plan](../requirements/guides-plan.md) | On `main`; use cases remain drafts with dated decisions | Advisor, sharing, guides and proposed F12 permissions. `docs/guides-plan` has no further content difference from `main`. |
| [ADRs](../analysis-and-design/adr/) 0002–0004 and 0010; 0007–0009 | First set accepted; 0007–0009 still marked proposed, with transcript code and browser harness merged | Authentication, AI boundaries, export/purge, browser tests, public reads, transcript and term contracts. |

The inventory also covered `docs/uc-01-sequence-diagrams` (#22), `docs/weekly-report-week-3` (#18), `docs/weekly-report-week-4` (#35) and `changeset-release/main`. These provide diagrams, historical progress or release metadata, not additional acceptance commitments. The local coverage branch has already landed as #45. There is no audit, rules, plans or F12 administration implementation in the reviewed feature branches. UC-03–UC-06 are referenced by the requirements but their detailed specifications were not present in the reviewed refs; use Vision and reviewed academic examples until the owners supply them.

At this baseline, authentication, account export/deletion, the AI gateway, transcript storage/API, the public-route guard test and browser smoke harness are merged. The backend `test` script runs coverage with an 80% statement threshold for `src/backend/src/rules/**`, configured as `src/rules/**` in [vitest.config.mts](../../src/backend/vitest.config.mts) (#45). That gate passes when no files match: this PR's `backend` check is green although the rules directory does not exist. Checking for a present rules directory and a non-empty coverage denominator is therefore a manual acceptance check, not an enforced CI gate. Browser smoke tests mock HTTP; the real sign-in journey still needs [issue #13](https://github.com/LLaammTTeerr/omnicourses/issues/13). The [deploy workflow](../../.github/workflows/deploy.yml) builds artifacts but does not deploy a server.

## 2. What we will test

Each build reruns earlier applicable cases as well as its new checks. A feature delivered early is tested early and remains in regression; that does not move another build's acceptance scope automatically.

| Build | Required scope | Later work or dependency |
| --- | --- | --- |
| **B0**, 1 November | Email/password accounts and sessions; sign-in through the real screen/API; database migrations, API contract and deployed connectivity. | Preserve the specific B0 exceptions in §7. Google sign-in was deferred beyond B0; its later release date needs a decision. |
| **B1**, 15 November | Verified APCS curriculum; rule engine, degree audit and curriculum explorer; onboarding and account export/deletion; several saved plans and basic add/remove by term; gateway regression; first guide batch. | Live planner validation, drag-and-drop and comparison are B2. Administration writes are B2. B1 uses reviewed seed data. |
| **B2**, 29 November | Planner editing and live validation; deterministic transcript import with review/manual entry; notifications; plan export/sharing; curriculum administration API and screens, including CSV bulk import; nightly backup setup and regression. | #23 merged and ADR 0011 is accepted (12 Nov); #74 built the first F12 writes, including prerequisite/offering-term storage. Group-total checks still need Triết's rule-interface handoff, and program/cohort writes and CSV import are not built. Without these, affected cases stay blocked and full F12 is not accepted for B2. |
| **B3**, 13 December | Deterministic plan generator and goal box with a manual form path; advisor chat; what-if scenarios; remaining guides and personalized guide features; a second program or cohort entered through F12; full performance, security, usability and regression pass. | Proposed generator behavior and missing academic contracts must be resolved before the affected cases can be accepted. |

F11's B1 batch is **G01, G02, G06 and G07**: accounts/portals, registration, tuition, and grades/transcript download. B1 covers public search/browse/read, task groups for no results, language fallback and the age-based stale warning. Personalized rule values, plan course lists, problem reports/suggestions and the remaining B3 batch follow UC-10 §8 and the guides plan. F9 belongs to B2 per UC-09 and the SDP Sprint 4 schedule, even though the SDP's short release-content row does not list it separately.

F12 PDF import is excluded by accepted ADR 0003. CSV bulk import in the admin UI replaces it (Lâm, 1 Nov 2026). No feature may ask a model to parse a transcript or decide an academic rule. Portal integration is by link and student-supplied data, never stored portal passwords or automated registration. Optional two-factor authentication, Google sign-in, verified-student-email sign-up and the Vision's administrator rights per school remain explicit scope/design decisions in §8; this plan assigns no release date or grant model to them.

## 3. How we test and who does it

| Test level | Checks and evidence | Responsibility |
| --- | --- | --- |
| Unit/component | Vitest tests beside code; academic boundaries, invalid inputs, failures and UI states. Each behavior change has a test and each bug fix a regression test that failed before the fix. | Feature owners; Thắng maintains shared tools. |
| API/database | Real NestJS requests and a separate PostgreSQL database; migrations, constraints, authorization, transactions, concurrent writes where relevant, export and purge. Retain e2e output for the candidate commit. | Backend owners; Triết reviews database changes. |
| Browser | Real screens plus the real API and synthetic accounts for acceptance journeys. Mocked component/browser tests remain useful but cannot replace these journeys. | Thắng maintains the harness; Hoà supplies planner/screens; each feature owner contributes cases. |
| Academic/data review | Independently calculated expected results and official source references, checked against the implementation. Reconcile seed discrepancies before certifying the affected result. | Thắng prepares data; Triết reviews data and expected results. |
| Performance/usability | The measurements in §5, keyboard journeys, VI/EN, responsive layouts and contrast. Keep raw measurements and screen/fixture identifiers. | Thắng defines checks; Dũng runs/reports; Triết and Hoà diagnose API/UI cost. |
| Acceptance | Required-case inventory, regression results, defects, blocked work and exceptions for the exact build. | Dũng supplies results; Thắng checks sprint criteria; Lâm makes the acceptance decision. |

This document supplies parent checks and measurable outcomes. Dũng's detailed cases supply the exact fixtures, preconditions, steps and evidence locations. Existing [B0 cases](test-cases-b0.md) remain valid; do not renumber them. Later case files must cite their parent IDs and source clauses.

## 4. Test environments and data

### Environments

- **Local/CI:** Node 22.22.1, npm 11.21.1, repository lockfile, PostgreSQL 18.6 and the pinned Vitest/browser dependencies. Use the [CI workflow](../../.github/workflows/ci.yml) and [browser setup](browser-tests.md). Record OS, browser version and migrations for reproducibility.
- **Staging:** Lâm supplies the UI/API URLs, host capacity, proxy configuration and deployment evidence. Record the deployed commit, database migration state and build tag. Artifact upload or a Git tag alone does not prove a running deployment. If no staging server is available by **12 November**, run B1 locally against the real UI/API/database using the [§5 throttle profile](#performance-procedure) (10 Mbps download, 2 Mbps upload, 50 ms round-trip latency, no packet loss). Label the local B1 results **provisional** and record the tested commit and environment; deployment-dependent cases remain blocked until a server is available.
- Use a separate disposable test database, never a live student database. Keep secrets in environment settings or CI secrets, not reports. Use controlled fixtures and restore their known starting state between cases. Obtain authorization before manually recreating a database or deleting data outside that disposable fixture setup.

### Data and expected results

| Fixture | Required coverage |
| --- | --- |
| Synthetic users and grants | Two students with distinct transcripts/plans; a program administrator for program A only; a catalog maintainer with no program grant; an access manager with no implied editing grant; revoked grants. |
| Academic examples | Empty, partial and completed records; retakes; `graded`, `in_progress`, `exempt`, `pass`, `fail`; unknown course codes; two cohorts; shared courses/groups; independently reviewed expected credits, GPA and graduation status. |
| Planning examples | Met/unmet prerequisites, term order and year boundaries, offering terms, compulsory/elective coverage, several plans, impossible goals and unchanged originals for what-if/discard. Hold unrelated rules satisfied when testing one boundary. |
| Official curriculum | APCS 2024/2025 with source/version/page references and Triết's review. Use synthetic student records against it. A second program/cohort must also be exercised through the administration UI in B3. |
| Performance | A versioned synthetic transcript: the **APCS 2024 completion fixture** (45 courses, `src/backend/test/fixtures/apcs-2024-completion.json`, #83), its curriculum, a saved plan and fixed planning-goal sentences. Record fixture commit/checksum, row counts, term count and expected result; no real student data. |
| Failure data | Malformed transcript/PDF fixtures, invalid codes/links, failed transactions, expired sessions, lost responses, and scripted AI success/failure/slow responses using `FakeLlmService`. |

Do not infer a pass mark, GPA policy, equivalence, certificate rule or counting rule from the code under test. Expected results must identify the official clause or a synthetic test rule, and Triết reviews the official examples. Synthetic tests can verify mechanics while APCS data is unresolved; they cannot certify the real APCS audit.

PR #36 documents rules the schema cannot express yet: combined group minimums, the elective choice inside an APCS compulsory group, courses required outside the cohort credit total, and alternative graduation course sets. Equivalences and tentative teaching plans are review metadata, not loaded rules. Neither the supplied APCS nor CLC PDFs provides verified prerequisites or offering terms; a suggested study term is not an offering term. Record each gap against its affected cases and owner instead of treating an empty field as unrestricted. CLC specializations are represented as separate programs in that branch; this is a modeling limitation, not an accepted specialization contract for F7.

## 5. Required checks

IDs follow `TC-<build>-<area>-<number>` and stay stable. Detailed cases append a letter, for example `TC-B2-ADM-02a`. A parent passes only when all its required detailed outcomes pass; a parent and its children are not counted twice in report totals. These are planned checks, not execution results.

### B0 checks

| ID | Area | Required outcome | Source |
| --- | --- | --- | --- |
| TC-B0-AUTH-01 | Accounts | Consent and valid sign-up/sign-in succeed; invalid input, duplicate email, bad credentials and excessive attempts are rejected without disclosing secrets. Store the password only as an argon2id hash; neither the password nor its hash is ever returned in API responses or account exports. Sign-up consent links a privacy notice stating what is stored and the retention period, including backup retention; record the consent time. | F1; UC-01 steps 2/5; Vision §6 Security/Privacy; ADRs 0002, 0004; B0 cases |
| TC-B0-SESS-01 | Sessions | Missing/expired tokens fail; refresh invalidates the old token; list/revoke only owned sessions; sign-out removes access. | F1; ADR 0002 |
| TC-B0-UI-01 | Real browser sign-in | Sign up/in through real API; show failures; restore/refresh after reload; rejected refresh returns to sign-in; sign-out clears access; keyboard and VI/EN work. | F1; issue #13 |
| TC-B0-DB-01 | Database/API | Migrate an empty test database; check cohort and course/group constraints when #23 is included; health reaches PostgreSQL and OpenAPI loads. | ADRs 0001, 0002, 0005 (#23) |
| TC-B0-DEP-01 | Deployment | The running website reaches the API/database; deployed, tested and tagged commits match. | SDP §4.2.2; CONTRIBUTING §4 |

### B1 checks

| ID | Area | Cases and required outcome | Source / feature owner |
| --- | --- | --- | --- |
| TC-B1-ACAD-01 | Rules, audit and explorer | Empty/partial/complete records give the reviewed requirement coverage, credits, GPA, graduation status and estimated graduation term; absent inputs follow an explicitly reviewed unavailable-result case. Exercise prerequisites, offering terms, compulsory/elective groups, certificates and unknown courses. Assert that the audit shows warnings for an empty elective group, a missing language certificate and a prerequisite not taken when each condition applies. For APCS cap boundaries ([ADR 0012](../analysis-and-design/adr/0012-credit-caps-by-training-type.md), QĐ 1175/QĐ-KHTN Điều 7.2), every term, term 3 included (a main term, not a summer term), allows 10 and 22 and reports 9 and 23 as violations that cite the petition route and never block, with other rules satisfied. Explorer groups, links and graph match reviewed data; cohort selection changes the curriculum correctly. Expand into separate rule, audit and explorer cases. | F3–F4; Vision §4–5; Triết |
| TC-B1-ACAD-02 | Audit counting and freshness | Retakes and every transcript result type follow reviewed counting/GPA rules; shared group membership does not silently double-count credits. Saving a new transcript recomputes the audit for the correct user/cohort. The other user's record is unchanged. Unresolved equivalences/certificate data are recorded as unresolved, never an invented academic outcome. | F2–F4; ADR 0007; Triết, Lâm |
| TC-B1-PLAN-01 | Basic plans | Create/list/read/update several owned plans; add/remove courses by term and verify persistence after reload. Direct requests cannot read or change another student's plan. Failed saves cannot be reported as saved. Live validation and drag-and-drop remain B2. | F5; SDP §4.2.3; Hoà |
| TC-B1-USER-01 | Accounts and first guides | Onboarding selects a supported faculty/program/cohort and saves/reloads the optional target graduation term, credits per term and internship term (including none planned); omitted goal fields remain unset and answers can be changed later. Store requested credits without applying the credit cap: for example, 26 credits per main term remains 26 at onboarding; the rule engine enforces caps when building a plan. Rerun TC-B0-AUTH-01's argon2id-only storage, no returned password/hash, and consent-linked privacy notice with account and backup retention checks. Export contains all owned data, no credentials or another user's rows. Deletion revokes sessions, restoration follows the grace deadline, and due purge cascades user data. Retain its existing guide-search/browse outcomes, expanded by TC-B1-GUIDE-01 below without double-counting. | F1, F11; UC-01 steps 2/5–9 and §7; Vision §6 Security/Privacy; ADRs 0002, 0004; Lâm, Dũng |
| TC-B1-GUIDE-01 | Public guide behavior | G01/G02/G06/G07 are reviewed and published; browse/search works in VI/EN with/without diacritics. Check empty results, language fallback, version/date, deep links and the proposed six-month stale boundary. Signed-out readers see no personal data; no portal password or automated action is requested. Each new `@Public()` route joins the allow-list in `src/backend/test/public-routes.e2e-spec.ts` in the same PR; every other API route still returns 401 without a token. | F11; UC-10; guides plan; ADR 0010; Dũng |
| TC-B1-DATA-01 | APCS integration | Verify sources, course codes/credits, curriculum/group links, separate cohorts and shared catalog values. Run #23/#36 migration/seed tests when included: repeat seeding keeps counts and administrator edits, conflicting catalog values abort, and failure rolls back. Missing academic fields stay visible in the report. | F3–F4, F12; ADR 0005; seed PR; Thắng, Triết |
| TC-B1-AI-01 | Gateway regression | Structured and streaming fake replies work. Invalid replies, missing configuration, timeout and provider failures before a response starts map to `503 ai_unavailable`; after chat streaming starts, an SSE `error` event carries `ai_unavailable` and the stream ends, with HTTP status already 200. Check role filtering, per-user limits including parallel attempts, and content-free usage accounting under the gateway's existing contract. No live provider in CI. | F6 goal box, F8; ADR 0003; `src/backend/src/ai/sse.ts`; Lâm |

### B2 checks

For `TC-B2-ADM-01` through `TC-B2-ADM-07`, [UC-11's Examples to test](../requirements/use-cases/UC-11-maintain-curriculum.md#examples-to-test) is canonical. The rows below expand those examples into acceptance checks, including the Vision Data NFR, without replacing their expected behavior. Resolve any conflicting wording in UC-11 before accepting the affected cases.

| ID | Area | Cases and required outcome | Source / feature owner |
| --- | --- | --- | --- |
| TC-B2-PLAN-01 | Editing and live validation | Add/remove/move courses with drag-and-drop and keyboard controls; validate each edit through the rule engine. Show prerequisite, offering-term, credit-cap and coverage violations accurately, including moving a prerequisite after its dependent course. A late response for an earlier edit must not replace the current validation result. Save/reload and compare several plans without mixing their state. | F5; Vision §5–6; Hoà, Triết |
| TC-B2-PLAN-02 | Failure and ownership | Expired sign-in, denied access, API failure and lost save response preserve clear saved/unsaved state. Re-read after an unknown outcome. Crafted plan/course IDs cannot cross user ownership; unrelated plans and transcript rows stay unchanged. | F5; ADRs 0002, 0004; Hoà |
| TC-B2-TRN-01 | Import and manual review | Synthetic supported PDFs produce deterministic rows; unsupported/scanned/non-PDF/oversized inputs receive the agreed error and manual path. Review/correct/add/remove before saving; incomplete rows block save. Cancel preserves the earlier record; no file or content is retained contrary to the agreed policy. The proposed 5 MB boundary waits on §8. | F2; UC-02 A1–A9; ADR 0003; Lâm |
| TC-B2-TRN-02 | Student-record integration | Replacement is atomic, concurrent saves serialize, retakes remain separate, and each result/grade/term combination follows the stored contract. Unknown catalog courses remain in the transcript. Audit/planner recompute from the committed set; export and purge include all rows. Import never decides which attempt passes or counts. | F2–F5; ADRs 0004, 0007, 0009; Lâm, Triết |
| TC-B2-ADM-01 | Global catalog permission | A catalog maintainer with no program grant edits a shared course after reviewing every affected curriculum; both programs read the correction. A program-only administrator cannot make that write. Refuse cohort-specific values under this shared model. | F12; UC-11 A4/A8; ADR 0011; Thắng |
| TC-B2-ADM-02 | Program/access boundaries | Program A's administrator can edit its details, cohorts, groups and membership but cannot target program B, including through nested IDs. Only an access manager creates programs or grants/revokes permissions; that role gives no implied program/catalog editing grant. Signed-out, ungranted and revoked users cannot write. | F12; UC-11 A2/A4/§8; ADR 0002; Thắng |
| TC-B2-ADM-03 | Cohorts and membership | Save plans and the reviewed audit/validation results for the first cohort, then add a second cohort as a new curriculum record, create/edit its groups and link existing catalog courses. Preserve the first cohort's membership and avoid duplicate courses. Reload its saved plans and audit; assert the original curriculum version and course placements remain, and audit and rule-engine validation results are unchanged. Reject duplicate program/cohort identifiers and invalid links according to the reviewed schema. | F12; UC-11 A1; Vision §6 Data; ADR 0005; Thắng, Triết |
| TC-B2-ADM-04 | Removal | Removing one group link keeps the course and other links. Refuse deleting a referenced course or other data still needed by saved records; deletion of an unreferenced course needs catalog permission. A linked course-code change is not an ordinary edit. | F12; UC-11 A5/A8; Thắng, Triết |
| TC-B2-ADM-05 | Validation, atomicity and impact | Normalize/validate canonical codes; reject invalid numbers/links without change. Cancel discards the edit; a failed transaction leaves no partial save; an unknown response triggers re-read. If linked curricula change during catalog impact review, require renewed review. Do not rewrite transcript rows or saved course placements. | F12; UC-11 A3/A6–A8; ADR 0007; Thắng |
| TC-B2-ADM-06 | Grant lifecycle | ADR 0011 defines storage/bootstrap (built in #74). Test controlled first-access-manager setup, no privilege from sign-up/onboarding, and current-grant checks on every write. In every grant table, `user_id` references `users(id) ON DELETE CASCADE`; any other key to `users`, such as a granter column, uses `ON DELETE SET NULL` or `ON DELETE CASCADE`. Prefer `SET NULL` to preserve another user's grant when the referenced user is purged. Account export includes owned grants and purge removes them without deleting shared programs/catalog data. | F12; UC-11 §8; AGENTS.md; ADR 0004; Thắng, Lâm |
| TC-B2-ADM-07 | CSV bulk import | Upload a synthetic CSV of courses or group links and parse it deterministically. Show a preview with per-row errors; validate every row by the same rules as manual entry, including code format, credits and group totals. Report each bad row with its row number and save nothing from a file containing a bad row. A valid file is saved only after the user confirms, in one transaction; a failed save leaves no partial change. Enforce the same catalog/program/access-manager grants and shared-catalog impact review as TC-B2-ADM-01/02, including current grants at confirmation. Re-importing the same file creates no duplicate records or links. No model is called; use synthetic CSV fixtures only. | F12; Lâm, 1 Nov 2026; UC-11 CSV alternative-flow handoff in §8; ADR 0003; Thắng |
| TC-B2-SHARE-01 | Export and sharing | A signed-out reader sees only the allowed read-only plan data; name hidden by default, never grades/email/transcript/other plans. Show rule-engine violations in the view/PDF. Test one live token, edits reflected, revoke/re-share, deleted plan, account deletion and restoration; old/dead/unknown links stay inaccessible. Verify `noindex`, PDF readability and default-deny writes. Each new `@Public()` route joins the allow-list in `src/backend/test/public-routes.e2e-spec.ts` in the same PR; every other API route still returns 401 without a token. | F9; UC-09; ADRs 0004, 0010; Dũng, Hoà |
| TC-B2-NOTIF-01 | Notifications | Exercise registration-window reminders, term-start check-in and committed transcript-change warning. Verify the intended recipient, correct source event, no warning from cancelled/failed transcript saves, and no other user's details. Delivery channel, timing/time zone and repeat behavior require the F10 contract in §8 before exact assertions are approved. | F10; Vision §5; UC-02 A5; Dũng |

Administration tests follow UC-11, Lâm's CSV replacement decision above and accepted [ADR 0011](../analysis-and-design/adr/0011-curriculum-administration.md) (Lâm, 12 November 2026), which supplies grant storage/bootstrap, the write boundary and CSV column format; [UC-11 A9](../requirements/use-cases/UC-11-maintain-curriculum.md#a9-bulk-entry-from-csv) supplies the matching flow. #23 merged as `900b1b8`, and Lâm accepted the school-scoping exception. Prerequisite/offering-term storage and writes were built in #74; add concrete cases under the administration parents from its tests. Do not mark those parts passed merely because basic group editing works.

### B3 checks

| ID | Area | Cases and required outcome | Source / feature owner |
| --- | --- | --- | --- |
| TC-B3-GEN-01 | Deterministic generation | A reviewed synthetic curriculum/goal produces repeatable course placements checked by the real rule engine, with engine-backed explanations and estimated graduation term. Test empty transcript, in-progress courses, compulsory courses to avoid, impossible target, credit cap and offering constraints. Generation from the manual form works with AI disabled. Save creates an owned new plan; discard/cancel cannot silently save. Exact search/timeout outcomes await the reconciled ADR 0006. | F6; UC-07; ADR 0003; proposed ADR 0006; Lâm, Triết |
| TC-B3-GOAL-01 | Goal box | Valid fake structured output fills and highlights fields, then waits for student review and an explicit Plan action. Invalid output, limits and unavailable service leave the manual form usable. No identity/transcript is sent, no prompt/reply is logged, and model output cannot override the rule engine. | F6; UC-07 A1–A4; ADR 0003; Lâm |
| TC-B3-WHAT-01 | What-if scenarios | Apply failure, specialization change, an added term and heavier load to a copy; show recomputed violations and graduation-term difference from reviewed examples. Original plan/transcript stay unchanged. Unsupported or unresolved specialization data is reported, not fabricated. | F7; Vision §5; UC-06 handoff; Hoà, Triết |
| TC-B3-ADV-01 | Advisor | Declined/withdrawn consent keeps record data out of requests and permits general mode. With consent, send only the user's allowed pseudonymous record; tool handlers use the signed-in user, not model-supplied identity. Answers applying academic rules use that answer's engine result and cite returned document/clauses. Test absent/conflicting sources, unsafe message roles, read-only tools, cancellation, partial stream, timeout/unavailability and no stored conversation/content logs. | F8; UC-08; ADR 0003; Dũng, Triết |
| TC-B3-GUIDE-01 | Remaining guides | Exercise the B3 content batch, rule-engine program values, owned plan course lists, signed-in reports/suggestions, unresolved-report stale warning and advisor links. Public reads remain available without personal data; seed updates preserve guide versions and reports for withdrawn guides. | F11; UC-10 A2–A6; guides plan; ADR 0010; Dũng |
| TC-B3-ADM-01 | Second program/cohort end to end | Enter a second program or cohort through F12 using appropriately separate grants. Include the new-cohort path: save the first cohort's plans and audit/validation baseline before adding the cohort, then reload those plans and audit and assert the original curriculum version, placements and results are unchanged. Read the new curriculum in the explorer, audit and planner. Membership edits stay scoped; test shared catalog corrections separately, changing only the confirmed shared attributes. Seeded CLC rows alone do not satisfy this UI case. | F12; UC-11 §7; Vision §6 Data; SDP Sprint 5; Thắng, Triết |
| TC-B3-REG-01 | Integrated regression | Run all applicable B0–B3 cases on one candidate: sign-in/onboarding → transcript → audit/explorer → plan/what-if/generation → share/guides/advisor → account export/deletion. Repeat the academic examples after admin changes and all applicable NFR checks below. | F1–F12; SDP §4.2.2; all owners |

### Coverage and speed

The performance targets below come from **Vision v2 §6**, not the historical [Vision v1 excerpts](sources/vision-v1-nfr-excerpts.md). Vision v2 assigns **under 30 seconds to goal-box form filling**. UC-07 and proposed ADR 0006 still assign 30 seconds to deterministic generation; §8 records that conflict. Measure generation separately, but do not silently declare its timeout/partial-plan policy approved.

| ID | First build; required check | Evidence / owner |
| --- | --- | --- |
| TC-B1-COV-01 | B1: rule-engine statement coverage **≥80%** for `src/backend/src/rules/**`, configured as `src/rules/**` in [vitest.config.mts](../../src/backend/vitest.config.mts). Count every production rules file, including unexecuted files; exclude tests/generated files and other modules from this threshold. | Retain rules file list, covered/total statements and coverage report. Verify a below-threshold run fails CI. The gate passes when nothing matches it; this PR's `backend` check is green with no rules directory. Manually verify that the directory exists and the denominator is non-empty before accepting coverage: an absent directory or empty denominator is not an acceptance pass. Thắng, Triết. |
| TC-B1-PERF-01 | B1: audit and dashboard each load in **<2 seconds** with the synthetic APCS 2024 completion fixture (45 courses, #83) on the agreed normal-connection profile. Repeat in B2/B3. | Browser navigation/action to correct complete rendered result, including API/DB work. Report audit and dashboard separately. Dũng runs; Triết/Hoà investigate. |
| TC-B2-PERF-01 | B2: planner edit is validated in **<300 ms**; repeat in B3. | Browser edit event to current validation result rendered, including debounce, network, API and rendering. Measure API time separately for diagnosis; it does not replace the user-visible measure. Thắng, Hoà, Triết. |
| TC-B3-PERF-01 | B3: goal box fills the planning form in **<30 seconds**, with visible progress. | Fill-the-form action to validated fields rendered, including provider calls/retries. Record progress, success/failure and total duration. Fake calls test UI behavior only; provider latency needs a separately authorized synthetic live run. Thắng, Lâm. |
| TC-B1-A11Y-01 | B1: keyboard use, VI/EN, widths **360–1920 px**, WCAG 2.1 AA contrast. | Inventory B1 screens and states; record keyboard completion, overflow checks and contrast measurements. Test 360, 768, 1280 and 1920 px plus each layout breakpoint. Dũng, Hoà. |
| TC-B2-A11Y-01 | B2: extend the same usability checks to planner, transcript review, admin, sharing and notifications. Repeat in B3 for new screens. | Keyboard alternative to dragging, labels/focus/error messages, words as well as color, readable PDF and non-disruptive streamed updates. Dũng, feature owners. |
| TC-B3-SEC-01 | B3: full permission/privacy regression; apply relevant checks when features first ship. | User/program isolation, grant revocation, public-read allowlist, secret-free export/logs, purge, AI consent and scoped read-only tools. Recheck open findings [#28](https://github.com/LLaammTTeerr/omnicourses/issues/28) and [#37](https://github.com/LLaammTTeerr/omnicourses/issues/37) against current code; an old issue checklist is not current evidence. Lâm, Thắng. |
| TC-B2-OPS-01 | B2: nightly backups; B3: demonstrate restoration and assess **99% monthly availability**. | Backup job results and retention notice; restore synthetic data into an isolated database, rerun invariants. Record monitoring interval, probe definition, downtime and monthly denominator. A short smoke run cannot prove monthly availability. Hosting/probe decisions belong to Lâm. |
| TC-B3-AI-02 | B3: model failure leaves manual planning usable. | Fake unavailable/slow/bad-output cases; show incomplete/stopped chat appropriately. Record Lâm's confirmation of provider training opt-out and monthly credit limit without credentials; these account settings cannot be proven by unit tests. Lâm, Dũng. |

### Performance procedure

The following sampling and environment choices are **proposed test-method defaults**, not new Vision requirements. Dũng records them before execution and Lâm, Triết and Hoà review them with this plan. Any change is recorded before collecting replacement evidence.

1. Identify the exact UI/API commit, fixture version, migrations, machine/host capacity, browser, concurrent traffic and cold/warm cache state. Use a foreground browser and one active test user for the initial baseline; report additional concurrency separately without inventing a load target.
2. Until the team defines “normal connection”, propose **10 Mbps download, 2 Mbps upload and 50 ms round-trip latency**, no packet loss. Apply the profile consistently to the browser's app traffic and record the tool/settings. Do not call an unthrottled localhost measurement evidence for the normal-connection NFR. If the profile is not agreed, label the result provisional.
3. For audit/dashboard, measure five cold-cache navigations separately from 30 measured warm-cache runs after five warm-ups. For validation, use the same warm-up/count per edit class: valid placement, prerequisite violation, offering-term violation and credit-cap violation. Reset to the fixture before each run so results and plan size are comparable.
4. Record each duration, median, p95 and maximum. The proposed gate is **every measured run below the stated strict limit**, with no unexpected failure or wrong result; averages cannot hide a breach. Warm-ups are recorded but excluded from the measured set. A timing failure remains in the report even if a later rerun succeeds.
5. For the goal box, deterministic fake responses cover progress, malformed output, retries, cancellation and failure in CI. For a separately authorized live check, run `npm run test:live -w src/backend` as the provider smoke test, then measure five fixed synthetic goals through the goal-box UI, one request at a time, and report every attempt, model/configuration, total time and whether the form filled successfully. The command currently tests the gateway; it does not measure end-to-end form filling. Live calls spend credit; do not run them automatically in CI or pretend a fake proves provider performance. A 503/timeout is not a successful timed result even when the fallback works.
6. Verify the expected academic/UI result for every timed run. Attach raw timings and diagnostic API timings; distinguish a functional failure, a latency breach and an unavailable environment. The gateway's timeout is per provider request and may retry, so its 30-second setting alone does not prove the end-to-end goal-box target.

## 6. Running tests and reporting results

From the repository root, with the pinned runtime, installed dependencies and disposable test database:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e -w src/backend
npm run openapi -w src/backend
npm run test:browser
```

`npm test` now includes backend coverage (#45); no extra coverage command is required. E2e requires `DATABASE_URL`; OpenAPI export requires the backend build. Install Chromium using [browser-tests.md](browser-tests.md). Compare the exported OpenAPI 3.2.0 contract with the tested routes, including authorization and documented failures. The browser command currently runs mocked smoke tests; acceptance journeys against the actual API need their own detailed setup. No dedicated performance runner is implemented by this document.

Reports record the build/tag and exact commit, environment, source/fixture versions, case IDs, expected/actual outcomes, commands, raw evidence and linked defects. Use **passed**, **failed**, **blocked** or **not run**. A skipped/blocked case never counts as passed. Include counts against the complete required-case inventory, with a reason, owner and next action for every blocked/not-run case. Keep synthetic data in evidence and omit credentials, tokens and personal records.

File defects as GitHub issues linked from the Discord Sprint task, following the [issue-tracker guide](../agents/issue-tracker.md). Include reproducible synthetic input, expected/actual result, affected build and parent test ID. The owner fixes the defect with a regression test; Dũng retests the fix and affected integrations. Keep the original failure and the successful retest as separate evidence.

## 7. When a build is ready

### Before acceptance testing

- Lâm confirms the candidate's sprint scope. Map each requirement to its detailed cases, owner and reviewed expected result. Resolve conflicting requirements or record the affected case as blocked on a named decision.
- Required implementation and migrations are merged into the candidate; record the actual staging deployment and test data, or the §4 local B1 fallback with provisional results if no staging server is available by 12 November. A feature absent from the candidate is **not run: feature not merged**. Missing environment/data/contract is **blocked**, with the reason; the local fallback does not pass deployment-dependent cases.
- Automated results belong to that exact commit. Verify academic fixtures with Triết and portal guide content with its human reviewer. Restore known fixture state before each run.
- Earlier applicable cases remain in regression. A missing later feature does not prevent independent foundation tests from running, but those tests cannot count as that feature's acceptance.

### Proposed acceptance criteria

- Typecheck, unit/component tests, build, backend e2e and browser checks pass for the candidate. Required tests are not weakened or silently skipped. OpenAPI and relevant migration/seed checks agree with the tested candidate code.
- All required detailed cases for the build pass, including earlier carry-over and the NFRs first due in that build. The 80% threshold applies to the actual rule engine, not the aggregate backend percentage. A correctness failure cannot be traded for a fast response.
- No open defect exposes another user's/program's protected data, loses stored data, gives a known wrong academic result or blocks a required user task. Smaller defects have an owner and a recorded disposition. Lâm must explicitly approve an exception or scope reduction; keep the original failed/blocked/not-run result visible.
- The report identifies the tested commit/tag, staging or provisional local environment, raw evidence, coverage, measured NFR results and remaining decisions. Thắng records acceptance findings, Dũng supplies regression results, and Lâm decides whether to accept/release/submit. Finishing the plan does not finish PA3's detailed cases or B1 acceptance.

**Historical B0 exceptions only** (Lâm, 30 October 2026):

- If no staging server exists, deployment-dependent cases such as `TC-B0-DEP-01` are **blocked: no server yet**.
- If sign-in screens (#13) or schema (#23) are not merged by 1 November, dependent cases such as `TC-B0-UI-01` and the cohort/course/group parts of `TC-B0-DB-01` are **not run: feature not merged** and carry to B1.

These were allowed exceptions for B0, never passes. List each case with an owner. **They do not automatically waive B1, B2 or B3 requirements**; a continued gap requires a new recorded decision from Lâm.

### When to stop and resume

Stop affected tests if the environment is unreliable, migrations fail, fixtures are damaged or the required contract is unresolved. Preserve evidence and identify the owner; continue independent tests. Resume after the cause is fixed, fixtures/environment are restored and basic checks pass, then rerun affected cases and regressions on the resulting candidate commit.

## 8. Schedule and remaining work

| Date | Deliverable / activity | Owner and dependencies |
| --- | --- | --- |
| 1 November onward | Review Test Plan v2 ahead of PA3; Dũng expands B1–B3 parent checks into detailed cases. | Thắng, Dũng; Lâm/Triết/Hoà review scope, academic expectations and measurement defaults. |
| By 8 November | Review APCS seed data and record unresolved rules; confirm plans API and curriculum handoffs. | Thắng/Triết for data and schema; Hoà for plans. Merged data alone does not resolve missing rules. |
| By 12 November | Prepare B1 candidate, staging/fixtures, case inventory and automated evidence. If no staging server is available, prepare local B1 runs with the §5 throttle profile and label results **provisional** as specified in §4. | Proposed preparation date; Lâm coordinates, Dũng prepares runs, feature owners resolve dependencies. Deployment-dependent cases remain blocked. |
| 13–15 November | B1 acceptance: 13 Nov initial run, 14 Nov fixes/retests, 15 Nov findings and acceptance decision. | Proposed working window; Dũng runs, Thắng checks sprint criteria, Lâm decides. A new candidate requires fresh affected evidence. |
| 15 November, PA3 | Submit reviewed test plan and detailed cases with the B1 report/decision. | Lâm coordinates submission; unresolved cases remain visible. |
| 16–29 November, B2 | Run live validation, transcript, notifications, sharing, admin and backup checks; rerun B1. | Feature owners; Thắng/Dũng acceptance and regression. |
| 30 November–13 December, B3 | Exercise generator/advisor/what-if, second-program/cohort UI path, remaining guides and full NFR/regression checks. | All owners; Lâm accepts the release candidate. |

### Decisions and handoffs to close

| Item | Affected checks | Owner / resolution needed |
| --- | --- | --- |
| #23/#36, prerequisite/offering-term sources, cross-group minimums, equivalences, certificate and counting rules | B1 academic/data; B2 validation/admin; B3 generator/what-if | Triết supplies reviewed storage/read/rule contracts; Thắng verifies source data. Resolve #36's unloaded rules and modeling gaps; do not infer missing data. |
| UC-03–UC-06 detail, plans API and specialization contract | Audit/explorer, planner and what-if | Triết/Hoà supply detailed flows and expected results. Until then cases trace to Vision and explicitly reviewed examples. |
| ADR 0011: scoped grants, global catalog/access-manager roles, endpoints, bootstrap, deletion and audit history | B2 admin parents, B3 second program/cohort | ADR 0011 accepted (Lâm, 12 Nov 2026). The audit trail is deferred to B3, with no logging contract in B2. Grant recipients use `user_id ... ON DELETE CASCADE`; other user references normally use `SET NULL`. If B3 builds a shared change-history log, it uses nullable `actor_id ... ON DELETE SET NULL`, not `user_id`, and needs retention/read/transaction rules and export/purge tests. #23 merged as `900b1b8`; #74 built the grants and first writes. |
| CSV format, transport limits and final-state validation | TC-B2-ADM-07; B2 administration UI/API | ADR 0011 (accepted) and UC-11 A9 specify the columns and flow; CSV import is not built yet. Thắng implements the import-specific JSON limit and independent decoded CSV/record bounds; Triết supplies the final-state rule interface before manual/CSV group-link writes and group-total checks. Preview/confirmation use current grants, one transaction and duplicate-free re-import. Use synthetic CSV only and no model, following Lâm's 1 Nov 2026 replacement decision. SDP v2 (#20) already excludes PDF import. |
| Optional two-factor authentication (Vision §6 Security) | F1 sign-in; security regression | Lâm decides release scope and the setup, recovery and sign-in contract before cases are assigned; optional use is not evidence that the capability exists. |
| Google sign-in (Vision F1; UC-01 A4; ADR 0002 deferred) | F1 sign-up/sign-in and account deletion | Lâm sets the post-B0 release, provides Google Cloud configuration and decides proof for linking an existing email account and deleting a passwordless account. |
| Verified-student-email sign-up (Vision F1; UC-01 Open) | F1 sign-up and verification | Lâm confirms the release and mail sender, accepted HCMUS student-email domains and verification contract. UC-01 says not before B3; that is not a committed B3 delivery date. |
| Administrator rights per school (Vision §6 Security) versus faculty terminology and current grants | F12 permissions; onboarding faculty selection; security regression | Decided (Lâm, 12 Nov 2026, ADR 0011): program-scoped grants plus the two global permissions replace school-scoped administration, a deliberate exception. UC-11's grants have no school/faculty axis; B2/B3 acceptance evidence records the per-school clause as a known exception, not a pass. |
| Vision v2 goal-box <30 s versus UC-07/ADR 0006 generation deadline/partial result | B3 generation and goal-box performance | Lâm with Triết/Hoà reconciles documents. Confirm how incomplete/violating generated results are labeled, and cancellation/timeout behavior. Do not certify a partial plan as valid or optimal. |
| UC-02 proposed 5 MB upload cap/file cleanup and portal format; ADR 0009 portal summer encoding | B2 transcript | **Decided (Lâm, 9 November 2026):** uploads are capped at 5 MB and the file is deleted as soon as it is read; only the reviewed rows are kept. Lâm still confirms the parser format; Triết/Hoà confirm cross-module term mapping. Real source inspection stays local with its owner; tests use synthetic fixtures. |
| F10 delivery channel, schedule/time zone, duplicate handling and trigger contract | B2 notifications | Dũng supplies exact expectations before timed/delivery assertions are approved. |
| Six-month guide warning policy and portal content verification | B1/B3 guides | Dũng confirms the still-proposed threshold with Lâm and records human verification before publishing guides. |
| Staging/proxy, network profile, backups/retention, monthly monitoring and live AI configuration | Deployment, performance, operations, AI | Lâm supplies environment and decisions; Thắng/Dũng record evidence. [Issue #24](https://github.com/LLaammTTeerr/omnicourses/issues/24) is a coordination source, not proof setup is complete. Missing monthly history is reported as blocked, not estimated as a pass. |

[sdp]: https://github.com/LLaammTTeerr/omnicourses/blob/1e8d8c4623017738574812431dadd639d8bc4545/docs/management/software-development-plan.md
[uc01]: https://github.com/LLaammTTeerr/omnicourses/blob/9d1f13bcb3be62cede0629799cf484d7ed321406/docs/requirements/use-cases/UC-01-sign-up-and-onboard.md
[uc02]: https://github.com/LLaammTTeerr/omnicourses/blob/9d1f13bcb3be62cede0629799cf484d7ed321406/docs/requirements/use-cases/UC-02-import-transcript.md
[uc07]: https://github.com/LLaammTTeerr/omnicourses/blob/9d1f13bcb3be62cede0629799cf484d7ed321406/docs/requirements/use-cases/UC-07-generate-a-plan.md
[schema]: https://github.com/LLaammTTeerr/omnicourses/blob/d4125b2ebb095aac653b7b4603f486a4e2263260/docs/analysis-and-design/adr/0005-curriculum-cohort-and-course-catalog.md
[seeds]: https://github.com/LLaammTTeerr/omnicourses/tree/4ad5b83858712f78419bea39700e730bbc1d251b/src/backend/src/database/seeds
[generator]: https://github.com/LLaammTTeerr/omnicourses/blob/58cbca815dc4d6f4c8b0629c701a468c461cfd48/docs/analysis-and-design/adr/0006-plan-generator.md
