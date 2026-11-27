# Survey: frontend planning features (plans, sharing, transcript, explorer, onboarding, curriculum, audit)

Evidence base: reading of the files named below, rg searches over src/frontend/src (non-spec files unless stated), a script that compared the CSS rule lists of sharing/SharedPlanView.vue against plans/PlanEditorView.vue + plans/IssuesPanel.vue, and git show --stat 3c4da22. Nothing was run or changed.

## 1. Model of the area

- Each folder holds one feature: api.ts (typed calls, all through requestAsUser from auth/store.ts), messages.ts (vi/en text), view(s), and one logic module (present.ts / rows.ts / answers.ts / board.ts). The contract specs (testing/contract.ts) check api.ts types against backend/openapi.json for shape and enums in every feature.
- plans/: PlanEditorView.vue (964 lines) is the shell. session.ts (load, save, retry, drop preview), present.ts (usePlanCourses: curriculum + audit + transcript codes; usePlanView: row/tile view models), board.ts and drag.ts and flip.ts (pure board and DOM helpers), IssuesPanel.vue, StatusStrip.vue, PlanTabs.vue, actions.ts (busy/error wrapper), lock.ts and last-plan.ts (localStorage).
- sharing/ (all new in #207): api.ts (own copies of plan types: SharedPlan*), SharePlanDialog.vue (478, owner side), SharedPlanView.vue (1077, public read-only page; 219 script, 260 template, about 590 style).
- transcript/: TranscriptView.vue (410) holds the draft rows, curriculum auto-fill, save, paste hand-off. rows.ts (draft model and validation), paste.ts (247, pure parser), PasteTranscriptDialog.vue, codes.ts (a second, tiny transcript reader for the planner).
- explorer/: ExplorerView.vue + CourseDrawer.vue + readiness.ts. Standing (transcriptStatus, readiness, missingPrerequisites) comes from the API; readiness.ts only inverts prerequisite lists.
- onboarding/: store.ts (Pinia, useAccountCache from auth/store.ts), answers.ts (form model), views. curriculum/: api.ts + present.ts (courseName, fold/matches, groupColour, orderGroups). audit/: AuditView and api/present; Dashboard* belongs to PR #214 (described only).
- State: auth token in sessionStorage (auth/store.ts); per-account caches in Pinia (onboarding) and in composables that refetch on every mount (useTranscriptCodes, fetchAudit inside usePlanCourses). Plan draft state lives in usePlanSession. Locks and last plan in localStorage keys cleared by auth/store.ts on sign-out.
- Dependencies: everything imports root leaves (locale, api, terms, groups, async-load) and auth/store. Two-way pairs in my area: plans<->sharing (plans/PlanEditorView.vue:13 imports sharing/SharePlanDialog.vue; sharing/SharedPlanView.vue:10-12 imports plans/api, plans/messages, plans/present) and auth<->plans (auth/store.ts:4-5 import plans/last-plan and plans/lock; plans/{api,session,actions}.ts import auth/store).

## 2. Ideal direction

- One plan-board vocabulary: a pure "issue and load view" leaf (tone, cap state, meter, kind style, clause of a citation) used by editor rows, the issues rail, the status strip and the shared page. The shared page is the editor's presentational components with the editing hooks left out, not a second implementation.
- One stylesheet for plan-board classes (.trow, .tload, .cap, .ptile, .vitem, .rail-*, .cov-*), not one copy per view.
- One owner for limits that the server enforces (transcript sizes, plan name, cohorts), checked against openapi.json by the existing contract specs.
- One "attempt an action, swallow 401, show a failure message" helper instead of 23 inlined catch blocks.
- Per-account browser state registered in one place, so auth does not import plan files.
- Views stay thin: script that holds logic (auto-fill, snapshot/diff, issue adapters) moves to a tested module.

## 3. Findings

### FRO-1 Make SharedPlanView reuse the editor's presentation: move its view-model logic out of the SFC, share the row/tile/coverage/issue components and the CSS with plans/
- Problems it solves
  - Duplicated template + logic (hidden link): SharedPlanView.vue:160-190 (buildRowView) re-derives load, meter, cap, tone, atLeast ("load_not_checked") exactly as plans/present.ts rowView (present.ts:322-345); SharedPlanView.vue:132-157 (buildTileView) re-derives tone, "violations then flags" ordering, slot title and colour exactly as plans/present.ts tileView (present.ts:229-250). A change to "what a term row shows" needs edits in both, and the only link is a coincidence in names.
  - Duplicated styles (hidden link): of the 105 rules in SharedPlanView's style block, 46 share a selector with PlanEditorView.vue or IssuesPanel.vue (16 byte-identical: .cov-list, .trow.has-violation, .trow.has-flag, .rail-n.zero, .issue-counts, .rail-list, .vitem .ic, .vitem.flag .ic, .vitem b, .vfoot, .ref .icon, .rail-empty .icon, .rail-empty b, .unknown-list, .unknown-list li, .unknown-list .icon; 30 more with the same selector and a slightly different body: .trow, .tload, .cap and its ticks, .ri, .ptile.has-*, .flag-badge, .rail-head, .vitem, .vitem p, .ref ...). The "diff" ones are drift already, not intent.
  - Adapter hack (special case): toEngineIssue (SharedPlanView.vue:65-80) rebuilds a PlanIssue and stuffs a group NAME into requirementGroupId, then wordIssue passes ctx {requirementName: i => i.requirementGroupId}. It works only because both callers know that convention.
  - Same helpers copied: clause() citation regex at SharedPlanView.vue:63 and in plans/IssuesPanel.vue (const clause); glyphOf at SharedPlanView.vue:62 (see FRO-6). The citation-link markup (a.ref with REGULATION_URL) is in both templates.
  - Untested logic in an SFC: buildRowView, buildTileView, curriculumMeta (SharedPlanView.vue:97-111) and the counts live in the script of a 1077-line view; SharedPlanView.spec.ts (332 lines) tests them only through the DOM.
- Callers and dependents affected: SharedPlanView.vue is routed only from router.ts (rg "SharedPlanView"); PlanEditorView.vue, IssuesPanel.vue, StatusStrip.vue are the editor-side readers of the same classes. Searched with rg for each selector and helper name across src/frontend/src.
- Cost today: a visual or wording change to a plan row, a tile, the cap meter or an issue card (for example the #218-style new issue code, or a print fix) needs the same edit in two views and two style blocks; the public page is the one nobody opens in a normal session, so it drifts.
- Proposed change (three safe steps, each its own PR):
  1. Add sharing/view.ts: pure functions buildRowViews(shared, text) and buildTileView, curriculumMeta, withheld titles, counts, plus the issue adapter. Make them call the leaf from FRO-2 (meter, capOf, toneOf, strongest). Delete toEngineIssue by giving the leaf functions a structural type (Pick<PlanIssue, 'code' | 'kind'>) so no adapter is needed; give wordIssue an explicit "requirement name" argument instead of the id-stuffing. Unit-test it; SharedPlanView.vue shrinks to about 100 script lines.
  2. Extract presentational components used by both: TermLoad.vue (the .tload + .cap meter + caps label), IssueCard.vue (the .vitem with citation link), CoverageList.vue (.cov-list / .cov-item). The editor passes its richer props (delta, preview) through optional props or slots; the shared page omits them. Keep the editor's drag, preview, lifted and undo behaviour out of the shared components.
  3. Move the rules of step 2's components into those components' scoped style (or one plans/board.css imported by both). Delete the 46 copies from SharedPlanView.vue and the matching ones from IssuesPanel/PlanEditorView where the component now owns them.
  Retire: the SharedPlanView-private row/tile builders, the two clause() copies, the duplicate rules.
- Contract impact: none (no route, DTO or openapi change; DOM text and data-test ids unchanged).
- Write scope: src/frontend/src/sharing/SharedPlanView.vue, new sharing/view.ts (+spec), new components under src/frontend/src/plans/ (TermLoad, IssueCard, CoverageList), plans/PlanEditorView.vue, plans/IssuesPanel.vue, plans/StatusStrip.vue (coverage chips). Step 1 alone touches only sharing/ and the leaf from FRO-2.
- Effort L (step 1 M, step 2 M, step 3 M), risk med (print layout and scoped-style cascade; the editor is the most edited screen), confidence high on the duplication, med on how much of the editor markup can be shared without props creep.
- Verification: existing SharedPlanView.spec.ts, SharedPlan.browser.spec.ts, PlanEditorView.spec.ts, IssuesPanel tests unchanged and green; a screenshot diff of /shared/<token> in light and dark and in print media before and after; new sharing/view.spec.ts with the fixtures from sharing/api.spec.ts.
- Alternatives: leave it (cost grows with every plan-row change); a full generic "PlanBoard" component with read-only mode (the editor's drag/undo/preview coupling makes that a rewrite, so no).

### FRO-2 Split plans/present.ts into a pure issue-view leaf and the composables that load data, so sharing stops importing the planner's data layer
- Problems it solves
  - Needless link: sharing/SharedPlanView.vue:10-12 imports BAR_CODES, capOf, ISSUE_KINDS_SHOWN, KIND_STYLE, meter, toneOf from plans/present.ts. That file also imports audit/api, curriculum/api, transcript/codes, async-load and fetches in usePlanCourses (present.ts:136-150: fetchAudit at module use, transcript fetch). The public, signed-out page depends on the signed-in planner's loaders.
  - Folder cycle plans<->sharing (PlanEditorView.vue:13 -> sharing; SharedPlanView -> plans). Making the leaf pure and tiny reduces the cycle to "plans mounts the share dialog".
  - Shared type use in the other direction: sharing/api.ts:4 imports CreditCaps, PlacementKind, PlanIssueCode, PlanIssueKind, TermKind from plans/api.ts. That is fine (types) but should come from the same leaf as the constants.
  - plans/present.ts is 354 lines of two unrelated jobs (what an issue looks like; how to load the board's data).
- Callers and dependents affected: rg of "plans/present" and "from './present" in plans/: PlanEditorView.vue, IssuesPanel.vue, StatusStrip.vue, session.ts (RowPreview type), sharing/SharedPlanView.vue, present.spec.ts.
- Cost today: any sharing change drags plans' loaders into the import graph and the test setup (SharedPlanView.spec.ts must mock nothing today only because the loaders are never called, which nobody sees).
- Proposed change: new plans/issue-view.ts holding ISSUE_KINDS_SHOWN, KIND_STYLE, strongest, BAR_CODES, METER_HEADROOM_CREDITS, capOf, toneOf, meter and the citation helper clause() (from FRO-1), with no vue-composable and no api import (only types). plans/present.ts re-exports nothing; callers import from the new file. present.spec.ts' meter/cap tests move beside it.
- Contract impact: none.
- Write scope: new plans/issue-view.ts (+spec), plans/present.ts, plans/IssuesPanel.vue, plans/StatusStrip.vue, plans/PlanEditorView.vue (import lines), sharing/SharedPlanView.vue (import lines). Do it before or together with FRO-1 step 1.
- Effort S, risk low, confidence high. Verification: typecheck + existing unit tests; the depgraph script shows sharing no longer reaches audit/curriculum/transcript through plans.
- Alternatives: move SharedPlanView into plans/ (hides the cycle but widens plans/); leave it.

### FRO-3 Register per-account browser state in one place so auth/store.ts stops importing plan files
- Problems it solves
  - Needless link / hidden list: auth/store.ts:4-5,19-22 imports forgetLastPlan and forgetLocks from plans/ and calls them in clear(). Any new per-account local state (the next feature's "last viewed", "dismissed hint") must be added to that function by hand, in a file the feature does not own. Caches in Pinia use a different path (onboarding/store.ts watches auth.user.id; useAccountCache forget).
  - Duplicate code: plans/lock.ts and plans/last-plan.ts repeat try/catch around localStorage; shell/theme.ts, shell/sidebar.ts, locale.ts, PlanEditorView.vue:377-386 (RAIL_KEY) repeat the same try/catch pattern (the last one is a UI preference, not account data; keep it out of the forgetting list).
  - Folder cycle auth<->plans.
- Callers and dependents affected: rg "forgetLocks|forgetLastPlan" (auth/store.ts, plans/*, specs); rg "localStorage|sessionStorage" lists the other keys (theme, sidebar, lang, rail, chunk reload: none are account data).
- Cost today: a feature that stores account-bound data in the browser edits auth/store.ts and risks leaking another student's data on a shared computer (a privacy concern, AGENTS.md hard rule 3 spirit).
- Proposed change: add a root leaf account-storage.ts with accountStorage(key) returning {read, write, remove} (safe try/catch) and a registry; lock.ts and last-plan.ts create theirs with it; auth/store.ts calls forgetAccountStorage() only. Optionally have useAccountCache register its forget() with the same registry so one sign-out hook clears both. Remove forgetLocks/forgetLastPlan exports.
- Contract impact: none.
- Write scope: new src/frontend/src/account-storage.ts (+spec), plans/lock.ts, plans/last-plan.ts, auth/store.ts (+ auth/store.spec.ts expectations).
- Effort S, risk low, confidence high. Verification: auth/store.spec.ts sign-out clears both keys; a spec that a newly registered key is cleared.
- Alternatives: leave; a signed-out watcher in each feature (more hooks, same list problem).

### FRO-4 Put every limit the server enforces in one checked place: contract specs for transcript, plan name, cohorts
- Problems it solves
  - Hidden links, constants copied from the backend with no check:
    - transcript/rows.ts:6-10 MAX_ROWS 300, MAX_CREDITS 30, MAX_NAME_LENGTH 255, MIN_YEAR/MAX_YEAR vs backend/src/transcript/transcript.dto.ts:9-11 (MAX_TRANSCRIPT_ROWS 300, MAX_ROW_CREDITS 30, MAX_GRADE 10) and backend/src/common/column-limits.ts:1 (NAME_MAX_LENGTH 255). rows.ts parseGrade also hardcodes 10 (rows.ts:37).
    - plans/actions.ts:9 PLAN_NAME_MAX_CODE_POINTS 100 vs backend/src/plans/plan.entity.ts:5 PLAN_NAME_MAX_LENGTH 100.
    - onboarding/api.ts:24 OFFERED_COHORTS ({APCS: [2024, 2025]}) vs backend/src/onboarding/onboarding-options.ts:3. onboarding/api.spec.ts:22 checks only the program keys, not the cohorts.
    - onboarding/answers.ts:30 CREDITS_COLUMN_INT32_MAX (a database column limit in the UI).
  - Of these, openapi.json already carries credits maximum 30 and maxItems for rows and plan terms (plans/api.spec.ts uses contractMaxItems), but transcript/api.spec.ts checks only the result and term enums, so a backend change to a limit passes every frontend test.
- Callers and dependents affected: rg of each constant name (transcript/rows.ts, paste.ts, PasteTranscriptDialog.vue, TranscriptView.vue, plans/actions.ts, onboarding/answers.ts and their specs).
- Cost today: raising MAX_TRANSCRIPT_ROWS or the name length means knowing the frontend copy exists; nothing fails when you forget.
- Proposed change: extend testing/contract.ts with contractMax / contractMaxLength / contractMinimum helpers and add assertions in transcript/api.spec.ts (maxItems of rows, credits maximum), plans/api.spec.ts (name maxLength, if present in the DTO), onboarding/api.spec.ts (cohort description or example, see below). Where openapi lacks the number today (name length, grade max, cohorts), mark it needs decision: adding @ApiProperty maxLength/maximum or a description to the DTO changes openapi.json, which is a contract file. Without that change, add a backend-side spec that imports both sides' constants only if cheap; otherwise leave those copies and list them in docs.
- Contract impact: needs decision for the DTO annotations (openapi.json would gain maxLength/maximum entries; additive, but it is committed byte for byte). The contract-spec part alone has none.
- Write scope: src/frontend/src/testing/contract.ts, transcript/api.spec.ts, plans/api.spec.ts, onboarding/api.spec.ts; (if approved) backend DTOs under src/backend/src/{transcript,plans,onboarding}/ and openapi.json (PR #77 and PR #166 list openapi.json and onboarding/env as in-flight: deferred: in-flight PR #77 for any openapi.json edit).
- Effort S (spec part), M with DTO annotations; risk low; confidence high.
- Verification: specs pass; temporarily changing a frontend constant makes one fail.
- Alternatives: share a constants package (too heavy for four numbers; ADR 0015 plans a rules package, not this); leave it.

### FRO-5 Move TranscriptView's draft logic into a tested transcript/draft.ts
- Problems it solves
  - Logic in a view (special cases, no tests of their own): TranscriptView.vue script (about 190 lines) holds loadCurriculumInBackground (swallows every error, TranscriptView.vue:~38-55), syncCurriculumAutoFill (about 35 lines of "fill only if empty or still equal to my last fill", with a WeakMap), the baseline/snapshot/savedState triple (three copies of "what was saved"), appendPastedRows/replaceWithPastedRows (silent return when over MAX_ROWS, line 134 and 141: the dialog already disables the buttons, so the second guard is dead or hides a bug).
  - Three separate transcript readers: TranscriptView's fetchTranscript, transcript/codes.ts useTranscriptCodes (planner), plans/present.ts fetchAudit (planner). Each repeats ".catch(401 || console.error)".
  - transcript/paste.ts and rows.ts are good (pure, tested). The gap is only the glue.
- Callers and dependents affected: TranscriptView.vue only (rg "syncCurriculumAutoFill|loadCurriculumInBackground"); codes.ts is imported by plans/present.ts.
- Cost today: an auto-fill rule change (for example "also fill from another program") is testable only by mounting the 410-line view and driving inputs.
- Proposed change: new transcript/draft.ts exporting useTranscriptDraft(curriculumCourses) (rows, baseline, dirty, diff, save, cancel, paste append/replace with the limit check) and a pure autoFill(row, course, previous) returning the new row and the record of what it filled. TranscriptView.vue keeps focus handling, toast and route-leave. Drop the duplicate MAX_ROWS guard in the view if the dialog is the only caller (verify with the existing spec first).
- Contract impact: none.
- Write scope: src/frontend/src/transcript/{TranscriptView.vue, draft.ts, draft.spec.ts}.
- Effort M, risk low-med, confidence med-high. Verification: TranscriptView.spec.ts (342 lines) unchanged and green; new draft.spec.ts for autoFill cases (empty, previously autofilled, user-edited).
- Alternatives: leave (the view is readable); move only autoFill (smallest slice: S).

### FRO-6 One attempt helper for "run an action, ignore 401, report anything else", and one program-choice composable
- Problems it solves
  - Duplicate logic (hidden link): 23 non-spec sites use "if (statusOf(e) !== 401) { console.error(...); show failure }" across 14 files (rg: sharing/SharePlanDialog.vue x4, plans/session.ts x2, auth/store.ts x2, notifications x3, and one each in actions.ts, PlanTabs, PlannerEntry, present.ts, codes.ts, ExplorerView, SettingsView, admin/store.ts). Whether 401 stays silent is a rule each caller has to remember.
  - SharePlanDialog.vue:~112-175 (createLink, saveChoices, revokeLink) are three copies of "busy flag, clear error, try, catch 401, finally" and a fourth in loadState. plans/actions.ts already has exactly this as attempt(what, action). SharePlanDialog does not use it.
  - ExplorerView.vue:35-44 duplicates onboarding/answers.ts useProgramChoices (programs load, offered-only choices, cohorts, programName: ExplorerView.vue:44 equals answers.ts:92 character for character). The explorer imports programChoices from onboarding/answers.ts but re-implements the rest.
  - GROUPS.find((g) => g.id === id)!.glyph appears 7 times (SharedPlanView.vue:62, audit/present.ts:27, admin/CurriculumAdmin.vue:149, explorer/ExplorerView.vue:110, explorer/CourseDrawer.vue:35, plans/present.ts:195-196, plans/StatusStrip.vue:24).
- Callers and dependents affected: sites listed above, found with rg "statusOf\(e\) (!==|===) 401" and rg "GROUPS.find".
- Cost today: the next screen with a mutating call copies the block again; the SharePlanDialog copy already differs from actions.ts (no onBeforeRouteLeave guard, different error field).
- Proposed change: (a) move attempt() from plans/actions.ts into async-load.ts or api.ts as useAttempt(what) returning {busy, error, run}; have SharePlanDialog and plans/actions use it; replace the read-only fire-and-forget sites with one reportFailure(what, e) in api.ts. (b) export useProgramChoices from onboarding/answers.ts and use it in ExplorerView (add an offeredOnly flag or filter in the explorer). (c) add groupGlyph(id) and groupShort(id, lang) to groups.ts and replace the 7 lookups.
- Contract impact: none.
- Write scope: (a) api.ts or async-load.ts, plans/actions.ts, sharing/SharePlanDialog.vue; (b) onboarding/answers.ts, explorer/ExplorerView.vue; (c) groups.ts plus its 7 callers. Split into three PRs. Do not include audit/DashboardView* or shell/icons.ts (PR #214).
- Effort M overall (each S), risk low, confidence high. Verification: existing view specs; SharePlanDialog.spec.ts covers busy/error; a new spec for useAttempt (401 stays silent, other error logs once and sets error).
- Alternatives: leave the 401 sites (each is 3 lines); do only (b) and (c), which have the clearest payoff.

### FRO-7 Surplus and special cases in sharing/ (small, do with FRO-1)
- sharing/api.ts: UpdatePlanShareBody, PlanShareStatus (aliases, referenced only by their own definition: rg over src/frontend/src) and NotShared (used only by sharing/api.spec.ts, no production reader). Delete them; keep the spec's reference by pointing it at the real type.
- SharedPlanView.vue:25-50 sets and restores <meta name="robots"> by hand (two module-level variables, 25 lines). Move to a usePageTitle-style composable (page-title.ts is the sibling) so every public page can reuse it; add a unit test. The other public pages (guides) have their own head handling; check before generalising (assumption).
- SharePlanDialog.vue copy-to-clipboard has an execCommand fallback chain (tryWriteClipboard then execCommand then notice). Keep: it is a real browser constraint (insecure context). Only move it to a small copyText(text, input) helper so it can be tested.
- Contract impact: none. Write scope: sharing/api.ts, sharing/api.spec.ts, sharing/SharedPlanView.vue, page-title.ts or new head.ts. Effort S, risk low, confidence high (aliases: verified by rg; robots: assumption about reuse).

### FRO-8 Decide where the domain classification of requirement groups lives (groupColour) and whether the browser may invert prerequisites (unlockedBy)
- Problems it solves
  - Domain logic in the browser (hidden link): curriculum/present.ts:21-38 classifies a requirement group into one of 8 buckets by regular expressions over the Vietnamese/English group NAME ("non computer science", "toan", "vat ly"...). A curriculum admin who renames a group (F12) silently changes its colour, glyph, order (orderGroups) and the planner's slot colour. It is used by explorer, audit, plans, sharing, admin. It does not decide an academic rule (colour only), so AGENTS.md hard rule 1 is not at stake, but the data it keys on is editable content.
  - explorer/readiness.ts unlockedBy(groups, code): inverts prerequisites[] client-side. It assumes "course.prerequisites contains code" means "this course unlocks that one" (AND-list semantics). ADR 0015 says the frontend must not keep its own copy of rule logic; this is a list inversion, not a rule, and APCS 2024/2025 have only CS469->CS470, but if prerequisites ever get alternatives the inversion silently lies. standing (API) already returns readiness and missingPrerequisites per course, so "what does this unlock" could come from the same endpoint.
- Callers and dependents affected: rg "groupColour|orderGroups" (curriculum/present.ts, plans/present.ts, audit/present.ts, explorer, sharing, admin); rg "unlockedBy" (explorer only).
- Proposed change: needs decision. Option A (no contract change): keep groupColour but move COLOUR_RULES into groups.ts beside GROUPS, with a spec listing the APCS 2024 and 2025 group names and their expected colour, so a renamed seed fails a test. Option B (contract change): the API returns a group category for each requirement group; the regex goes away. For unlockedBy: keep as is and name it in a spec with the one real prerequisite, or add "unlocks: string[]" to the standing response.
- Contract impact: A: none. B and the unlocks field: needs decision (new DTO fields, openapi.json; deferred: in-flight PR #77 for openapi.json).
- Write scope (A): curriculum/present.ts, groups.ts, specs. Effort S (A) / L (B), risk low (A), confidence med.
- Alternatives: leave.

## 4. Looked at and left alone

- sharing/api.ts keeps its own SharedPlan* types instead of reusing Plan*: the public DTO deliberately has names, not ids (no requirementGroupId), and the contract spec (sharing/api.spec.ts) enforces its shape. Right as is.
- plans/session.ts SAVE_RETRY_MS and the wait() retry loop: a real network-resilience behaviour with tests (#197 settled the split).
- plans/present.ts capOf/toneOf/meter derive from engine issue CODES; they present the server's report and decide nothing, so ADR 0015 and hard rule 1 hold. The drop preview still asks the server (ADR 0015 is "accepted, not built").
- transcript/paste.ts size (247 lines): pure, tested (paste.spec.ts 210 lines), one job. Leave.
- Per-feature api.ts + messages.ts + contract spec convention: followed by all seven folders; the messages files are large because they are vi+en text.
- Duplicated sessionStorage CHUNK_RELOAD_KEY in router.ts and theme/sidebar localStorage in shell: outside my area (shell/router); not account data.
- audit/ views: AuditView.vue and audit/present.ts are consistent with the conventions; Dashboard* belongs to PR #214 (described only: its dashboard.ts and DashboardView.vue are not touched by any proposal here).

## 5. Open questions for a human

1. FRO-8: may the backend add a stable category to requirement groups (and optionally "unlocks" to the standing response)? If not, accept a spec that pins APCS group names to colours.
2. FRO-4: may the transcript, plan-name and onboarding DTOs gain @ApiProperty maxLength/maximum (an additive openapi.json change)? It needs to be sequenced after PR #77.
3. FRO-1: is the shared page meant to stay visually identical to the editor rows (my assumption), or is a simpler printable layout wanted? That decides how much CSS can be shared.
4. Is the shared plan page expected to be indexed ever? (It sets noindex, nofollow; FRO-7 would make that a reusable rule for public pages.)
