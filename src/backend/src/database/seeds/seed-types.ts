export type Page = number;

export interface PrintedRow {
  code: string;
  code_printed?: string;
  name_vi: string;
  credits: number;
  theory_periods: number | null;
  lab_periods: number | null;
  exercise_periods: number | null;
  project_periods: number | null;
  type: 'BB' | 'TC';
  counts_toward_total: boolean;
  counts_toward_gpa: boolean;
  page: Page;
  needs_check?: string;
}

export interface PrintedGroup {
  name: string;
  kind: 'compulsory' | 'elective';
  credits_total: number | null;
  credits_total_min: number | null;
  official_notes: string | null;
  page: Page;
  credits_pages: Page[];
  options?: { codes: string[]; page: Page; at_least?: boolean }[];
  outside_total?: boolean;
  overflow_to?: string;
  rows: PrintedRow[];
  needs_check?: string;
}

export interface AppendixRow {
  code: string;
  name_vi: string;
  name_en: string;
  page: Page;
}

export interface PrintedBlock {
  name: string;
  credits: number;
  at_least: boolean;
  groups: string[];
  page: Page;
}

export interface SeedProgram {
  code: string;
  name_vi: string;
  name_en: string | null;
  faculty: string | null;
  training_type: 'advanced' | 'joint' | 'high_quality' | 'standard';
  page: Page;
}

export interface SeedCurriculum {
  cohort_year: number;
  code: string;
  name_vi: string;
  name_en: string | null;
  language: string | null;
  total_credits_min: number;
  total_credits_pages: Page[];
  decision: { number: string; date: string; page: Page; note?: string };
}

export interface KnownDiscrepancy {
  pages: Page[];
  description: string;
  resolution: string;
}

export interface PrintedSubtotal {
  name: string;
  credits: number;
  groups: string[];
  page: Page;
  note?: string;
}

export interface NoPrerequisitesDecision {
  decided_by: string;
  date: string;
  source: string;
  except: PrerequisiteException[];
}

export interface PrerequisiteException {
  code: string;
  requires: string[];
  printed: string;
  pages: Record<string, Page>;
  decided_by: string;
  date: string;
}

export interface CurriculumSeed {
  source: { file: string; pages: number; structure?: { file: string; pages: number } };
  program: SeedProgram;
  curriculum: SeedCurriculum;
  blocks: PrintedBlock[];
  subtotals?: PrintedSubtotal[];
  groups: PrintedGroup[];
  appendix: AppendixRow[];
  known_discrepancies: KnownDiscrepancy[];
  no_prerequisites?: NoPrerequisitesDecision;
}

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

export interface CatalogDecision {
  code: string;
  field: keyof Omit<CatalogCourse, 'code'>;
  printed: { curriculum: string; value: string | number | null; pages: Page[] }[];
  catalog_value: string | number | null;
  reason: string;
}
