# UC-02: Import transcript

- Feature: F2 Transcript import (Vision §5, as changed by [ADR 0003](../../analysis-and-design/adr/0003-language-model-scope.md))
- Owner: Lâm
- Status: draft for the use-case model (PA2)
- Change from Vision v1.0: no language model and no image upload. The portal PDF is read by a deterministic parser, and manual entry is always available. Vision v2 (Hoà) restates F2 to match.

## 1. Brief description

A student brings their transcript into OmniCourse, either by uploading the transcript PDF exported from the HCMUS portal or by typing the rows in. The student reviews every row before it counts. The saved transcript is what the degree audit (UC-03) and the planner read.

## 2. Actors

- **Student** (primary).

No other system takes part. The file is read on the OmniCourse server and is not sent to any third party.

## 3. Preconditions

- The student is signed in and has finished onboarding (UC-01), so their curriculum is known.

## 4. Basic flow

1. The student opens **Transcript** and chooses **Import from portal PDF**.
2. The system says which file to download from the portal and how. It also explains that the file is read on the OmniCourse server, is never sent to an AI or any other service, and is deleted as soon as it has been read.
3. The student uploads the PDF.
4. The system reads the file and finds one transcript row per course taken. Each row has the course code, course name, credits, grade and term.
5. The system shows a review table with every row it found. Rows whose course code is not in the student's curriculum are marked **Not in your curriculum**; they are kept, because the student may have taken them as extra courses.
6. The student checks the rows. They can correct a row, remove one or add one (A4).
7. The student presses **Save transcript**.
8. The system saves the rows as the student's transcript and deletes the uploaded file.
9. The system opens the degree audit (UC-03), recomputed from the new transcript.

## 5. Alternative flows

**A1. The file cannot be read.** At step 4 the file is not a portal transcript, has no text layer (a scan or photo saved as PDF), or its layout is not one the parser knows. The system says it could not read the file and why, and offers manual entry (A4). Nothing is stored, and the file is deleted.

**A2. A row is incomplete.** At step 4 a row is found but one of its fields cannot be read. The system shows the row with the missing field marked. At step 7 the system refuses to save until each such row is completed or removed.

**A3. Course in progress.** At step 4 a row of the current term has no grade yet. The system marks it **In progress** and keeps it. How the degree audit and the planner treat such a row belongs to UC-03 and UC-07.

**A4. Manual entry.**
1. At step 1, or from A1, the student chooses **Enter manually**. At step 6 the student chooses **Add a row**.
2. The system offers the courses of the student's curriculum to pick from, and accepts a course code that is not in it.
3. The student enters the grade and the term; credits come from the curriculum when the course is in it.
4. The flow resumes at step 6.

**A5. Re-import over an existing transcript.** At step 5 the student already has a saved transcript. The system shows what would change compared with the saved one: rows added, rows changed and rows removed. At step 8 the new rows replace the old ones. F10 notifications (Dũng) may then warn the student that the transcript changed; F10 has no use case of its own.

**A6. The same course appears twice.** At step 4 a course was taken more than once, for example failed and then retaken. The system keeps both rows. Which attempt counts is decided by the rule engine, not by the import.

**A7. File too large or not a PDF.** At step 3 the file is not a PDF or is larger than 5 MB. The system refuses it and says what it accepts. The flow resumes at step 3.

**A8. Only a screenshot.** At step 2 the student has only a screenshot or photo. Images are not read (ADR 0003). The system offers manual entry (A4).

**A9. Cancel.** At any step before 7, the student leaves the review. Nothing is stored and the uploaded file is deleted. A transcript saved earlier is unchanged.

## 6. Postconditions

- **Success:** the student's transcript is the reviewed set of rows, and the uploaded file no longer exists.
- **Failure or cancel:** the earlier transcript, if any, is unchanged, and no uploaded file remains.

## 7. Special requirements

- **Academic rules** (AGENTS.md hard rule 1): the import records what the transcript says and nothing more. Whether a grade passes, which attempt counts and how a course fills a requirement group are decided by the rule engine.
- **Privacy** (Vision §6; AGENTS.md hard rule 3): the file is processed in memory or a temporary file, deleted after reading, never logged, and never sent to a model or third party. Parser tests use synthetic transcripts only; a real transcript is opened only locally by its owner and never committed.
- **Determinism:** the same file always gives the same rows. The parser is unit-tested on synthetic portal-layout fixtures.
- **Usability:** the review table works from 360 px wide and by keyboard. Each problem (not in curriculum, incomplete, in progress) is marked in words as well as by colour.

## 8. Additional information

- **Proposed here, to confirm** (no earlier source):
  - The uploaded file is deleted as soon as it has been read, and is never kept (steps 2 and 8). This is the retention period the privacy NFR asks to state.
  - Uploads are limited to 5 MB (A7). A portal transcript is a few hundred kilobytes.
- Open (ADR 0003): before Sprint 4, confirm on one real portal transcript, locally, that the PDF has a text layer and a fixed layout. If it does not, F2 ships as manual entry only, and A1 is the outcome for every upload.
- The saved transcript is the student record that Triết's audit and Dũng's advisor read (Work Breakdown handoff, due 22 Nov). Its table and API contract are designed in a separate PR.
