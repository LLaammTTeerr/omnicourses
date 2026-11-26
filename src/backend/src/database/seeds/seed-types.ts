// Shapes of the curriculum seed files. The files mirror the printed tables of
// the official curriculum PDF row by row, so a reviewer can hold a page next
// to the file. Fields marked "loaded" map onto the columns of migration
// 1792912952302 (#23); every other field is review metadata (PDF page,
// printed rule) that the seed script does not write.
//
// Pages are the printed page numbers of the PDF ("Trang n/16").

export type Page = number;

/**
 * One row of a section 7 table: a course and its link to the table's group.
 * Becomes one `courses` row (shared catalog) and one
 * `requirement_group_courses` row.
 */
export interface PrintedRow {
  /** loaded: courses.code / requirement_group_courses.course_code. Normalised (normalizePrintedCode). */
  code: string;
  /** The code exactly as printed, only when it differs from `code`. */
  code_printed?: string;
  /** loaded: courses.name_vi ("Tên HP"). */
  name_vi: string;
  /** loaded: courses.credits ("Số TC"). */
  credits: number;
  /** loaded: courses.theory_periods ("LT", "Lý thuyết"). null where the cell is blank. */
  theory_periods: number | null;
  /** loaded: courses.lab_periods ("TH", "Thực hành"). */
  lab_periods: number | null;
  /** loaded: courses.exercise_periods ("BT", "Bài tập"). 0 where the table has no such column. */
  exercise_periods: number | null;
  /** loaded: courses.project_periods ("ĐT", "Thực hiện đề tài"). 0 where the table has no such column. */
  project_periods: number | null;
  /**
   * "Loại HP". Not loaded: the schema says whether a course is required only
   * through its group's kind. A compulsory group holds only BB rows and an
   * elective group only TC rows; a printed table that mixes both is seeded as
   * two groups ("<name>: bắt buộc" and "<name>: tự chọn", Project Lead,
   * 2026-11-03).
   */
  type: 'BB' | 'TC';
  /**
   * false when the PDF says the course must be passed but does not count
   * towards the cohort total (GDTC, GDQP-AN). The schema has no column for
   * this; the group's official_notes carries the printed rule.
   * loaded: requirement_group_courses.counts_toward_total (migration 1794300000000).
   */
  counts_toward_total: boolean;
  /**
   * loaded: requirement_group_courses.counts_toward_gpa. false when the PDF says the
   * course's grade is left out of the GPA (QĐ 1175/QĐ-KHTN Điều 15.1.c). In every seeded
   * curriculum these are exactly the rows with counts_toward_total false.
   */
  counts_toward_gpa: boolean;
  page: Page;
  /** Set when a value could not be read with certainty: the reason. */
  needs_check?: string;
}

/** A requirement group: one "7.x.y" heading of the PDF and its table. */
export interface PrintedGroup {
  /**
   * loaded: requirement_groups.name, the heading as printed. A printed group
   * split by row type takes a ": bắt buộc" / ": tự chọn" suffix and is listed
   * in a PrintedSubtotal under its printed name.
   */
  name: string;
  /** loaded: requirement_groups.kind. */
  kind: 'compulsory' | 'elective';
  /** loaded: requirement_groups.credits_total (compulsory groups). */
  credits_total: number | null;
  /** loaded: requirement_groups.credits_total_min (elective groups). */
  credits_total_min: number | null;
  /** loaded: requirement_groups.official_notes, the printed rule text. */
  official_notes: string | null;
  /** Page of the group's heading. */
  page: Page;
  /** Pages where the group's credit total is printed. */
  credits_pages: Page[];
  /**
   * A group met by exactly one of several course sets (graduation: a thesis
   * or two capstone projects). Each set must add up to the group's credits.
   */
  options?: { codes: string[]; page: Page; at_least?: boolean }[];
  /**
   * true for a group the PDF requires but leaves out of the cohort total
   * (GDTC, GDQP-AN in CLC). It is checked against its own printed total and
   * belongs to no block.
   */
  outside_total?: boolean;
  /**
   * loaded: requirement_group_overflows. The name of the group of the same curriculum that the
   * credits passed here beyond this group's own minimum count toward (APCS (A) → (C), p.5).
   */
  overflow_to?: string;
  rows: PrintedRow[];
  needs_check?: string;
}

/** One row of the appendix (section 9): Vietnamese and English course names. */
export interface AppendixRow {
  code: string;
  name_vi: string;
  /** loaded: courses.name_en. */
  name_en: string;
  page: Page;
}

/**
 * A "khối kiến thức" row of the section 6 structure table: a printed total
 * over several groups. The spec uses it to check that the groups add up to
 * the cohort total. A block printed as a minimum (`at_least`, "≥ 43") is
 * loaded as a combined minimum (combined_minimums, ADR 0013): its groups
 * must reach it together. An exact block adds no rule: it is the sum of its
 * groups' own totals.
 */
export interface PrintedBlock {
  name: string;
  /** The printed total; a minimum when `at_least` is true ("≥ 43"). */
  credits: number;
  at_least: boolean;
  /** Names of the groups the block covers. */
  groups: string[];
  page: Page;
}

export interface SeedProgram {
  /** loaded: programs.code. */
  code: string;
  /** loaded: programs.name_vi. */
  name_vi: string;
  /** loaded: programs.name_en. */
  name_en: string | null;
  /** loaded: programs.faculty. */
  faculty: string | null;
  /** loaded: programs.training_type (ADR 0012): APCS is Tiên tiến, the CLC programs Chất lượng cao. */
  training_type: 'advanced' | 'joint' | 'high_quality' | 'standard';
  page: Page;
}

export interface SeedCurriculum {
  /** loaded: curriculums.cohort_year. */
  cohort_year: number;
  /** loaded: curriculums.code. */
  code: string;
  /** loaded: curriculums.name_vi. */
  name_vi: string;
  /** loaded: curriculums.name_en. */
  name_en: string | null;
  /** loaded: curriculums.language. */
  language: string | null;
  /** loaded: curriculums.total_credits_min, the cohort total as printed. */
  total_credits_min: number;
  /** Pages where the cohort total is printed. */
  total_credits_pages: Page[];
  /** The decision that issued the curriculum, as printed on page 1. */
  decision: { number: string; date: string; page: Page; note?: string };
}

/** Printed totals or values that disagree with each other inside one PDF. */
export interface KnownDiscrepancy {
  pages: Page[];
  description: string;
  /** What the seed uses, and why. */
  resolution: string;
}

/**
 * A printed total over several groups, inside a block: a printed section the
 * seed splits into several groups (CLC 7.1.3: 36; APCS "Kiến thức Computer
 * Science (A)": 56, split into its BB and TC rows). Not loaded.
 */
export interface PrintedSubtotal {
  name: string;
  /** Required credits of the groups add up to this exactly. */
  credits: number;
  groups: string[];
  page: Page;
  note?: string;
}

/**
 * A decision that no course of a curriculum has a prerequisite, except the printed ones in `except`.
 * It records who decided, when, and what the decision rests on.
 */
export interface NoPrerequisitesDecision {
  decided_by: string;
  /** ISO date of the decision. */
  date: string;
  /** Where the decision was stated, and whether an official document backs it. */
  source: string;
  /**
   * loaded: courses that do have a prerequisite, printed in the curriculum PDF. Each gets its
   * `course_prerequisite_lists` row with one `course_prerequisites` row per code of `requires`: every one
   * must be passed before the course is taken (QĐ 1175/QĐ-KHTN Điều 3.1.c; the schema has no other kind).
   */
  except: PrerequisiteException[];
}

/** A printed prerequisite rule that a "no prerequisite" decision keeps. */
export interface PrerequisiteException {
  code: string;
  /** Codes that must be passed before `code`. */
  requires: string[];
  /** The printed sentence, verbatim. */
  printed: string;
  /** Page of the printed sentence, per curriculums.code. */
  pages: Record<string, Page>;
  decided_by: string;
  /** ISO date of the decision to keep it. The seed may have recorded the rule before that date. */
  date: string;
}

/** One curriculum, transcribed from its PDF(s). */
export interface CurriculumSeed {
  /**
   * The PDF the rows come from. When `structure` is set, the rows' pages refer
   * to `file` and every other page (program, curriculum, block, group) refers to
   * `structure`; otherwise every page refers to `file`.
   */
  source: { file: string; pages: number; structure?: { file: string; pages: number } };
  program: SeedProgram;
  curriculum: SeedCurriculum;
  blocks: PrintedBlock[];
  subtotals?: PrintedSubtotal[];
  groups: PrintedGroup[];
  appendix: AppendixRow[];
  known_discrepancies: KnownDiscrepancy[];
  /**
   * loaded: one `course_prerequisite_lists` row per course of the curriculum. It has no
   * `course_prerequisites`, which the read API and the rule engine read as "no prerequisite" (ADR 0011),
   * except for a course in `except`, whose list holds its printed prerequisites.
   * Absent: nothing is written, and the courses stay "not recorded".
   */
  no_prerequisites?: NoPrerequisitesDecision;
}

/** A course as it goes into the shared `courses` catalog. */
export interface CatalogCourse {
  code: string;
  name_vi: string;
  name_en: string | null;
  credits: number;
  theory_periods: number | null;
  lab_periods: number | null;
  exercise_periods: number | null;
  project_periods: number | null;
}

/**
 * A course whose printed values differ between two cohort PDFs, and the value
 * the shared catalog takes. Without an entry here, any difference aborts the
 * seed: the last cohort never silently wins.
 */
export interface CatalogDecision {
  code: string;
  field: keyof Omit<CatalogCourse, 'code'>;
  /** The printed value per curriculum (curriculums.code), with its pages. */
  printed: { curriculum: string; value: string | number | null; pages: Page[] }[];
  /** The value the catalog takes. Must be one of the printed values. */
  catalog_value: string | number | null;
  reason: string;
}
