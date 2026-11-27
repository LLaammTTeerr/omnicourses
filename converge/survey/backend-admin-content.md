# Survey: backend admin and content

Area: src/backend/src/{curriculum-admin,academic-calendar,notifications,guides}, curriculum/seed-curricula.ts, database/seeds, advisor (describe only). Evidence gathered by reading files, rg and node one-liners in the converge worktree; no tests run.

## 1. Model of the area

- curriculum-admin (5 controllers, 5 services, 18 prod files): all F12 writes. AdminWriteService.run(callerId, Need, write) is the single permission gate: it takes the advisory lock, checks the caller is not pending deletion, reads grants (grants.ts: program_admin_grants, global_admin_grants), then runs the write in one transaction. Grants have one mechanism only. Roles: program_admin (per program), catalog_maintainer and access_manager (global).
- Sub-features by service: curriculum-admin.service (requirement groups, links, prerequisites, offering terms, editablePrograms, ownGrants), program-admin (programs, cohorts), catalog-admin (courses), access-admin (grants), csv-import (catalog and group-link CSV preview/confirm; PR #166 owns the service).
- academic-calendar: events per program; reads and writes through AdminWriteService (needs { program }). Reads the caller's program through OnboardingService.
- notifications: inbox. A 10-minute timer (notification-schedule.ts) and every list/unread-count read call createDue(), which asks the calendar for events starting today or in 7 days and inserts one row per student of the program (raw SQL, snapshot columns). Also subscribes to TranscriptService.onSaved for transcript_changed, inside the transcript transaction.
- guides: GUIDE_FILES (8 hand-listed content files, vi/en) -> seed-guides.ts (hash, version, withdrawal rules) -> guides/guide_texts. Read API in guides.service. testing/guide-fixtures.ts adds zz-* guides on --guide-fixtures (refused in production).
- Seeding: database/seed.ts calls guides/seed-guides and curriculum/seed-curricula; seed-curricula reads database/seeds/* (typed rows, 1 apcs-2024, 1 apcs-2025, 9 clc-2025 specialisations) and takes ADMIN_WRITE_LOCK from curriculum-admin.
- advisor (not imported by anything, PR #77): regulation and course-description JSON extracts plus extractors and specs. Described only.
- State: Postgres only. Two advisory locks (11_012_001, 11_012_002) are defined in admin-write.service.ts; auth and ai use other lock schemes.

## 2. Ideal direction

- One small "admin access" unit owns: who may write (grants, Need, AdminWriteService), the two advisory locks, the 403 contract. Every writer (curriculum-admin, calendar, seeding, account deletion) depends on it, not on the curriculum-admin feature.
- Curriculum data and its loader live in the curriculum feature (data next to the code that loads it); database/ only orchestrates a list of seeders with one signature.
- Row data states each fact once: a course (code, name, credits, periods) is written once; a specialisation file says only which group it sits in and the PDF page.
- DTO files match services one to one.
- Notifications stay a consumer of calendar and transcript through narrow calls; the kind list is one enum shared by contract.

## 3. Findings

### BAC-1 Move the admin write gate, the grants and the two advisory locks out of curriculum-admin into their own small unit (step 1: locks only)
Problems it solves:
- Hidden link and needless link: curriculum/seed-curricula.ts:2 imports ADMIN_WRITE_LOCK from curriculum-admin/admin-write.service.ts, and account/account.service.ts:7 imports ACCESS_MANAGER_LOCK from the same file. Two features take a lock whose key lives in a file about HTTP writes. This is the curriculum <-> curriculum-admin <-> database cycle: curriculum-admin imports curriculum entities (admin-lookups.ts:4-6, program-admin.service.ts:4-5, curriculum-admin.module.ts:4), curriculum imports curriculum-admin (seed-curricula.ts:2).
- Needless link: academic-calendar imports the whole CurriculumAdminModule (academic-calendar.module.ts:3) and reaches AdminWriteService and AdminErrors (academic-calendar.service.ts:6, academic-calendar.controller.ts:6) only for the gate. A calendar change drags in the module with 5 controllers.
- Hidden link: lock keys are scattered with three schemes (admin-write.service.ts:25-26 fixed ints; auth/auth.service.ts:176 and ai/ai-cost-guard.service.ts:29 use a namespace plus hashtext). Nothing shows that 11_012_001/2 must not collide with them; they are only literals.
- Hidden link: raw SQL against the users table in admin code (admin-write.service.ts:38 and :81, admin-lookups.ts:52-60, access-admin.service.ts:32) knows column deletion_requested_at; account-deletion rules are written in users/account yet checked here by hand.
- Naming: the 403 decorator AdminErrors lives in admin-write.service.ts while admin-errors.ts holds other admin errors (admin-errors.ts:1-40); a reader looks in the wrong file.
Callers and dependents (rg "admin-write.service" in src and test, non-spec): 15 files: all 8 services/controllers in curriculum-admin, module, csv-import.controller, academic-calendar service and controller, account.service, curriculum/seed-curricula, test/curriculum-admin.e2e-spec.ts.
Cost today: seeding or account code must import an HTTP-admin file to take a lock; adding a lock means guessing a free number; calendar tests boot curriculum-admin.
Proposed change: Step 1 (S): new common/advisory-locks.ts exporting ADMIN_WRITE_LOCK, ACCESS_MANAGER_LOCK and the namespaces used by auth and ai with one comment-free naming table; seed-curricula, account.service and admin-write.service import from it. Step 2 (M): new folder admin-access/ with admin-write.service.ts, grants.ts (Need, grantsOf, missingPermission), admin-grant.entities.ts, the AdminErrors decorator, and a tiny AdminAccessModule (TypeOrmModule.forFeature of the two grant entities, exports AdminWriteService). curriculum-admin and academic-calendar import that module. Keep userGrants (presenter returning UserGrantsDto) in curriculum-admin/access-admin. Put the users deletion-state SQL behind two functions in one file (admin-access/account-state.ts). Old paths are deleted, no re-export file.
Contract impact: none (entity table names, class names and routes unchanged; ApiProperty class names the same, so openapi.json stays byte for byte; verify).
Write scope: src/backend/src/common/advisory-locks.ts (new); curriculum-admin/{admin-write.service,grants,admin-grant.entities,admin-lookups,access-admin.service,curriculum-admin.module}.ts and every curriculum-admin file that imports them (controllers, services; NOT csv-import.service.ts and its spec, which PR #166 owns: deferred, in-flight PR #166, import lines only); academic-calendar/*; account/account.service.ts; curriculum/seed-curricula.ts; auth and ai lock lines (ai-cost-guard.service.ts and ai files belong to PR #77: deferred, in-flight PR #77 for the ai lock namespace; keep auth only); test/curriculum-admin.e2e-spec.ts; docs class-model.md line 1156 text.
Effort S (step 1) then M (step 2), risk low, confidence high.
Verification: npm run typecheck, unit tests, test:e2e curriculum-admin, curriculum-admin-import, account, calendar; openapi diff empty; a new spec test that the lock constants are all distinct.
Alternatives: leave the cycle (costs: every seeding or account change reads admin code); step 1 only (cheap, removes the seed and account links but not the calendar one).

### BAC-2 Write each CLC 2025 course once and let each specialisation file list only group membership and the PDF page
Problems it solves:
- Copies (hidden link): the nine src/backend/src/database/seeds/clc-2025-*.rows.ts files are 218 lines each. Verified with a node one-liner: every file holds exactly the same 187 courses (normalised without the page), so 187 distinct rows x 9 = 1683 row lines; 187 of 187 appear in all nine files, none in only some. Name, credits and the four period counts of one course are written nine times; buildCatalog (catalog.ts:57-85) throws on any mismatch, which exists only because of the copies.
- The only real per-specialisation facts: which group a course is in (counts per file for bbcn, tccn, tn differ; the free group is the rest: 119, 106, 68, 115, 118, 102, 110, 118, 122 rows with the other groups summing to 187), the PDF page (157 of 187 normalised rows have a page that differs between files) and a few needs_check notes (3 lines per file with an object extra, e.g. clc-2025-attt.rows.ts needs_check on CSC12113).
- A change like fixing a typo in "quan hê" (flagged needs_check) has to be made in nine places and reconciled by hand.
Callers and dependents (rg "clc-2025|ClcRows" in src and test): only clc-2025.ts, clc-2025-shared.ts, seeds/index.ts and the nine rows files; test/curriculum-seed.e2e-spec.ts and database/seeds/curriculum-seeds.spec.ts read the built CurriculumSeed, not the rows files.
Cost today: updating one course or adding a tenth specialisation means copying 218 lines and checking 187 rows by eye.
Proposed change: add clc-2025-courses.ts with one CLC_2025_COURSES table (code, name_vi, credits, four periods, extras) and make each specialisation file a short object: { bbcn: [codes], tccn: [codes], tn: [codes], pages: Record<code, page>, needs_check? }. Derive free as the remainder in clc-2025-shared.ts. The groups llct, khxh, toan_*, tin, gdtc, gdqp, csn are the same in every file (6,3,6,3,13,1,2,10 rows): keep them once in shared as CLC_2025_COMMON. Generate the new files from the old ones with a one-off script and prove the built CurriculumSeed[] is deepEqual to the old (a snapshot spec before the change, deleted after is NOT needed: keep it as a permanent spec comparing counts and totals). Delete the nine rows files.
Contract impact: none for API; seeded rows must be identical (needs the equality proof). The existing rule that any change to academic data needs a person (AGENTS hard rule 1) is respected because values do not change.
Write scope: src/backend/src/database/seeds/clc-2025*.ts (all), rows.ts if the bb/tc helpers change.
Effort M, risk med (data-heavy; mitigated by deepEqual on the full seeds array before and after), confidence high.
Verification: a throwaway script building CURRICULUM_SEEDS from old and new code and asserting JSON equality (order of groups and rows included); curriculum-seeds.spec.ts; test:e2e curriculum-seed.
Alternatives: leave it (copies are data, rarely edited; but one catalog fix touches nine files and the conflict check only guards values, not group membership); generate the rows from the PDFs at build time (rejected: hard rule 1 says data is entered, reviewed and deterministic).

### BAC-3 Give curriculum its seed data and loader, and give database/seed.ts a list of seeders with one signature
Problems it solves:
- Needless link and cycle: curriculum/seed-curricula.ts imports from database/seeds/* (:3-5) while database/seed.ts imports curriculum/seed-curricula.ts (seed.ts:1). The data (apcs and clc rows, catalog decisions) belongs to curriculum; database/ is infra. Together with BAC-1 the curriculum <-> curriculum-admin <-> database cycle disappears.
- Special case: seed.ts reads --guide-fixtures from argv itself (seed.ts:6) and passes an options object to guides only; curriculum seed has a different signature (seed(dataSource)). AGENTS.md says every feature exports seed(dataSource, options); two features, two shapes; seed.ts is a hand-edited list (and order) that every new seeded feature edits.
- Surplus: curriculum-seeds.spec.ts (352 lines) and the e2e both live under database/seeds although the subject is curriculum.
Callers and dependents (rg "seeds/" in src and test): curriculum/seed-curricula.ts, test/curriculum-seed.e2e-spec.ts, test/curriculum.e2e-spec.ts, test/curriculum-admin.e2e-spec.ts, test/audit.e2e-spec.ts (the last three import seed helpers; verify each line before the move), database/seed.ts, package.json db:seed script (path dist/database/seed.js stays).
Cost today: finding which file owns a curriculum value means crossing database/ and curriculum/; a new seeded feature edits seed.ts and learns the odd argv flag.
Proposed change: git mv src/database/seeds -> src/curriculum/seeds (and seed-curricula.ts beside it); seed.ts becomes a list [{ name, seed }] of the two features, both typed (dataSource, options: SeedOptions); parse the flag once into SeedOptions in seed.ts. No new framework.
Contract impact: none (CLI db:seed and its flags unchanged).
Write scope: src/backend/src/database/{seed.ts,seeds/**} -> curriculum/seeds/**; curriculum/seed-curricula.ts; guides/seed-guides.ts signature only (guides export seed with the same options type); backend test imports; AGENTS.md line on seeds (deferred, in-flight PR #77: AGENTS.md is in its file list; hand the wording to the end).
Effort S-M, risk low (moves plus imports), confidence med-high.
Verification: typecheck, unit tests, test:e2e curriculum-seed and guide-seed, run npm run db:seed against a fresh database twice (second run reports all skipped).
Alternatives: leave the data in database/seeds and only fix the lock import (BAC-1 step 1 already removes the true cycle through curriculum-admin; this finding is then about tidiness and the seeder list, so it is the lower priority of BAC-1..3).

### BAC-4 Split curriculum-admin.dto.ts so each DTO file matches its service
Problems it solves:
- Hidden link: curriculum-admin.dto.ts (309 lines) mixes four sub-features: requirement-group and prerequisite DTOs (:43-139), the catalog course DTOs CreateCourseDto/UpdateCourseDto with COURSE_FIELDS and wholeNumberOrText (:141-257), and the access DTOs AccessProgramDto/UserGrantsDto (:259-309). program-admin.dto.ts and csv-import.dto.ts follow the service split already. 12 prod and test files import it (rg "curriculum-admin.dto").
- Special case/naming: curriculum-admin.service.ts (318 lines) also owns editablePrograms and ownGrants, which are about program/grant listing, and shares insertLink with csv-import; the folder is named for the whole feature and a service is named for one third of it.
- grants.ts (type-level) imports UserGrantsDto (a DTO) only for the presenter userGrants, so the permission check file depends on API shapes.
Cost today: changing catalog course rules means opening the group DTO file; every import of the file loads unrelated validators; two files named curriculum-admin.* mean different scopes.
Proposed change: split into catalog-admin.dto.ts (course DTOs and COURSE_FIELDS), access-admin.dto.ts (AccessProgram*, UserGrants*), keep requirement-group/prerequisite/offering DTOs in curriculum-admin.dto.ts; move userGrants presenter into access-admin.service. Rename curriculum-admin.service/controller to requirement-admin.* only if the team agrees (optional, S). Class names stay, so OpenAPI schema names stay.
Contract impact: none (verify openapi.json unchanged).
Write scope: curriculum-admin/curriculum-admin.dto.ts, new catalog-admin.dto.ts, access-admin.dto.ts, imports in catalog-admin.*, access-admin.*, grants.ts, curriculum-admin.*; csv-import.service.ts:23 and csv-import.dto.ts:7 and csv-import.service.spec.ts import COURSE_FIELDS/CreateCourseDto from the old file: deferred, in-flight PR #166 (csv-import.service.ts, spec); csv-import.dto.ts is not in the PR's list, so only its import line can move now.
Effort S, risk low, confidence high.
Verification: typecheck; curriculum-admin.dto.spec.ts and program-admin.dto.spec.ts; npm run build && npm run openapi -w src/backend then git diff --exit-code src/backend/openapi.json.
Alternatives: leave it (cost small, only reading); do it after #166 to avoid merge conflicts.

### BAC-5 Make the notification kind list and its links one fact that the web client cannot drift from
Problems it solves:
- Hidden link across backend and frontend: backend notification-kinds.ts:6-9 (NOTIFICATION_KINDS, LINKS_OF :40-45) is mirrored by hand in frontend/src/notifications/api.ts:3, NotificationsView.vue:21-24 and messages.ts:34-64. A new kind (for example another calendar event type) compiles on both sides but renders without icon or text on the client. Verified by rg for registration_soon in the frontend; whether a frontend spec guards the list was not verified.
- Hidden link: NOTIFYING_EVENT_KINDS (notification-kinds.ts:14) and notificationsDue decide which calendar event kinds make notifications, while the calendar entity owns CalendarEventKind; adding an event kind to the calendar silently produces no notification.
- Special case: reads create rows. list() and unreadCount() call createDueBeforeRead (notifications.service.ts:99-105, :119, :134), swallow and rate-limit errors in logFailure (:107-118). It is intended (ADR 0018, verify) but the GET has a write side effect that the schedule's 10-minute tick already covers.
Callers and dependents: rg of kinds in src/frontend/src (excluding specs): api.ts, NotificationsView.vue, messages.ts, testing/fixtures.ts (testing); frontend belongs to other surveyors, so this finding is limited to a guard.
Cost today: three frontend files plus backend must be edited by hand per kind, with no failing test if one is missed (not verified).
Proposed change: a spec test in the backend that reads src/backend/openapi.json NotificationKind enum and checks the frontend constants from a node-readable file; or generate the frontend list from the openapi enum. Keep the createDue-on-read behaviour (see Open questions).
Contract impact: none.
Write scope: a new spec file in src/backend/src/notifications or in the frontend; no production file.
Effort S, risk low, confidence med.
Verification: the new test fails when a kind is added on one side only.
Alternatives: leave it (kinds change rarely; 4 today).

### BAC-6 Document and test the one hard rule behind the guide seed: no test-only guide in a production build
Problems it solves:
- Special case: seed-guides.ts:26-34 has an if on NODE_ENV and a dynamic import of ./testing/guide-fixtures.js; tsconfig.build.json excludes only *.spec.ts, so testing/guide-fixtures.ts ships in dist. The guard is the NODE_ENV check plus seed-guides.spec.ts:30.
- Contention: GUIDE_FILES in content/index.ts is a hand list; content.spec.ts:15-17 already fails when a file is not listed (an existing enforcement; good).
Callers: guide-fixtures imported by test/guides.e2e-spec.ts:9, test/guide-seed.e2e-spec.ts:6, seed-guides.spec.ts:2, guide-fixtures.spec.ts:5, seed-guides.ts:30.
Cost today: low; the shape is understood. Listed because the compile-time exclusion is the stronger fix.
Proposed change: leave as is, or exclude src/**/testing/** from tsconfig.build.json and let the dynamic import fail loudly in dist (then --guide-fixtures works only from ts, which e2e uses). Needs a decision because the staging deploy may run db:seed --guide-fixtures from dist (check deploy/ and .github/workflows before changing; not checked).
Contract impact: needs decision (staging seed).
Write scope: tsconfig.build.json, guides/seed-guides.ts.
Effort S, risk med, confidence low.
Alternatives: leave it (recommended unless staging does not use the flag).

## 4. Looked at and left alone

- Grants: one mechanism. All writes go through AdminWriteService.run/runForRecipient, reads through .read; the two lock keys and the advisory-lock order are deliberate (ADR 0011 race handling). Do not merge program_admin_grants and global_admin_grants.
- guide-file.ts fan-in 15: it is a pure leaf of types and constants; 8 of the 15 importers are content files that only import the type. No cycle. Leave.
- guides seed hash/version rules in seed-guides.ts: they implement guides plan rules (version bump, withdrawal); the file is long but each function is one job.
- TranscriptService.onSaved with notifications as the only subscriber: it inverts the dependency so transcript does not import notifications and runs inside the save transaction on purpose. Keep.
- INSERT_FOR_EVENT raw SQL (notifications.service.ts:15-22): needed for ON CONFLICT DO NOTHING with a users filter and one round trip; snapshot columns are deliberate so a later calendar edit does not rewrite sent notifications (ADR 0018, assumption to confirm).
- clc-2025-shared.ts helpers and apcs-2024.ts vs apcs-2025.ts: apcs rows overlap (about 89 of 140 and 144 normalised lines match) but cohorts differ by printed page and curriculum text; not worth merging as long as buildCatalog checks conflicts. Revisit only with BAC-2 done.
- notification-schedule.ts timer (RUN_INTERVAL_MS, setTimeout with unref) and its spec: a deliberate scheduler without a dependency; fine.
- advisor/: imported by nothing in prod today; belongs to PR #77. Not judged dead.
- csv-import: described only (catalog and group-link preview/confirm with review hash); PR #166.

## 5. Open questions

1. Should reading the inbox keep creating due notifications (createDueBeforeRead) now that the schedule ticks every 10 minutes? It looks like a delivery guarantee for a server that was down at midnight; only a person can say which.
2. Does staging run db:seed --guide-fixtures from dist/? If yes BAC-6 stays as is.
3. Should curriculum-admin.service be renamed to match what it owns (requirement groups, links, prerequisites, offering terms)? Naming only, but it touches Swagger tags if the controller is renamed (needs decision).
4. Is the free-elective group in each CLC 2025 specialisation really the remainder of the 187-course list by the school's rules (Phụ lục 2), or a coincidence of the current data? BAC-2 derives it; a person who owns the curriculum data should confirm before merging.
