# ADR 0005: Curriculum cohorting and course catalog

## Status
Proposed

## Context
The glossary defines Curriculum as the courses and requirement groups a cohort of a program must satisfy to graduate. ADR 0001 notes curriculum data is versioned per cohort. The initial schema treated `curriculums.code` as globally unique and attached courses directly to requirement groups (owned by courses), preventing sharing courses across cohorts and making it impossible to have the same course code appear in different groups/curriculums.

## Decision
- Introduce `programs` (owned by a faculty). A `curriculum` belongs to a program and is versioned by `cohort_year`; the uniqueness is `(program_id, cohort_year)`. This models "one curriculum per cohort".
- Make `courses` a shared catalog keyed by `code` (names, credits, teaching periods). Courses are not owned by a requirement group.
- Link courses to requirement groups via `requirement_group_courses` (composite key `(requirement_group_id, course_code)`, `ON DELETE RESTRICT` from courses to avoid breaking references). This allows the same course to appear across different cohorts/groups.
- Whether a course is required lives only on its group: `requirement_groups.kind` (`compulsory` with a fixed `credits_total`, or `elective` with `credits_total_min`); links carry no `compulsory` flag, and a printed group that mixes BB and TC rows is seeded as two groups, `<name>: bắt buộc` and `<name>: tự chọn`, with the printed total in `official_notes` (Project Lead decision, 2026-11-03).

## Consequences
- Multiple cohorts can coexist without duplicating course catalog entries.
- Plans and transcripts can reference `courses(code)` stably; requirement membership is explicit per curriculum/group.
- Deleting a requirement group cascades its links but does not delete catalog courses. Referential integrity is enforced.
