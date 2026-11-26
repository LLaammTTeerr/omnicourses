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
- 2026-11-26: The APCS 2024 and 2025 PDFs print different values for some course codes, but the shared catalog holds one value per code. A human approves each difference in review, in `seeds/apcs-catalog-decisions.ts`. The catalog takes the value of the newer curriculum, because the school names the course that way today. The curriculum seed stops, and its spec fails, on a difference that has no decision.

## Seed data
- 2026-11-26: The APCS seeds are typed by hand from the 16 scanned pages of ChuongTrinhDaoTao_APCS_2024.pdf and ChuongTrinhDaoTao_APCS_2025.pdf. A page is the printed "Trang n/16", and a reviewer checks every row against its page. Names keep the PDF diacritics, and a dash is an ASCII "-", because the PDF mixes "-" and "–" for one course.
- 2026-11-26: The CLC 2025 seeds ("Chương trình tăng cường tiếng Anh" of ngành Công nghệ thông tin, 7480201) come from one booklet, TCTA_CTDT_2025_Khoa-2025-all.pdf ("Trang n/73"), for the structure, the totals and the group pages, and from one table PDF per specialization for the rows. A program has one curriculum per cohort, so each of the nine specializations is its own program.
- 2026-11-26: A CLC 2025 table PDF (TCTA_CTDT_2025_<KEY>.pdf) prints no page numbers, so the page of a row is the physical page of that file. The group of a row follows the "Nhóm kiến thức" column of the table, checked against sections 7.1 to 7.2.3 of the booklet. In each group, the rows of a seed file keep the printed row order (STT). The groups follow the order of the `ClcRows` keys, so in `clc-2025-cnttin.rows.ts` the free-elective rows (STT 91–98) come after the graduation rows (STT 99–127).
- 2026-11-26: A seed row lists the columns in the order of the printed table: code, Tên HP (`name_vi`), Số TC (`credits`), LT (lý thuyết, `theory_periods`), TH (thực hành, `lab_periods`), BT (bài tập, `exercise_periods`), ĐT (thực hiện đề tài, `project_periods`) and page. A blank cell is null. A column that the table does not print is 0.
- 2026-11-26: A seed file mirrors the printed tables row by row, so a reviewer can hold the page next to the file. `curriculum/seed-curricula.ts` writes some fields; the others (pages, subtotals, discrepancies, `needs_check`) are review metadata.

## Consequences
- Multiple cohorts can coexist without duplicating course catalog entries.
- Plans and transcripts can reference `courses(code)` stably; requirement membership is explicit per curriculum/group.
- Deleting a requirement group cascades its links but does not delete catalog courses. Referential integrity is enforced.
