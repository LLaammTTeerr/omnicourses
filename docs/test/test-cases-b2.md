# B2 test cases

- Owner: Dũng
- Build: B2, 29 November 2026. Test window 16–29 November ([test plan §8](test-plan.md#8-schedule-and-remaining-work)).
- Version: 0.1, 21 November 2026, scaffold, no case written yet.
- Parent checks: test plan §5, rows `TC-B2-PLAN-01`, `TC-B2-PLAN-02`, `TC-B2-TRN-01`, `TC-B2-TRN-02` and `TC-B2-ADM-01` to `TC-B2-ADM-07`, `TC-B2-SHARE-01` and `TC-B2-NOTIF-01` of [B2 checks](test-plan.md#b2-checks), and `TC-B2-PERF-01`, `TC-B2-A11Y-01` and `TC-B2-OPS-01` of [Coverage and speed](test-plan.md#coverage-and-speed). Each detailed case has its parent's ID plus a letter, such as `TC-B2-PLAN-01a`.

This file is a scaffold. Each section below gives one parent check from the test plan, its owners and what must be built before it can run. Dũng writes the detailed cases in each table. Do not add steps or expected results that the test plan, the use cases or the feature owner do not state. Where the expected result is not agreed yet, the case is **blocked** and names what it waits for.

## 1. Before you start

**Where to test.** On staging, as for B1 ([B1 cases §1](test-cases-b1.md#1-before-you-start)). The local setup, the network profile and the rules for database cases are the same as in B1 unless a case says otherwise.

**Test accounts.** Synthetic accounts only: made-up `example.com` addresses with synthetic data, never a real student, transcript, student ID or name (AGENTS.md, hard rule 3). Use the prefix `b2-`, for example `b2-s1@example.com`. List each account and its use here when the first case needs it.

**Evidence.** Store screenshots, logs and measurements in `docs/test/evidence/b2/`. The folder is created with the first evidence file. Name each file after its case ID, for example `PLAN-01a.png`. The run's results go in a results file in the same folder, as in B1.

**Result fields.** In each table, **Result** is one of: pass, fail (with the defect issue number), blocked (with the reason), or not run: feature not merged ([test plan §7](test-plan.md#7-when-a-build-is-ready)). **Evidence** is the path of the file in `evidence/b2/`.

**Build status on 21 November 2026.** The "Depends on" line of each section uses this status:

- Done: calendar API (#108) and calendar page (#99); transcript storage.
- In progress: planner drag-and-drop and live validation; curriculum administration API (part done).
- Not started: transcript paste/type entry screen; curriculum administration screens and CSV import; notifications inbox; plan sharing and PDF export; nightly backup.

## 2. TC-B2-PLAN-01: Editing and live validation

The student adds, removes and moves courses by drag-and-drop and by keyboard, and the rule engine validates each edit. Prerequisite, offering-term, credit-cap and coverage violations show correctly, a late response never replaces the current result, and several plans save, reload and compare without mixing their state ([test plan row](test-plan.md#b2-checks)).

- Owners: Hoà, Triết
- Depends on: planner drag-and-drop and live validation (in progress).

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TC-B2-PLAN-01a | TODO | TODO | | |

## 3. TC-B2-PLAN-02: Failure and ownership

An expired sign-in, denied access, an API failure or a lost save response keeps a clear saved or unsaved state, and the app reads the plan again after an unknown outcome. Crafted plan or course IDs cannot reach another student's plan, and unrelated plans and transcript rows stay unchanged ([test plan row](test-plan.md#b2-checks)).

- Owner: Hoà
- Depends on: planner drag-and-drop and live validation (in progress).

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TC-B2-PLAN-02a | TODO | TODO | | |

## 4. TC-B2-TRN-01: Import and manual review

The student enters transcript rows, then reviews, corrects, adds or removes rows before saving. Incomplete rows block the save, and cancel keeps the earlier record ([test plan row](test-plan.md#b2-checks)).

> **Note: the plan row describes PDF import, which is dropped.** On 15 November 2026 the Project Lead decided that F2 is "paste the grades table, or type it in". PDF upload is dropped because the school portals give no transcript PDF. Write the cases in this section for paste and type entry, not for PDF upload. The test plan row (and its 5 MB upload limit) needs an update to match.

- Owner: Lâm
- Depends on: transcript storage (done); transcript paste/type entry screen (not started).

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TC-B2-TRN-01a | TODO | TODO | | |

## 5. TC-B2-TRN-02: Student-record integration

Saving a transcript replaces the old one in one step, concurrent saves run one after the other, retakes stay separate, and unknown catalog courses stay in the transcript. The audit and planner recompute from the saved rows, export and deletion cover all rows, and the import never decides which attempt passes or counts ([test plan row](test-plan.md#b2-checks)).

- Owners: Lâm, Triết
- Depends on: transcript storage (done); transcript paste/type entry screen (not started) for the screen cases.

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TC-B2-TRN-02a | TODO | TODO | | |

## 6. Curriculum administration (TC-B2-ADM-01 to ADM-07)

For ADM-01 to ADM-07, [UC-11's Examples to test](../requirements/use-cases/UC-11-maintain-curriculum.md#examples-to-test) is the reference for expected behaviour ([test plan, B2 checks](test-plan.md#b2-checks)).

### TC-B2-ADM-01: Global catalog permission

A catalog maintainer with no program grant edits a shared course after reviewing every affected curriculum, and both programs read the correction. A program-only administrator cannot make that write, and cohort-specific values are refused ([test plan row](test-plan.md#b2-checks)).

- Owner: Thắng
- Depends on: curriculum administration API (part done); administration screens (not started).

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TC-B2-ADM-01a | TODO | TODO | | |

### TC-B2-ADM-02: Program and access boundaries

Program A's administrator edits only program A, also through nested IDs. Only an access manager creates programs or changes grants, and that role gives no editing grant; signed-out, ungranted and revoked users cannot write ([test plan row](test-plan.md#b2-checks)).

- Owner: Thắng
- Depends on: curriculum administration API (part done); administration screens (not started).

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TC-B2-ADM-02a | TODO | TODO | | |

### TC-B2-ADM-03: Cohorts and membership

Adding a second cohort, with its groups and links to existing catalog courses, leaves the first cohort's membership, saved plans and audit results unchanged and creates no duplicate courses. Duplicate program or cohort identifiers and invalid links are refused ([test plan row](test-plan.md#b2-checks)).

- Owners: Thắng, Triết
- Depends on: curriculum administration API (part done); administration screens (not started).

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TC-B2-ADM-03a | TODO | TODO | | |

### TC-B2-ADM-04: Removal

Removing one group link keeps the course and its other links. Deleting a course or other data that saved records still need is refused, deleting an unreferenced course needs catalog permission, and changing a linked course code is not an ordinary edit ([test plan row](test-plan.md#b2-checks)).

- Owners: Thắng, Triết
- Depends on: curriculum administration API (part done); administration screens (not started).

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TC-B2-ADM-04a | TODO | TODO | | |

### TC-B2-ADM-05: Validation, atomicity and impact

Codes are normalized and checked, and invalid values change nothing. Cancel discards the edit, a failed save leaves no partial change, an unknown response leads to a re-read, and transcript rows and saved course placements are never rewritten ([test plan row](test-plan.md#b2-checks)).

- Owner: Thắng
- Depends on: curriculum administration API (part done); administration screens (not started).

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TC-B2-ADM-05a | TODO | TODO | | |

### TC-B2-ADM-06: Grant lifecycle

The first access manager is set up in a controlled way, sign-up gives no privilege, and every write checks the current grant. Grant rows reference users as AGENTS.md requires, and account export and deletion cover them without deleting shared program or catalog data ([test plan row](test-plan.md#b2-checks)).

- Owners: Thắng, Lâm
- Depends on: curriculum administration API (part done), with grant storage and bootstrap as ADR 0011 defines them.

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TC-B2-ADM-06a | TODO | TODO | | |

### TC-B2-ADM-07: CSV bulk import

A synthetic CSV of courses or group links is parsed deterministically and shown as a preview with errors by row number. A file with any bad row saves nothing, a valid file saves in one transaction after confirmation with the same permission checks as manual entry, and importing it again creates no duplicates ([test plan row](test-plan.md#b2-checks)).

- Owner: Thắng
- Depends on: curriculum administration API (part done); CSV import and administration screens (not started).

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TC-B2-ADM-07a | TODO | TODO | | |

## 7. TC-B2-SHARE-01: Export and sharing

A signed-out reader of a shared plan sees only the allowed read-only data, with rule-engine violations shown in the view and the PDF. Revoked, old, dead and unknown links stay closed, the page is `noindex`, and every new public route joins the allow-list in `src/backend/test/public-routes.e2e-spec.ts` ([test plan row](test-plan.md#b2-checks)).

- Owners: Dũng, Hoà
- Depends on: plan sharing and PDF export (not started).

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TC-B2-SHARE-01a | TODO | TODO | | |

## 8. TC-B2-NOTIF-01: Notifications

Registration-window reminders, the term-start check-in and the warning after a saved transcript change reach the right student from the right event, and never come from a cancelled or failed save. Exact delivery, timing and repeat checks wait for the F10 contract ([test plan row](test-plan.md#b2-checks)).

- Owner: Dũng
- Depends on: calendar API (#108) and calendar page (#99) (done); notifications inbox (not started).

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TC-B2-NOTIF-01a | TODO | TODO | | |

## 9. TC-B2-PERF-01: Planner validation time

A planner edit shows its validation result in under 300 ms, measured in the browser from the edit to the rendered result. API time is measured separately for diagnosis only ([test plan row](test-plan.md#coverage-and-speed)).

- Owners: Thắng, Hoà, Triết
- Depends on: planner drag-and-drop and live validation (in progress).

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TC-B2-PERF-01a | TODO | TODO | | |

## 10. TC-B2-A11Y-01: Usability of the B2 screens

The B1 usability checks extend to the planner, transcript review, administration, sharing and notifications. This includes a keyboard alternative to dragging, labels, focus and error messages, words as well as colour, and a readable PDF ([test plan row](test-plan.md#coverage-and-speed)).

- Owners: Dũng and the feature owners
- Depends on: each screen it checks (see the sections above).

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TC-B2-A11Y-01a | TODO | TODO | | |

## 11. TC-B2-OPS-01: Nightly backups

Backups run every night, and the job results and retention notice are kept. Restoration and the availability measure are B3 ([test plan row](test-plan.md#coverage-and-speed)).

- Owner: Lâm (hosting decisions)
- Depends on: nightly backup (not started).

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TC-B2-OPS-01a | TODO | TODO | | |

## 12. B1 regression on B2

Run the [B1 cases](test-cases-b1.md) again on the B2 candidate. Before the run, update the cases that no longer match the screens as built: they are listed in issue [#116](https://github.com/LLaammTTeerr/omnicourses/issues/116).

| ID | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| TODO | TODO | TODO | | |

## 13. Retests of B1 defects

Retest each B1 defect on the B2 candidate once its fix is merged. Write the retest steps from the case that found it.

| Issue | Title | Result | Evidence |
| --- | --- | --- | --- |
| [#101](https://github.com/LLaammTTeerr/omnicourses/issues/101) | Planner Taken strip shows credits and courses from terms it does not list | | |
| [#114](https://github.com/LLaammTTeerr/omnicourses/issues/114) | No guide is published in B1: G01, G02, G06 and G07 are still drafts | | |
| [#115](https://github.com/LLaammTTeerr/omnicourses/issues/115) | Unfinished onboarding never reaches the dashboard notice, and there is no "My program isn't listed" choice (USER-01k) | | |
| [#117](https://github.com/LLaammTTeerr/omnicourses/issues/117) | The 120-a-minute rate limit lets 121 requests through (PLAN-01m) | | |
| [#119](https://github.com/LLaammTTeerr/omnicourses/issues/119) | B1 accessibility run: focus lost after actions, skip link, What-if label and contrast (A11Y-01b, d, e, f) | | |
