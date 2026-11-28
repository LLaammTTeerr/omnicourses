# Review round 1: batch 10-plan-view (cvb/10-plan-view, base 9eef108)

Verdict: approve. No blocking findings.

## What I checked
1. Behaviour, line by line:
   - issue-view.ts: ISSUE_KINDS_SHOWN, KIND_STYLE, strongest, BAR_CODES, METER_HEADROOM_CREDITS, capOf, toneOf, meter and clause are byte-identical to the old present.ts / IssuesPanel.vue / SharedPlanView.vue bodies. Only the parameter types got wider (Pick<PlanIssue,'code'|'kind'>), and the Meter and CapState types are named now.
   - sharing/view.ts: buildTileView, buildRowView, curriculumMeta, withheldTitles, the placed/byKind/listed/violationCount lists, orderedGroups and shortCount give the same results as the old component code. Kinds are in the same order. The old "?? []" and "if (!cur)" guards are now handled by the SharedPlan types (curriculum and issueCodesNotShown are required) plus the shared.value checks in the component. byKind covers every PlanIssueKind, because PLAN_ISSUE_KINDS is exactly ISSUE_KINDS_SHOWN.
   - wordIssue: the requirement name is still requirementGroupName ?? combinedMinimumName ?? null. missingCourseCodes still falls back to []: missing() in messages.ts does this now instead of the adapter. On the editor side, missingCourseCodes is always an array, so its text is unchanged.
   - toEngineIssue is gone. The ids are no longer filled with group names.
2. Contract: the diff of openapi.json, migrations and package-lock.json is empty.
3. Tests: the meter and capOf tests moved from present.spec.ts to issue-view.spec.ts with the same names and expect() calls. In api.spec.ts the NotSharedDto case still asserts the same runtime shape. view.spec.ts is new (194 lines). SharedPlanView.spec.ts, SharedPlan.browser.spec.ts, PlanEditorView.spec.ts and the IssuesPanel tests are untouched.
   - Ran: vue-tsc typecheck (0 errors), npm run lint (pass), vitest src/sharing and src/plans (13 files, 187 tests pass), and the browser spec for sharing (pass).
4. Completeness: rg finds no remaining reference to toEngineIssue, NotShared, UpdatePlanShareBody or PlanShareStatus, and no import of the moved names from present.js. present.ts re-exports nothing. There is one clause() now, not two.
5. Structure: SharedPlanView.vue's script is down to about 80 lines. The shared page imports only plans/issue-view (type imports only) and plans/messages (type imports only), so it no longer pulls in audit/, curriculum/api or transcript/ through plans/present.ts. Lint reports no new feature edge, and none went stale.
6. Repo rules: no comments added, no dependency change. All 4 commits are G-signed with Conventional subjects. There is one new file under .changeset/ (empty frontmatter, no version bump).
7. Scope: no off-limits file was touched. The doc edits are limited to class-model.md and UC-05.

## Blocking
None.

## Non-blocking
- src/frontend/src/sharing/view.spec.ts (wordIssue): no test pins that the group name wins over the combined-minimum name. If the ?? order were swapped, the tests would still pass. Fix: add a case where an issue has both requirementGroupName and combinedMinimumName, and expect the group name.
- src/frontend/src/plans/messages.ts:4 (WordedIssue): the shared page still goes through the IssueContext callback and ignores its argument. Also, WordedIssue makes missingCourseCodes optional for the editor too, which weakens the editor's type, though not its behaviour. This is acceptable as it stands. A follow-up could have the worders take a plain requirementName string.
- src/frontend/src/sharing/api.spec.ts:116: `satisfies Shape<{ statusCode; message; error }>` checks the shape against an inline type literal, so that compile-time check is now circular. The runtime contract assertion still holds, and the client has no real NotShared type. Fine as is; optionally drop the satisfies clause.
- docs/analysis-and-design/class-model.md:1419: the export list for issue-view.ts leaves out ISSUE_KINDS_SHOWN, BAR_CODES and METER_HEADROOM_CREDITS.
- The implementer's report.md was not at the stated path, so I could not check the omissions it lists.
