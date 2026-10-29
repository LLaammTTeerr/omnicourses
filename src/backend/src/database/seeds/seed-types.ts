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
  /** loaded: courses.code / requirement_group_courses.course_code. Normalised (normalizeCourseCode). */
  code: string;
  /** The code exactly as printed, only when it differs from `code`. */
  code_printed?: string;
  /** loaded: courses.name_vi ("Tên HP"). */
  name_vi: string;
  /** loaded: courses.credits ("Số TC"). */
  credits: number;
  /** loaded: courses.theory_time ("LT", "Lý thuyết"). null where the cell is blank. */
  theory_time: number | null;
  /** loaded: courses.lab_work_time ("TH", "Thực hành"). */
  lab_work_time: number | null;
  /** loaded: courses.exercise_time ("BT", "Bài tập"). 0 where the table has no such column. */
  exercise_time: number | null;
  /** loaded: courses.project_time ("ĐT", "Thực hiện đề tài"). 0 where the table has no such column. */
  project_time: number | null;
  /** "Loại HP". loaded as requirement_group_courses.compulsory: BB = true, TC = false. */
  type: 'BB' | 'TC';
  /**
   * false when the PDF says the course must be passed but does not count
   * towards the cohort total (GDTC, GDQP-AN). The schema has no column for
   * this; the group's official_notes carries the printed rule.
   */
  counts_toward_total: boolean;
  page: Page;
  /** Set when a value could not be read with certainty: the reason. */
  needs_check?: string;
}

/** A requirement group: one "7.x.y" heading of the PDF and its table. */
export interface PrintedGroup {
  /** loaded: requirement_groups.name, the heading as printed. */
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
   * A compulsory group that also asks the student to choose some credits
   * among its TC rows ("Sinh viên chọn học 16 tín chỉ"): those credits.
   * The BB rows plus this must equal credits_total.
   */
  choose_credits?: { credits: number; page: Page };
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
 * over several groups. Not loaded (the schema has no such level); the spec
 * uses it to check that the groups add up to the cohort total.
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

/** A printed subtotal over several groups, inside a block (CLC 7.1.3: 36). Not loaded. */
export interface PrintedSubtotal {
  name: string;
  /** Required credits of the groups add up to this exactly. */
  credits: number;
  groups: string[];
  page: Page;
  note?: string;
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
}

/** A course as it goes into the shared `courses` catalog. */
export interface CatalogCourse {
  code: string;
  name_vi: string;
  name_en: string | null;
  credits: number;
  theory_time: number | null;
  lab_work_time: number | null;
  exercise_time: number | null;
  project_time: number | null;
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

/** One row of the tentative teaching plan (section 8, "Kế hoạch giảng dạy (dự kiến)"). */
export interface TeachingPlanRow {
  /** The printed semester index, 1 to 12 ("Học kỳ n"). */
  semester: number;
  code: string;
  /** "Loại HP" as printed in the plan. */
  type: 'BB' | 'TC';
  credits: number;
  page: Page;
  needs_check?: string;
}

/** Section 8 of one curriculum PDF. The seed script does not load it. */
export interface TeachingPlan {
  /** curriculums.code of the curriculum the plan belongs to. */
  curriculum: string;
  note: string;
  /** Prerequisites as printed. Neither APCS PDF prints any. */
  prerequisites: { code: string; requires: string[]; page: Page }[];
  rows: TeachingPlanRow[];
  /** Courses of the curriculum that the plan places in no semester. */
  not_in_plan: { code: string; note: string }[];
  /** "Tổng cộng học kỳ n" rows, where printed. */
  printed_semester_totals: { semester: number; credits: number; page: Page; note?: string }[];
  /** Values in the plan that disagree with section 7 of the same PDF. */
  known_discrepancies: KnownDiscrepancy[];
}

// Equivalent and replacement course lists ("học phần tương đương/thay thế").
// Not loaded: there is no table for them yet.

export interface EquivalenceCourse {
  /** Normalised code, or null when the printed code cannot meet the courses.code CHECK. */
  code: string | null;
  code_printed: string;
  name: string;
  /** null where the cell is blank. */
  credits: number | null;
}

export interface EquivalenceRow {
  /** The printed STT; several when the PDF merges rows into one rule. */
  stt: number[];
  page: number;
  /** "Học phần cũ đã giảng dạy". */
  hp01: EquivalenceCourse[];
  /** "Học phần có thể thay thế cho học phần cũ" (first column group). */
  hp02: EquivalenceCourse[];
  /** "Học phần có thể thay thế cho học phần cũ" (second column group); [] when blank. */
  hp03: EquivalenceCourse[];
  /** Printed rule text, when the row has one instead of plain columns. */
  printed_rule?: string;
  needs_check?: string;
}

export interface EquivalenceList {
  source: { file: string; pages: number };
  title: string;
  issued: string;
  program_code: string;
  /** Cohorts the list applies to; null because the PDF does not say. */
  cohort_scope: number[] | null;
  /** The printed "Ghi chú" under the table. */
  note: string;
  rows: EquivalenceRow[];
}
