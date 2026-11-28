# Review, round 1: 04-rules-one-derivation

Branch cvb/04-rules-one-derivation, base bfe79b3a, commits 0f65f17, 33de52f, 0002498.

## Verdict: approve (no blocking findings)

## What I checked
1. Behaviour, line by line:
   - courseStatus vs coverage.ts statusOf and standing.ts statusOf: same branch order (passed, in_progress, else). Coverage's `record.official ? 'failed' : 'not_taken'` arm is unreachable: every CourseRecord comes from resolve() with a non-empty attempts list (courseRecords groups non-empty lists; recordWithin returns null on empty). official === null means no completed attempt, so every attempt is in_progress, so inProgress is true and the in_progress arm returns first. No other code builds a CourseRecord literal (grep).
   - recordBefore vs standingBefore: same filter (< 0), same resolve, same null on empty; the undefined-record case moved to recordBeforeTile in plan-issues.ts with the same result. recordAsOf is unchanged in result (<= 0 filter, resolve, null on empty).
   - passedOnly vs standing.ts inline loop: identical. passedOrAssumedBefore vs passedBefore: verbatim except standingBefore -> recordBefore (same for a defined record). Set insertion order unchanged.
   - Differential fuzz: old tree (base) and new tree (HEAD) side by side, 20,000 random transcripts/rules/boards each for degreeAudit (with and without asOf), curriculumStanding and checkPlan, JSON-compared: all agree. The harness is sensitive: mutating recordBefore to <=, courseStatus's in_progress arm, or dropping in-progress from the planner set each makes it fail.
2. Contract: no diff in openapi.json, migrations, package.json or package-lock.json. No route, DTO, status or error code touched.
3. Tests: spec diffs only add (two import lines rewritten to import more). New tests: attempts.spec (recordBefore, courseStatus), prerequisites.spec (passedOnly, passedOrAssumedBefore). Rules unit run: 141 passed; full backend unit run passes, src/rules statements 98.67 %. Purity spec (rules.service.spec.ts) passes.
4. Completeness: statusOf (backend rules), standingBefore, passedBefore: no references left in src, scripts, deploy, .github, docs/analysis-and-design, AGENTS.md, README.md (only the unrelated frontend statusOf and an audit.spec local helper). class-model.md function table updated.
5. Structure: no new folder edge or cycle (depgraph vs base: only the rules -> terms edge weight changes, because prerequisites.ts now imports compareTerms as a value). New file edges prerequisites -> attempts, attempts -> types (type only). No new cycles.
6. Repo rules: no comments, .js suffixes, no dependency, all three commits signed (G) with Conventional subjects, exactly one new (empty) changeset, matching batches 01-03. Lint and backend typecheck pass.
7. Scope: only rules/{attempts,coverage,standing,plan-issues,prerequisites}.ts, two specs, class-model.md, the changeset. No off-limits file touched.
8. Truth tables (old = new in every row):
   - courseStatus (coverage / standing): no record -> not_taken / null; in progress only -> in_progress; failed then in progress -> in_progress; passed -> passed; passed then retaken in progress -> passed; passed then failed retake -> failed; failed only -> failed.
   - recordBefore(term) vs standingBefore, attempts at 2024/1 fail, 2024/2 pass, 2025/1 in progress: term 2024/1 (equal to first) -> null both; 2024/2 -> failed record both; 2025/1 -> passed, not in progress both; 2025/2 (after all) -> passed and in progress both; no record -> null both.
   - Explorer set: only passed records (in progress, failed then in progress, failed excluded) both. Planner set: passed or in progress strictly before T, plus planned-earlier courses not completed in [placedIn, T), both.

## Blocking
None.

## Non-blocking
- The implementer report (report.md) does not exist in the batch folder, so I could not check its stated omissions against these findings.
- src/backend/src/rules/prerequisites.spec.ts (new describe): two mutations of passedOrAssumedBefore survive every spec, old and new: (a) `compareTerms(a.term, term) < 0` -> `<= 0` in the "recorded" check, (b) dropping `isCompleted(a) &&`. Both change checkPlan results (the fuzz catches them). Example for (a): ZZ1 planned in 2024/1, transcript passes ZZ1 in 2024/2, check term 2024/2: today ZZ1 counts (assumed from the plan); with <= it would not. Fix: add those two rows to the planner test (a completed attempt in term T itself does not cancel the assumption; an in-progress attempt in [placedIn, T) does not cancel it either).
- Step A of the brief (characterization tests first, own commit, run on unchanged code) was not done as a separate commit. Base specs did not pin courseStatus's order for a passed course with a later in-progress retake (swapping the two arms passed every base spec); the new attempts.spec row pins it now, and the fuzz shows the behaviour is unchanged, so the outcome is fine, but the process step was skipped.
- src/backend/src/rules/coverage.ts:44: `const own: CourseStatus` widens the old `Exclude<CourseStatus, 'counted_in_other_group'>`. No runtime effect; `TranscriptCourseStatus | 'not_taken'` keeps the type as tight as before.
- src/backend/src/rules/plan-issues.ts:120 recordBeforeTile is a one-caller wrapper; inlining `record ? recordBefore(record, tile.term) : null` at the call site would be equally clear. Optional.
