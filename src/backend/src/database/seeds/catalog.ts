import type { CatalogCourse, CatalogDecision, CurriculumSeed, PrintedRow } from './seed-types.js';

/** courses.code CHECK in migration 1792912952302. */
export const COURSE_CODE_PATTERN = /^[A-Z0-9]{2,20}$/;

/** Trim, upper-case, and drop spaces and dashes, so a printed code meets the CHECK. */
export function normalizeCourseCode(printed: string): string {
  return printed.trim().toUpperCase().replace(/[\s\-‐-―]/g, '');
}

const CATALOG_FIELDS = [
  'name_vi',
  'name_en',
  'credits',
  'theory_time',
  'lab_work_time',
  'exercise_time',
  'project_time',
] as const satisfies readonly (keyof Omit<CatalogCourse, 'code'>)[];

/** The catalog course one section 7 row describes, with name_en from the appendix. */
export function rowToCourse(seed: CurriculumSeed, row: PrintedRow): CatalogCourse {
  const appendix = seed.appendix.find((a) => a.code === row.code);
  return {
    code: row.code,
    name_vi: row.name_vi,
    name_en: appendix?.name_en ?? null,
    credits: row.credits,
    theory_time: row.theory_time,
    lab_work_time: row.lab_work_time,
    exercise_time: row.exercise_time,
    project_time: row.project_time,
  };
}

interface Sighting {
  course: CatalogCourse;
  cohort_year: number;
  label: string;
  page: number;
}

/** Two sightings of one code that disagree on one field. */
export interface CatalogConflict {
  code: string;
  field: string;
  values: { where: string; value: unknown }[];
}

export class CatalogConflictError extends Error {
  constructor(readonly conflicts: CatalogConflict[]) {
    super(
      `Course catalog conflict: ${conflicts.length} value(s) differ for the same course code. ` +
        'Resolve each in the seed data or with an explicit catalog decision; the seed never lets the last write win.\n' +
        conflicts
          .map(
            (c) => `  ${c.code}.${c.field}: ` + c.values.map((v) => `${JSON.stringify(v.value)} (${v.where})`).join(' vs '),
          )
          .join('\n'),
    );
    this.name = 'CatalogConflictError';
  }
}

function seedLabel(seed: CurriculumSeed): string {
  return `${seed.program.code} ${seed.curriculum.cohort_year}`;
}

/**
 * Builds the shared course catalog from several curriculum seeds. A code that
 * appears more than once must carry the same values everywhere, unless a
 * CatalogDecision names the field and every printed value; then the catalog
 * takes the decision's value. Any other difference throws CatalogConflictError.
 */
export function buildCatalog(seeds: CurriculumSeed[], decisions: CatalogDecision[]): Map<string, CatalogCourse> {
  const sightings = new Map<string, Sighting[]>();
  for (const seed of seeds) {
    for (const group of seed.groups) {
      for (const row of group.rows) {
        const list = sightings.get(row.code) ?? [];
        list.push({
          course: rowToCourse(seed, row),
          cohort_year: seed.curriculum.cohort_year,
          label: `${seedLabel(seed)} p.${row.page}`,
          page: row.page,
        });
        sightings.set(row.code, list);
      }
    }
  }

  const conflicts: CatalogConflict[] = [];
  const catalog = new Map<string, CatalogCourse>();
  for (const [code, list] of sightings) {
    const course: CatalogCourse = { ...list[0].course };
    for (const field of CATALOG_FIELDS) {
      const distinct = [...new Set(list.map((s) => s.course[field]))];
      if (distinct.length === 1) continue;
      const decision = decisions.find((d) => d.code === code && d.field === field);
      const decided = decision ? new Set(decision.printed.map((p) => p.value)) : undefined;
      if (decision && distinct.every((v) => decided!.has(v)) && decided!.has(decision.catalog_value)) {
        (course as unknown as Record<string, unknown>)[field] = decision.catalog_value;
        continue;
      }
      conflicts.push({ code, field, values: list.map((s) => ({ where: s.label, value: s.course[field] })) });
    }
    catalog.set(code, course);
  }
  if (conflicts.length) throw new CatalogConflictError(conflicts);
  return catalog;
}
