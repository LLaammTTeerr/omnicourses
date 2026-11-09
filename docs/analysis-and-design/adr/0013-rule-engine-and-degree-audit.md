# ADR 0013: Rule engine and degree audit

- Status: accepted
- Date: 2026-11-09
- Deciders: Lâm (Project Lead), through his delegate, 9 Nov 2026
- Reviewers: Triết (rule engine, academic results), Hoà (dashboard and audit screens), Dũng (advisor, test cases)

## Context

AGENTS.md hard rule 1 makes one deterministic rule engine the only place OmniCourse decides an academic rule. F3, the degree audit, is its first consumer; the planner (F5, ADR 0006) and the advisor's tools (F8, ADR 0003) follow. The authority for grades, averages, retakes and graduation is the HCMUS training regulation, Quy chế đào tạo trình độ đại học, issued with QĐ 1175/QĐ-KHTN of 24 September 2021 ([PDF](https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/03/Quy-che-dao-tao-2021.pdf)); this ADR cites it as "Điều n". The credit caps follow [ADR 0012](0012-credit-caps-by-training-type.md).

The curriculum schema of #23 ([ADR 0005](0005-curriculum-cohort-and-course-catalog.md)) stores groups, their kind and their totals. The seed files of the APCS and CLC curricula hold more rules than it can store: courses outside the cohort total, groups outside it, blocks printed as a minimum, an overflow between groups, graduation alternatives, subtotals, teaching plans and equivalence lists. The transcript ([ADR 0007](0007-transcript.md)) records every attempt with a result (`graded`, `in_progress`, `exempt`, `pass`, `fail`) and leaves its meaning to the engine.

## Decisions

### Module boundary

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **A `rules` module holds the engine.** Every rule is a pure function in `src/backend/src/rules/` with no I/O: `credit-caps.ts`, `grades.ts`, `attempts.ts`, `gpa.ts`, `coverage.ts`, `graduation.ts`, `prerequisites.ts`, and `audit.ts`, which composes them. `RulesService` loads the inputs (onboarding answers, the transcript, the curriculum rules) and calls them; it also exposes the pure functions to other modules. | Rules inside the audit controller or the curriculum service; a rules table interpreted at run time | Pure functions are tested with synthetic inputs and no database (`src/rules/*.spec.ts`, statement coverage of `src/rules` above 98 %, gate 80 % in `vitest.config.mts`). One module keeps hard rule 1 checkable: no other folder decides a rule. |
| **The F3 route lives in an `audit` module**, `GET /api/users/me/audit`, behind the global AuthGuard. Its DTOs implement the engine's result types (`rules/audit-types.ts`), so the contract and the engine cannot drift apart. | Routes in `rules` | One Nest module per feature (AGENTS.md). The planner and the advisor import `RulesModule` without a controller. |
| **The curriculum module reads the rule data for the engine** (`CurriculumRulesReader.rulesFor(program, cohort)`), returning plain data. The curriculum read DTOs gain only `trainingType`. | The engine querying curriculum tables itself; every rule field on the explorer DTOs | The curriculum module owns its tables. The explorer's shape stays as F4 and F12 define it. |
| **Without finished onboarding the audit answers 409 `onboarding_required`**; with a program and cohort that have no curriculum, 409 `curriculum_not_found`. The body is `{ statusCode, code, message }`, like `ai_unavailable`. | 404 | 404 reads as a missing route or a missing student. 409 says the request is valid but the account's state does not allow it yet, and the UI sends the student to onboarding (B1 test cases, USER-01k). |

### Data the audit needs (migration `1794300000000`)

For each seed-only rule, the question was whether a correct APCS result needs it. These do, and are now stored:

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **`programs.training_type`**: `advanced` (Tiên tiến), `joint` (Liên kết), `high_quality` (Chất lượng cao), `standard` (đại trà), nullable with a CHECK. The migration sets APCS to `advanced` and the CLC programs to `high_quality`; the seed writes it for new databases. Null means not recorded: no cap is checked, and nothing is guessed. | NOT NULL with a default; a type per curriculum | ADR 0012. A default would assign a training type to a program no one has classified. |
| **`requirement_group_courses.counts_toward_total` and `counts_toward_gpa`**, both default true. False for Thể dục 1, Thể dục 2 and Giáo dục quốc phòng - An ninh in APCS, and for the CLC groups 7.1.5 and 7.1.6. The migration sets them on links seeded before it, because the seed never updates a row. | One flag for both; a flag on the course | APCS 2024 p.6: "BAA00021, BAA00022, BAA00030 bắt buộc phải đạt nhưng không tính vào 163 tín chỉ … và không tính điểm vào điểm trung bình". The Non Computer Science group's 26 credits leave them out, so without the flag the audit counts 34. Two flags because Điều 15.1.c also leaves general foreign language and Tin học cơ sở out of the GPA, and a curriculum may count those toward its total. A flag on the link, because each curriculum states it. |
| **Combined minimums** (`combined_minimums`, `combined_minimum_groups`): several groups must reach a number of credits together. The seed loads every block printed as a minimum ("≥"); an exact block adds no rule, since its groups' own totals add up to it (checked by `curriculum-seeds.spec.ts`). | A minimum on group (C) alone; deriving 43 from the notes text | APCS p.5: "Kiến thức tự chọn ≥ 43" over (B) and (C), and (C) has no minimum of its own (`credits_total_min` null, "≈ 35"). Without it the audit cannot say whether (C) is done or the 163 is reachable. |
| **Overflow** (`requirement_group_overflows`, one target per group): credits passed in a group beyond its own minimum count toward another group of the same curriculum. APCS: (A) tự chọn → (C). | Leaving the overflow out as a conservative under-count | APCS p.5–6: "Sinh viên có thể dùng số tín chỉ dư thuộc (A) cho (C)". The official teaching plans (`apcs-202{4,5}.teaching-plan.ts`) place all six (A) tự chọn courses, 24 credits for a minimum of 16. A student who follows the plan has 8 credits that count for (C); without the overflow the audit would report them short on (B) + (C): a wrong result for the typical student, not a cautious one. |

Not stored, with the reason:

- **Graduation alternatives** (APCS: CS468, or CS469 and CS470). For APCS, the elective minimum of 10 gives the same answer as the alternatives in every case: CS468 (10), CS469 + CS470 (10), and CS469 alone (5) fails both. CLC's alternatives differ (three 4-credit courses reach 10 without CSC10204) and stay a gap.
- **Subtotals** (APCS (A) = 56): the two seeded halves' own totals (40 + 16) add up to it.
- **Teaching plans**: they place courses in semesters for the planner; the audit does not read them.
- **Equivalences**: the APCS list maps legacy codes (2023 and earlier) with open questions (dotted codes, a set in one cell). A course they would match is listed as unmatched, with a warning; it is never counted by guess.

### Grades, attempts and averages

| Decision | Evidence |
| --- | --- |
| **A course passes with a grade of 5.0 or more.** Grades are handled in integer tenths. D+ and D (4.0–4.9, 3.0–3.9) have a 4-point value but do not pass. | Điều 11.1 (one decimal), 11.4 |
| **An exempt result passes** and its credits are accumulated, **outside every average**. A `pass` result passes and a `fail` does not; neither has a grade to average. | Điều 13.2–13.3 (điểm M and BL "không tính vào điểm trung bình học kỳ và điểm trung bình tích lũy") |
| **The last completed attempt is the official one**, even when an improvement scores lower than the attempt before it. Attempts are ordered by term. | Điều 14.1.a, 14.2.a: "điểm lần học cuối là điểm chính thức của học phần" |
| **An attempt in progress after a completed one** leaves the course as that completed attempt says (a passed course stays passed while an improvement runs) and marks it in progress. *Judgment call*: the regulation makes the last grade official once it exists; until then the earlier one is the record. | Điều 14 |
| **Two completed attempts in the same term**: the transcript cannot say which was last, so the worse one counts and the audit warns (`same_term_attempts`). *Judgment call, the conservative reading.* | ADR 0007 keeps both rows |
| **Average (điểm trung bình)**: every course studied, by its official grade, credit-weighted. **Accumulated average (điểm trung bình tích lũy)**: passed courses only. Per term: every graded sitting of that term, and its passed sittings; plus the accumulated average from the start to the end of the term. Only courses of the curriculum count, without those it leaves out of the GPA. | Điều 15.1.a–c ("các học phần nằm trong yêu cầu của chương trình đào tạo"), 15.2.a; the audit prototype: "ĐTB học kỳ tính mọi lần học. ĐTB tích lũy chỉ tính lần đạt." |
| **Averages are exact**: Σ tenths × credits, divided once and rounded half up to two decimals. The 4-point average converts each course grade first, and is shown for reference only. Classification uses the cohort's table. Year of study uses the accumulated credits. | Điều 11.2 (4-point and letter "chỉ mang tính tham khảo"), 15.2.b, 15.3 |
| **When the transcript and the catalog give different credits** for a course, the audit counts the smaller number and warns (`credits_differ`). *Judgment call*: two sources that disagree never add credits. | — |

### Coverage and graduation

| Decision | Evidence |
| --- | --- |
| **A compulsory group is met when every course in it is passed**, the courses outside the total included. Its credits count only the courses inside the total. **An elective group is met when its passed credits plus overflow reach its minimum**; one without a minimum of its own is met, and its rule is a combined minimum. Remaining credits subtract in-progress credits, as the dashboard prototype does ("Còn lại"); `met` never counts them. | ADR 0005; Điều 3.1.b; dashboard prototype |
| **A course linked to several groups of one curriculum counts in exactly one**: a compulsory group first, then the group name in code-point order, then the id. Other groups show it as `counted_in_other_group`. No seeded curriculum links a course twice. *Judgment call, the conservative reading*: the regulation counts a course's credits once (Điều 15.2.a sums each course once); the order is chosen to be deterministic, not optimal, so a different placement might meet more groups, and the audit can under-report, never over-report. | `placements()` in `coverage.ts`; the duplicate check run over every seed |
| **Overflow is one hop, of passed credits only**: a group's passed credits beyond its own minimum count toward its target. In-progress credits never overflow, and overflow never makes the source group met. A chain or a target outside the curriculum is ignored. A combined minimum counts overflow between two of its own groups once, adds overflow from a group outside it, and leaves out overflow sent outside it. | APCS p.5 |
| **A transcript course no group links is listed as unmatched** and counts toward nothing: not credits, not the GPA. | Điều 15.1; ADR 0007 (matching is the engine's job) |
| **Graduation is `done` when every condition the data can check is met**: every group, every combined minimum, and the cohort total. The audit always lists, as not checked, what it cannot see: no prosecution or suspension (Điều 17.3.a), the GDQP-AN certificate (17.3.c; passing the courses is checked with their group), the foreign-language standard (17.3.d), the IT standard (17.3.e) and the maximum study time (Điều 2.7). None is ever assumed met. | Điều 17.3, 2.7 |
| **Prerequisites and offering terms are checked by pure functions that take the data as input**: a course's prerequisite codes, or null, and its offering term numbers, or null. Null gives `not_recorded`, distinct from `none`. The APCS PDFs print none (`teaching plan.prerequisites` is empty), so they are entered through F12 (ADR 0011 amendment) and none is seeded or invented. | Điều 3.1.c; ADR 0011 (prerequisite storage is F12's) |
| **Credit caps** follow ADR 0012: `termKind(trainingType, number)` makes term 3 a summer term only in a đại trà program; `checkTermLoad` reports a load outside the caps with Điều 7.2 and the petition route, never blocking. The audit reports each transcript term's load the same way. For đại trà, courses outside the cohort total (GDTC, GDQP-AN) are left out of the minimum; general foreign language is not identified yet. | Điều 6.4, 7.1.b, 7.2 |

### Plan issues (amended 9 November 2026)

`RulesService` implements the plans module's `PlanIssuesProvider` (ADR 0014); `checkPlan` in `rules/plan-issues.ts` composes the rules above. `GET /api/plans/{id}/issues` serves it to the plan's owner only.

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **Each issue has a kind: `violation`, `flag` or `unknown`.** Violations: a prerequisite not met, a course outside its offering terms, a course placed twice, a requirement left uncovered (GLOSSARY "Violation"). Flags: a load outside the caps, a course already passed, a course outside the curriculum. Unknown: prerequisites, offering terms, the training type or a course's credits not recorded. None blocks saving. | Two levels; leaving unrecorded data out of the report | Điều 7.2.b allows a load outside the caps by petition (ADR 0012), and Điều 14.2 allows retaking a passed course to improve the grade, so neither breaks a rule. ADR 0011: `null` is "not recorded", which must read as neither a pass nor a fail. |
| **The plan is checked against its own curriculum**, not the onboarding one. | Onboarding's program and cohort | ADR 0014: a plan keeps the curriculum it was made against. |
| **A prerequisite counts as passed before term T** when the transcript's last completed attempt before T passes, when an attempt before T is still in progress, or when the plan places it in a term before T. The same term does not count. *Judgment call*: a course in progress is assumed to pass, as every placed course is. | Only passed transcript attempts | Điều 3.1.c ("phải học và thi đạt mới được đăng ký"); without it, every plan made during a term reports the next term's courses as blocked. |
| **Offering terms are checked by term number** (ADR 0011), cited as Điều 6.5 (the term plan says which courses open) and 7.1.a (students register for those). | No citation | The regulation names no offering rule per course; these clauses are where a course's opening is decided. |
| **A course already passed before the placement's term is a flag**, cited as Điều 14.2. A placement in the same term as a passing attempt is not: the plan is showing that term as it was. A failed course placed again is a retake and gets nothing. | A violation | Điều 14.2.a. |
| **Coverage is the degree audit run on a projected transcript**: every placed course and every course in progress passed in its term. A slot is an unnamed course of its group with the slot's credits, so it counts, and overflows, as the course chosen for it would. *Judgment call*: a compulsory group with a slot still needs every one of its listed courses. | A separate coverage computation for plans; slots counted outside the groups | One coverage rule for the audit and the planner. A slot is credits held for a course of that group (ADR 0014). |
| **A course placed twice is still reported**, though the database refuses to store it. | Not checking it | The plan generator validates a draft before saving it (ADR 0006). |

## Consequences

- The planner (F5) and the advisor (F8) call `RulesService`; they never compute a credit, a GPA or a cap themselves.
- TC-B1-ACAD-01 in the test plan now states the APCS caps of ADR 0012 (10–22 in every term, term 3 a main term), which the engine follows; it stated 14–25 and 12 before.
- **Open data gaps**, each reported, never guessed:
  - Equivalences (APCS and CLC lists) are not loaded; legacy codes show as unmatched.
  - CLC: the graduation alternatives, the overflow from 7.2.2.x.1 into 7.2.2.x.2, and the free electives drawn from other specialisations are not stored, so a CLC audit can under-report. CLC is not offered in onboarding (B1 §6 item 1).
  - Prerequisites and offering terms are entered through F12 (ADR 0011 amendment); none is seeded, so a plan reports them as unknown until they are.
  - Which courses are general foreign language (the đại trà minimum) and which are Tin học cơ sở (the GPA) is not recorded; no seeded curriculum has one.
  - The estimated graduation term is a planner output (GLOSSARY), not the audit's.
