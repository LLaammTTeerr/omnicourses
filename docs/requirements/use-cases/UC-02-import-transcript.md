# UC-02: Import transcript

- Feature: F2 Transcript import (Vision §5, as changed by [ADR 0003](../../analysis-and-design/adr/0003-language-model-scope.md) and by the [amendment of 15 November 2026 to ADR 0007](../../analysis-and-design/adr/0007-transcript.md#amendment-15-november-2026-paste-or-type-no-file))
- Owner: Lâm
- Status: draft for the use-case model (PA2); rewritten on 26 November 2026 for the decision of 15 November 2026. What is built: the [README feature table](../../../README.md#what-is-built).
- Change from Vision v1.0: no language model, no file and no image. The student pastes the grades table or types the rows in. A deterministic parser reads the paste. Vision v2 (Hoà) restates F2 to match.
- Not decided: the paste format (which columns the pasted table has, and how the portal's results map to the row results). The Project Lead decides it. This use case does not assume one.

## 1. Brief description

A student brings their transcript into OmniCourse, either by pasting the grades table that the HCMUS portal shows or by typing the rows in. The student reviews every row before it counts. The saved transcript is what the degree audit (UC-03) and the planner read.

## 2. Actors

- **Student** (primary).

No other system takes part. The pasted text is read on the OmniCourse server or in the browser, and is not sent to any third party.

## 3. Preconditions

- The student is signed in and has finished onboarding (UC-01), so their curriculum is known.

## 4. Basic flow

1. The student opens **Transcript** and chooses **Paste from the portal**.
2. The system says where the grades table is on the portal (the guide [G07](../guides-plan.md#g07-view-your-grades-b1)) and how to copy it. It also explains that the text is never sent to an AI or any other service.
3. The student pastes the copied table.
4. The system reads the pasted text and finds one transcript row per course taken. Each row has the course code, course name, credits, result, grade and term.
5. The system shows a review table with every row it found. Rows whose course code is not in the student's curriculum are marked **Not in your curriculum**; they are kept, because the student may have taken them as extra courses.
6. The student checks the rows. They can correct a row, remove one or add one (A4).
7. The student presses **Save transcript**.
8. The system saves the rows as the student's transcript. The pasted text is not kept.
9. The system opens the degree audit (UC-03), recomputed from the new transcript.

## 5. Alternative flows

**A1. The paste cannot be read.** At step 4 the text is not a grades table the parser knows. The system says it could not read the paste and why, and offers manual entry (A4). Nothing is stored.

**A2. A row is incomplete.** At step 4 a row is found but one of its fields cannot be read. The system shows the row with the missing field marked. At step 7 the system refuses to save until each such row is completed or removed.

**A3. Course in progress.** At step 4 a row of the current term has no grade yet. The system marks it **In progress** and keeps it. How the degree audit and the planner treat such a row belongs to UC-03 and UC-07.

**A4. Manual entry.**
1. At step 1, or from A1, the student chooses **Enter manually**. At step 6 the student chooses **Add a row**.
2. The system offers the courses of the student's curriculum to pick from, and accepts a course code that is not in it.
3. The student enters the result, the grade and the term; credits come from the curriculum when the course is in it.
4. The flow resumes at step 6.

**A5. Paste over an existing transcript.** At step 5 the student already has a saved transcript. The system shows what would change compared with the saved one: rows added, rows changed and rows removed. At step 8 the new rows replace the old ones. F10 notifications may then tell the student that the transcript changed.

**A6. The same course appears twice.** At step 4 a course was taken more than once, for example failed and then retaken. The system keeps both rows. Which attempt counts is decided by the rule engine, not by the import.

**A7. Removed.** It refused a file that was too large or not a PDF. No file is read since 15 November 2026.

**A8. Only a file, a screenshot or a photo.** At step 3 the student has a file or an image instead of text. OmniCourse reads no file and no image (ADR 0003, ADR 0007). The system offers manual entry (A4).

**A9. Cancel.** At any step before 7, the student leaves the review. Nothing is stored. A transcript saved earlier is unchanged.

## 6. Postconditions

- **Success:** the student's transcript is the reviewed set of rows.
- **Failure or cancel:** the earlier transcript, if any, is unchanged.

## 7. Special requirements

- **Academic rules** (AGENTS.md hard rule 1): the import records what the transcript says and nothing more. Whether a grade passes, which attempt counts and how a course fills a requirement group are decided by the rule engine.
- **Privacy** (Vision §6; AGENTS.md hard rule 3): the pasted text is never logged, never stored and never sent to a model or third party. Parser tests use synthetic tables only; a real transcript is opened only locally by its owner and never committed.
- **Determinism:** the same paste always gives the same rows. The parser is unit-tested on synthetic tables.
- **Usability:** the review table works from 360 px wide and by keyboard. Each problem (not in curriculum, incomplete, in progress) is marked in words as well as by colour.

## 8. Additional information

- The saved transcript is the student record that the degree audit and the advisor chat read. Its storage is [ADR 0007](../../analysis-and-design/adr/0007-transcript.md): `GET` and `PUT /api/users/me/transcript`, where a save replaces the whole set (step 8, A5), and every row states its result (`graded`, `in_progress`, `exempt`, `pass` or `fail`).
- Where the built screen differs from this use case: [design differences, UC-02](../../analysis-and-design/design-differences.md#uc-02-import-transcript-f2).
- Earlier versions of this use case read a PDF exported from the portal. The portals offer no such file (guides plan, G07, 15 November 2026), so that flow was dropped.
