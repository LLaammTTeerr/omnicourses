# Review round 1: 14-actions-and-drafts (cvb/14-actions-and-drafts, 792bcd2..2b609fd)

Verdict: approve. No blocking findings.

## What I checked
1. Behaviour, line by line:
   - useAttempt and plans/actions.ts attempt: same order (busy on, error cleared, action, log "<what> failed:", set message, busy off). On 401 the error is not set and nothing is logged. Returns the same booleans.
   - reportFailure at each site: the log text is the same at all 11 call sites (SettingsView, admin/store, ExplorerView, NotificationsView x2, notifications/store, PlanTabs, PlannerEntry, plans/present, transcript/codes, SharePlanDialog loadState). It still does not toast or set the failure flag on 401. The rewritten `.catch(statusOf===401 || console.error)` chains behave the same.
   - SharePlanDialog: one busy kind became busy plus pending. busyWith(kind) gives the same label conditions. Every disabled binding stays the same. Closing the dialog still resets busy and the error. Error order and toast order are kept. The log texts are the same.
   - Sites left alone (auth/store x2, plans/session x2, TranscriptView save and loadCurriculumInBackground, AuditGate/PlanEditorView templates): each one differs from the helper (clear(), !auth.signedIn, a template condition, or it swallows the error). Leaving them out is correct.
   - ExplorerView with useProgramChoices: cohorts now come from all choices, not only the offered ones. They are still the same, because programChoices gives every non-offered program `cohorts: []`. programName is the same text. useAsyncLoad('the programs', fetchPrograms) gives the same log text.
   - groupGlyph/groupShort: same lookup. CourseDrawer used to fall back to '' on an unknown id and now uses `!`. The id is typed GroupId and the null group still gives ''.
   - autoFill and syncAutoFill against the old syncCurriculumAutoFill: same results for every branch. The only difference is that a non-null record now has its missing field as an explicit undefined, which reads the same through `!== undefined`. It now calls autoFilled.delete when no record exists. The old code never stored an empty record, so this changes nothing. When it writes the same value again, Vue does not trigger. The snapshot/baseline/savedState logic, cancel, and paste append/replace are the same. The MAX_ROWS guard is kept (in draft.ts, tested). The view acts on the result it returns.
2. Contract: the diff of openapi.json, migrations and package-lock.json is empty. No backend change at all.
3. Tests: async-load.spec.ts and groups.spec.ts only gain tests. draft.spec.ts is new. No other spec changed, and no it/expect was lost. The frontend has 82 files and 1293 tests, all passing.
4. Completeness: no `GROUPS.find` is left outside groups.ts. The remaining GROUPS uses are list iterations. The local attempt in plans/actions.ts and syncCurriculumAutoFill are gone. The docs (architecture.md, class-model.md) are updated.
5. Structure: depgraph on the base and on HEAD gives the same folder dependsOn sets, no folder or file cycles, and +1 file and +3 edges (draft.ts). async-load.ts -> api.ts is a new edge inside root, and api.ts imports nothing.
6. Repo rules: typecheck is clean and `npm run lint` passes (exit 0). There are no comments and no new dependency. All 5 commits are signed (G) with Conventional subjects. There is exactly one new .changeset file (empty).
7. Scope: no off-limits file is touched. scripts/layers.mjs is unchanged.

## Non-blocking
- src/frontend/src/sharing/SharePlanDialog.vue:28: `pending` starts as 'creating' even when nothing runs. It is only read through busyWith, so this is harmless, but `ref<... | null>(null)` would show the state honestly.
- src/frontend/src/plans/present.ts (glyphOf = groupGlyph) and src/frontend/src/sharing/SharedPlanView.vue:66 (const glyphOf = groupGlyph): these aliases add a second name for one thing. Using groupGlyph directly would be clearer.
- src/frontend/src/transcript/draft.ts:21: the local type name `Curriculum` shadows the meaning of curriculum/api's Curriculum type. Rename it to something like `FillSource`.
- src/frontend/src/transcript/draft.spec.ts: the append limit is tested only at 1 + MAX_ROWS. A `>=` mutation in appendPasted would pass. Add a case where rows plus pasted equals MAX_ROWS exactly and is accepted.
- The implementer report (scratchpad/batches/14-actions-and-drafts/report.md) does not exist. So the sites left alone, the async-load.ts-vs-api.ts rationale, and the layers.mjs edges (none) are not written down anywhere. My list above covers the sites.
