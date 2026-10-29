# ADR 0007: Storing the transcript

- Status: proposed
- Date: 2026-10-28
- Deciders: Lâm (owner of F2 and `transcript`)
- Reviewer: Triết (the degree audit reads it), Dũng (the advisor reads it)

## Context

F2 (Vision §5) brings the student's transcript into OmniCourse. The degree audit (Triết) and the advisor (Dũng) read it; the SDP v2 handoff for that is "student record, 22 Nov". UC-02 fixes the behaviour:
- the student reviews every row, then saves the whole set (step 7);
- a later save replaces the earlier one (A5);
- a course in progress has no grade (A3), and neither does an exempted or pass/fail course;
- an incomplete row can't be saved (A2);
- a retaken course keeps every row (A6).

The curriculum schema (#23) is still changing, and no table stores a term yet.

## Decisions

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **One table, `transcript_rows`: one row per course taken in a term.** Each row has course code, course name, credits, grade and term, plus `user_id … ON DELETE CASCADE`. | A `transcripts` parent table with rows under it | Nothing yet needs anything stored about a transcript as a whole. The cascade puts the rows in ADR 0004's export and purge with no extra code; `transcript.e2e-spec.ts` checks both. |
| **Saving replaces the whole set in one transaction** (`PUT /api/users/me/transcript`), after locking the user's row with `FOR NO KEY UPDATE` so two saves at once run one after the other. There are no per-row endpoints. | Create, update and delete per row; no lock; `FOR UPDATE` | UC-02 saves a reviewed set (step 7) and re-import replaces it (A5). Manual entry (A4) edits the same review table. Without the lock, two concurrent saves under READ COMMITTED merge into one set. The e2e test "waits for a save in progress" fails without the lock and passes with it. `FOR NO KEY UPDATE` conflicts with itself but not with the `FOR KEY SHARE` lock every foreign-key check takes, so a sign-in inserting a session for the same user doesn't wait; `FOR UPDATE` would block it ([PostgreSQL 18, Row-Level Locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)). |
| **The row stores what the transcript says**: its own course name and credits, and no foreign key to the curriculum's courses. | Reference `courses(code)` and take credits from there | UC-02 step 5 keeps courses outside the student's curriculum. #23's course table is about to change shape. Matching rows to the curriculum is the degree audit's job (AGENTS.md hard rule 1). |
| **Every row states its result: `graded`, `in_progress`, `exempt`, `pass` or `fail`, and it must be sent.** A row without one is refused (400). `grade` is `numeric(3,1)` from 0 to 10, required when the result is `graded` and null (or left out) otherwise. The DTO and a CHECK (`("result" = 'graded') = ("grade" IS NOT NULL)`) both enforce it. `result` is a `varchar` with a CHECK, not a PostgreSQL enum type. | `null` grade meaning in progress, with no result column; letter grades; a PostgreSQL enum type | Thông tư 08/2021/TT-BGDĐT grades a course on a 10-point scale rounded to one decimal, but an exemption ("miễn") or a pass/fail course has no such grade. Without a result, an exempt course could only be refused or saved as `grade: null`, which every reader takes for "in progress" (UC-02 A3), so the audit would count it as not done. Adding the column later would change what `null` means under the degree audit and the advisor. A required result keeps "incomplete, can't be saved" (A2) apart from every real outcome. A CHECK list is changed by one migration that drops and adds it; an enum value can't be removed without re-creating the type ([PostgreSQL 18, §8.7 Enumerated Types](https://www.postgresql.org/docs/18/datatype-enum.html)), and a value added in a transaction can't be used until it commits ([ALTER TYPE](https://www.postgresql.org/docs/18/sql-altertype.html)). `transcript.dto.spec.ts` covers each result and each mismatch; `transcript.e2e-spec.ts` covers the CHECK. |
| **The transcript records results; it never decides what they are worth.** Which results pass, count toward a requirement or count toward graduation (a `pass`, an `exempt`, a grade of 4.5) is the rule engine's call (AGENTS.md hard rule 1). Nothing in `transcript` encodes it. | Store a `counts` or `passed` flag | That would be an academic rule outside the engine. |
| **Every row is kept, even the same course twice in one term.** | Refuse a course listed twice in one term | UC-02 A6 and §7: "the import records what the transcript says and nothing more". Which attempt counts is the engine's call. |
| **Bounds on input, not rules**: at most 300 rows, credits 0–30, term years 2000–2100, course codes of 2–20 letters or digits (stored in upper case). | No bounds | They stop malformed or oversized requests. They are far outside any real transcript (APCS is about 140 credits), so they never decide an academic question. |
| **A term is two numbers, `year` and `number`, in every module.** `year` is the first calendar year of the academic year (2026 = 2026–2027). `number` is 1 or 2 for main terms and 3 for summer. In SQL: `term_year smallint`, `term_number smallint CHECK (term_number IN (1, 2, 3))`. In JSON: `{ "year": 2026, "number": 1 }`. Proposed for plans (Hoà), offering terms (#23) and the planner (ADR 0006). | A string such as `"2026-1"`; a term index counted from the cohort's start; start and end dates | GLOSSARY: a term is "a main term or a summer term", and Vision §4 (Assumptions) sets different credit caps for each, so the kind of term must be readable. Two small integers sort correctly and can't be mistyped. A cohort-relative index breaks when a student changes cohort. |
| **`TranscriptService.rowsFor(userId)` is the read contract.** It returns `TranscriptEntry[]`, a plain interface in `transcript-entry.ts` (course code, name, credits, result, grade, term), oldest term first. It is exported from `TranscriptModule`. | Other modules query the table, receive the entity, or receive the HTTP DTO class | Triết and Dũng depend on one function and a plain type, so the table can change behind it (SDP v2 handoff list). `transcript.e2e-spec.ts` covers it. |

## Consequences

- An uploaded PDF is never stored. The F2 parser (a later PR) turns it into rows for the review table, and only the saved rows land here.
- Other modules adopt the term encoding, or change it here before they ship.
- Open:
  - Confirm, on a real portal transcript read locally, that the portal numbers the summer term 3 and how it writes an exemption and a pass/fail result, so the F2 parser maps them to `exempt`, `pass` and `fail`.
