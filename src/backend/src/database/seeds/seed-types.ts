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

// Prerequisites and offering terms as printed. Not loaded: the tables come
// with F12 (ADR 0011), and the rule engine decides what a printed line means.

/**
 * One course's "Prior-course" line in a course-description booklet. The line
 * names courses by title, by code or by topic; `resolved` keeps only the
 * courses the line names exactly, `unresolved` everything else.
 */
export interface PrintedPrerequisite {
  /** The course the line belongs to, as printed in its "Course ID". */
  code: string;
  /** The line exactly as printed, wraps joined. */
  printed: string;
  /**
   * Codes the line names exactly: a printed code (normalizePrintedCode), or a
   * comma-separated part equal to one course heading of the same document.
   * Order as printed, no duplicates. Not a judgement of what the line means.
   */
  resolved: string[];
  /** Parts of the line that name no course of the document exactly. */
  unresolved: string[];
  page: Page;
}

/** The prerequisite statements of one document, and what it says about offering terms. */
export interface PrintedPrerequisiteList {
  source: { file: string; pages: number; sha256: string; issued: string };
  /** The printed field the lines come from, e.g. "Prior-course". */
  field: string;
  /** What the field may mean, and what must be decided before it is loaded. */
  note: string;
  lines: PrintedPrerequisite[];
  /** Courses whose line is printed blank. */
  blank: { code: string; page: Page }[];
  /** Offering terms the document prints; [] when it prints none. */
  offering_terms: { code: string; terms: number[]; page: Page }[];
}

// A printed course table with a prerequisite column. Not loaded: whether it is
// the prerequisite rule of a cohort is the Project Lead's decision (AGENTS.md
// hard rule 1), and no code is mapped to the code another cohort uses.

export type PrerequisiteTableColumn = 'code' | 'name_en' | 'name_vi' | 'credits' | 'prerequisites';

/** `sources/<id>.source.json`: where a prerequisite table comes from and how its text was read. */
export interface PrerequisiteTableSource {
  id: string;
  title: string;
  shortName: string;
  issuer: string;
  /** The issue date as printed; null when the document prints none. */
  issued: string | null;
  languages: string[];
  sourceUrl: string;
  /** The upload folder in `sourceUrl` ("2015/07"). A fact about the URL, not an issue date. */
  urlPathDate: string;
  /** `created` is the PDF's own metadata, not a printed date. The PDF itself never enters git. */
  pdf: { file: string; sha256: string; pages: number; created: string; producer: string };
  /** The whole page, `pdftotext -layout` output, unchanged. */
  textLayer: { file: string; command: string; tool: string; sha256: string };
  /** One crop per extracted column, the same on every page, unchanged. */
  columns: { field: PrerequisiteTableColumn; file: string; command: string; sha256: string }[];
  notes: string[];
}

/** One course row of a printed prerequisite table. */
export interface PrintedPrerequisiteRow {
  /** "Mã môn": the lines of the cell joined with nothing ("MTH2" + "51", "CS487-" + "CS488"). Not normalised. */
  code: string;
  /** "Tên TA": lines joined with one space, or with nothing where the column breaks a word or follows a "-". */
  name_en: string;
  /** "Tên tiếng Việt", joined like `name_en`. */
  name_vi: string;
  /** "Số tín chỉ". */
  credits: number;
  /** The credits exactly as printed, only when they differ from `credits` ("01"). */
  credits_printed?: string;
  /**
   * "Điều kiện tiên quyết" exactly as printed, lines joined with one space
   * ("MATH2" + "51" is "MATH2 51"). "None" where the cell prints None, null
   * where it prints nothing.
   */
  printed: string | null;
  /**
   * Codes the cell prints: each comma-separated part with its spaces removed
   * that has the shape of a code. Order as printed, no duplicates. Spelling is
   * never repaired ("MATH251" stays, although the row is "MTH251").
   */
  resolved: string[];
  /** Every other part of the cell, "None" excepted. */
  unresolved: string[];
  /** The page the row starts on. */
  page: Page;
}

/** The rows of one printed prerequisite table. */
export interface PrintedPrerequisiteTable {
  /** `issued` is null when the document prints no date. */
  source: { id: string; file: string; pages: number; sha256: string; sourceUrl: string; issued: string | null };
  /** The printed column the cells come from. */
  field: string;
  /** What the column may mean, and what must be decided before it is loaded. */
  note: string;
  rows: PrintedPrerequisiteRow[];
  /** Offering terms the document prints; [] when it prints none. */
  offering_terms: { code: string; terms: number[]; page: Page }[];
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
