# Dashboard folder survey (src/frontend/src/dashboard/), branch refactor/cv-18-dashboard-folder

Read-only. Nothing was run (no tests, no typecheck). "Verified" = read in the file or found by grep; "assumed" = inferred. Paths are relative to src/frontend/src/. D = dashboard/, V = dashboard/DashboardView.vue, DT = dashboard/dashboard.ts, DM = dashboard/messages.ts.

## 1. Model of the folder
- DT (346): pure model. class Dashboard builds rows (one per requirement group with a minimum, plus combined minimums), per-term snapshots (done/failed/in progress/planned lines per row), the by-term strip, GPA change, slot credits. Also calendarEnd, donut geometry (DONUT, sector, segments), sparkline geometry (SPARK, sparkPoints, scaleOf), termShort. Imports: audit/api + audit/present (shownGroups), calendar/api (type), plans/api (type), groups (GROUP_IDS), terms, locale.
- DM (192): vi/en words for the screen. Imports locale, terms (types).
- routes.ts (11): one route; imports route-meta.
- V (925 = script 1-394, template 396-704, style 706-925): owns loading (plan, notifications, calendar, onboarding, past audits), term scrubber and picker, donut focus and tooltip, intro animation, "needs attention" list, markup. Imports calendar/api, notifications/api + messages, onboarding/api, plans/api + flip + last-plan, audit/AuditGate + api + messages + present, groups, locale, page-title, shell/Icon, terms, auth/store.
- Specs: dashboard.spec.ts (102, model), DashboardView.spec.ts (433, mounts the view; the only coverage of loading, attention, scrubber, picker).

Overall: the model/view split is right and DT is in good shape. The weak spots are in V's script (loading, attention list) and in a handful of copies of other features' knowledge.

## 2. Findings (most valuable first)

### F1. Give the extra loads one owner that logs failures, and take the loading out of the view
- Fix: move settled/loadPlan/loadExtras/loadPast (V:57-100) into one tested module in D that reports failures through reportFailure instead of swallowing them.
- Problems (verified):
  - V:57-63 `settled` is `catch { return null }`: no console line, no 401 distinction. Every other loader that tolerates failure uses reportFailure (plans/present.ts:104, transcript/codes.ts:9, notifications/store.ts:31, explorer/ExplorerView.vue:85). D never imports async-load. D contains no statusOf check, so there is no repeated 401 test to remove here; the gap is the opposite one: a failed plan/notification/calendar/onboarding/past-audit load leaves no trace at all.
  - Plan choice V:65-73 (remembered plan, else newest updatedAt) is a second implementation of plans/PlannerEntry.vue:21-24 (remembered plan, else plans[0]). The backend lists plans createdAt ASC (backend plans.service.ts:33), so with nothing remembered the dashboard shows the newest-edited plan and the "Planner" entry opens the oldest. Verified from the code; whether this is intended is unknown (question Q1).
  - All of this logic is only reachable by mounting the view (DashboardView.spec.ts:369 is the one test of failure).
- Typical change today: adding a fifth extra (say, registrations) means editing V's script, Extras (V:47-53), the Promise.all, and the view spec fixture; the failure path is silent.
- Concrete change: new D/extras.ts exporting `loadExtras()`, `loadPastAudit(term)` (returns DegreeAudit or null) and a pure `chooseDashboardPlan(plans, last)`; the catch calls `reportFailure('Loading the dashboard ...', e)` and returns null. V keeps the refs (extras, past, asked) and calls these. Do not change the choice rule (keep newest updatedAt).
- Write scope: D/DashboardView.vue, new D/extras.ts + extras.spec.ts. No other feature touched.
- Effort S-M. Risk low (existing spec 369 covers 500s; spec already mocks console.error there, so the new log line does not break it; assumed other specs that fail loads also spy console.error, check when doing it). Confidence high.
- Proof: DashboardView.spec.ts and dashboard.spec.ts unchanged and green; new extras.spec.ts pins: reportFailure called for 500, silent for 401, plan chosen by last id then newest.
- Alternative "leave it": works today; cost is silent failures in production and an unnoticed rule difference with the planner.

### F2. Make the "needs attention" list a pure, tested function and stop copying the notification maps
- Fix: move V:325-356 into a function in D (given audit, issues, slot credits, notifications, plannerTo, messages) and take the notification link and kind maps from the notifications feature instead of re-typing them.
- Problems (verified):
  - V:349-354 re-types notifications/NotificationsView.vue:18-23 (LINK_ROUTES: calendar/planner/audit to routes; KIND_LOOK: kind to icon). V:352 `link === 'calendar' ? 'calendar' : 'audit'` falls through to the audit route for any new link; V:353 `n.kind === 'transcript_changed' ? 'file' : 'calendar'` gives a new kind the calendar icon. Source lists are NOTIFICATION_LINKS / NOTIFICATION_KINDS (notifications/api.ts:4-7), so adding a kind or link compiles here and is silently wrong. (Planner link goes to the user's plan, V:144, so it needs one override; that is not a reason to copy the rest.)
  - V:44-45 LANGUAGE_CONDITION and CHECKED_ELSEWHERE restate the condition-id grammar ("group:", "combined:", "total_credits") that audit/present.ts:49-62 (conditionLabel, conditionAnchor) parses with `split(/:(.*)/s)`. V:339 builds its own lookup over unmet + notChecked while conditionFor (audit/present.ts:38) already searches all three lists.
  - The attention rules (which conditions show, order, tone) have no unit test; they are only checked through the mounted view (DashboardView.spec.ts:274, 288).
- Typical change today: a new graduation condition id or notification kind means reading V's script, NotificationsView and audit/present.ts; the compiler does not say which to edit.
- Concrete change: export LINK_ROUTES and KIND_LOOK from a notifications module (e.g. notifications/look.ts, moved out of NotificationsView.vue without behaviour change), add `conditionKind(condition)` next to conditionAnchor in audit/present.ts and use it for the regex, use conditionFor, and move the builder to D/attention.ts with a spec.
- Write scope: D/DashboardView.vue, new D/attention.ts + spec, notifications/NotificationsView.vue (import the maps), new notifications/look.ts, audit/present.ts (+spec). Cross-feature, so check with the owners of notifications and audit.
- Effort M. Risk low-medium (pure moves; the view spec pins titles, order and links). Confidence high on the copies, medium on the best home for the maps.
- Proof: view spec 274-300 unchanged; new attention.spec.ts with one case per item type; notifications specs unchanged.
- Alternative "leave it": acceptable while the kind and link lists are stable (4 kinds, 3 links); the risk is silent mis-routing when new notification kinds or links are added.

### F3. Use the existing owners for names, group labels and term order
- Fix: replace four small copies with imports from their owners.
- Problems (verified):
  - DT:123-127 `name()` re-implements courseName (curriculum/present.ts:5): `c.nameEn ?? c.nameVi` versus `(lang === 'en' && nameEn) || nameVi`. They differ only for an empty-string nameEn (assumed the API never sends one).
  - V:141 and V:683 `GROUPS.find((g) => g.id === ...)?.short[locale.lang]` is groupShort (groups.ts:28). V imports GROUPS only for this (V:5). plans/present.ts:151 already uses groupShort.
  - DT:93 `compare` is plans/board.ts:18 `compareTerms`, copy for copy. D cannot import it cleanly (plans internals), so it was copied. terms.ts is the neutral owner (it already has sameTerm, termKey).
  - V:12 imports `reducedMotion` from plans/flip.js, a general function living in the planner's animation module; ExplorerView.vue:135 re-types the same matchMedia test inline. (Needless link plus a hidden copy.)
- Typical change today: a rule such as "fall back to Vietnamese when English is missing" or a new term order helper must be changed in two places that nobody links.
- Concrete change: DT uses courseName; V uses groupShort; move compareTerms into terms.ts and import it in plans/board.ts, plans/present.ts, PlanEditorView.vue and DT; move reducedMotion into a shared module (e.g. shell/motion.ts, or terms-free place the owner prefers) imported by plans/flip.ts, drag.ts, PlanEditorView.vue, V and ExplorerView.vue.
- Write scope: D (2 files), terms.ts, plans/board.ts, plans/present.ts, plans/PlanEditorView.vue, plans/flip.ts, plans/drag.ts, explorer/ExplorerView.vue, one new tiny module. The reducedMotion part touches the planner and explorer; split it into its own PR if the stack owner wants D-only work.
- Effort S for courseName + groupShort (D only); M for the term and motion moves. Risk low. Confidence high.
- Proof: typecheck; plans, explorer, dashboard specs unchanged; dashboard.spec.ts English-name case if absent (assumed there is none for empty nameEn, add one).
- Alternative "leave it": the two D-only swaps are worth doing regardless; the cross-feature moves can wait.

### F4. Term labels: one place for the Summer rule and the words
- Fix: move termShort out of DT into DM and derive targetTerm/termSection from one helper.
- Problems (verified): DT:345-346 holds Vietnamese and English words ('Hè ', 'Summer ', 'HK', 'T') in a logic file, outside the messages table; the term-3 test appears three more times, DM:93, 102, 154, 163, plus `years` DM:4 and the slice(2) form in DT:346. terms.ts:51 termName has no Summer branch, so the audit table (audit/AuditView.vue:228) and the planner print "HK3 2024–2025" while the dashboard prints "Hè 24–25" for the same term. Assumed: the owner has not decided which is right (Q3), so this finding only consolidates D.
- Typical change: renaming or abbreviating "Hè" needs four edits in two files.
- Concrete change: add `termShort(term)` to DashboardMessages; one internal `termKindWord` helper in DM; delete the export from DT; V:410, 423, 438, 493, 671, 678 call `m.termShort(...)`; dashboard.spec.ts:4,... import changes accordingly.
- Write scope: DT, DM, V, dashboard.spec.ts. Effort S. Risk low (strings identical; spec 'HK1 24–25' at DashboardView.spec.ts:362 pins). Confidence high.
- Alternative: leave; costs only a few lines.

### F5. Render the group spoiler from data instead of four hand-written blocks
- Fix: build the sections (in progress, failed, per-term planned, not in plan, passed) as data in DT and loop once in the template.
- Problems (verified): V:585-615 writes the same `.db-sec` heading and `.db-item` row five times; the Retake chip markup is pasted three times (V:588, 602, 613); the credit total for failed is computed in the template (V:592); grade formatting differs by section (grade vs shortGrade, V:594 vs 613) and lives in the template.
- Typical change: adding a column or changing the chip means editing 3-5 places in a 925-line file.
- Concrete change: `sections(state): {key, tone, title(m), total, lines[]}[]` in DT (or a local small SFC `GroupSpoiler.vue` in D), template loops `v-for` sections and lines. Keep every class and data-test.
- Write scope: V (+ DT/spec). Effort M. Risk medium (DOM must stay identical: classes sq/cur/fail/todo, order of sections, slot lines); the view spec checks groups only partly (assumed; snapshot the rendered HTML before and after with a one-off script). Confidence medium.
- Alternative: leave; it is repetitive but readable and stable.

### F6. Pull the interaction state out of the view's script
- Fix: three small composables or modules in D, each with a spec: term scrubber/picker (V:108-118, 227-307), donut focus/center swap/tooltip (V:152-217), intro animation (V:358-374, 147-150).
- Problems (verified): V script is 394 lines of timers and DOM handlers (five setTimeout handles, V:155, 170, 236, 365; manual cleanup V:388-393); the tooltip placement math (V:182-190) and sparkline computed (V:313-319) are pure but only reachable by mounting; `spark` could be a DT function next to scaleOf/sparkPoints.
- Typical change: touching hover timing means finding handlers spread over 200 lines and the view spec uses real waits (spec 206-209, 266-270: wait(150), wait(250)).
- Concrete change: D/scrubber.ts (sel, view, pick, show, picker open and keys), D/donut-focus.ts (focus, centerKey, swapping, tip), D/intro.ts (k, intro, playIntro), `sparkOf(history)` into DT. Constants stay named.
- Write scope: D only. Effort L. Risk medium-high (timers, focus order, listeners). Confidence medium; do after F1, F2 so the view is smaller. Is the split of DT right? Yes: DT is the model plus geometry, all pure; I would not split it further (DT geometry 276-343 is 70 lines, one job: drawing numbers).
- Proof: DashboardView.spec.ts unchanged (esp. 195-272), plus browser run by a person for hover feel (cannot be proven by unit tests alone).
- Alternative: leave; the view is large but the behaviour is pinned by 30 tests.

### F7. Small surplus in DT
- Fix: one `attemptState(a)` and no needless exports.
- Problems (verified): the test `!a.passed && !a.inProgress` / `inProgress ? 'cur' : passed ? 'done' : 'fail'` appears at DT:133-135 (retaken), 202 (failed), 207 (state); colour lookup is by group id at DT:201, 207, 219 but by course code at DT:222 (two ways to answer "which row is this"); `sector` is exported (DT:302) but used nowhere outside DT (grep over D, specs, views: none); exported types Colour, Row, CourseLine, TodoTerm, TermCourse, CellState, StripCell, StripTerm, DashboardInput, SegmentKind, Segment, Plotted are not imported anywhere (types only, harmless).
- Concrete change: add `attemptState`; drop `export` from sector (keep types if the owner likes documenting the shape). Effort S, risk low, confidence high. Value is small; do it with F4.

## 3. Looked at and left alone
- Dashboard.d = passedCredits + overflowInCredits (DT:160), unplaced = max(0, left - planned) (DT:197), retake chip (DT:133). These are display sums of fields the API returns, not prerequisites, offering terms, caps or graduation status, so ADR 0015's rule (the browser must not keep its own copy of engine rules) does not clearly apply. Assumed, not decided: see Q2. `remaining`, `left`, GPA change come straight from the API (V:323, DT:239-247).
- The term picker (V:413-445, 263-307) next to components/SelectMenu.vue: SelectMenu has no preview-on-hover and preview-on-arrow, and giving it a parameter only this screen understands would be worse. Keep.
- `.db-tip` (V:751) next to shell/TooltipHost.vue: different job (rich card following the pointer vs a title tooltip). Keep.
- Styles: no rule in V duplicates a global token. `.g-none` (V:707) is the only definition of the unmapped colour; `--c-air`/`--c-half` (V:~766) intentionally override the global `--c-air` (styles.css:88, 7% of surface) with a transparent 20%, and `--c-half` is used nowhere else. Hard-coded #fff (V:707, 888, 890) is cosmetic; skipped.
- `catch {}` at V:363 (sessionStorage in private mode) matches router.ts:110, theme.ts:12, last-plan.ts:16.
- Number formats V:134-137 versus audit/present.ts formatScore: different digits (fixed 2 / 1 versus max 2), so not the same function; the per-call `new Intl.NumberFormat` is a speed point only.
- Messages DM versus audit/messages.ts statuses (Đã đạt, Đang học, Chưa đạt): same words, kept per feature; sync by hand but harmless wording.
- AuditGate.vue:27 `statusOf(error) !== 401` is outside D and hides the box, while useAsyncLoad (async-load.ts:68) still logs 401; not D's repeated check.
- routes.ts: fine. NOTIFICATIONS_SHOWN (V:34) is not a bug on its own but see Q4.

## 4. Questions for the frontend owner
- Q1. With no remembered plan, should the dashboard show the newest-edited plan (V:69) while "Planner" opens the oldest (PlannerEntry.vue:23, backend createdAt ASC)? Which rule is wanted? (Changing either changes behaviour.)
- Q2. Is passedCredits + overflowInCredits (DT:160) the figure the audit calls "counted in the group"? If so, should the backend expose it (API change, Project Lead and rule engine owner) so the browser stops summing?
- Q3. Summer wording: dashboard says "Hè 24–25" but termName (terms.ts:51) says "HK3 2024–2025" in the audit table and planner. Intended?
- Q4. The attention list only sees the latest 10 notifications (V:34, 78). Unread items older than that never show. Intended?
- Q5. May reducedMotion and compareTerms move to shared modules (touches planner and explorer files)?
