import type { DataSource, EntityManager } from 'typeorm';
import { buildCatalog, CatalogConflictError, type CatalogConflict } from './catalog.js';
import type { CatalogCourse, CatalogDecision, CurriculumSeed } from './seed-types.js';

type SeededTable = 'programs' | 'curriculums' | 'requirement_groups' | 'courses' | 'links';

export interface SeedReport {
  inserted: Record<SeededTable, number>;
  skipped: Record<SeededTable, number>;
}

/**
 * The catalog fields a re-seed checks against the database; a difference
 * aborts the run. The other fields (name_en, the periods) may have been
 * corrected by an admin since, and insert-only keeps that edit.
 */
const FIELDS_CHECKED_AGAINST_DATABASE = ['name_vi', 'credits'] as const;

/**
 * Loads curriculum seeds in one transaction. Insert-only: a row that already
 * exists (same program code; same program and cohort; same curriculum and group
 * name; same course code; same group and course) is left untouched, so later
 * admin edits survive a re-run. A catalog course that already exists with a
 * different Vietnamese name or credit count aborts the whole run.
 */
export async function seedCurricula(
  dataSource: DataSource,
  seeds: CurriculumSeed[],
  decisions: CatalogDecision[],
): Promise<SeedReport> {
  const catalog = buildCatalog(seeds, decisions);

  const report: SeedReport = {
    inserted: { programs: 0, curriculums: 0, requirement_groups: 0, courses: 0, links: 0 },
    skipped: { programs: 0, curriculums: 0, requirement_groups: 0, courses: 0, links: 0 },
  };
  const count = (table: SeededTable, rows: unknown[]) => {
    if (rows.length) report.inserted[table]++;
    else report.skipped[table]++;
  };
  const insertOrFind = async (em: EntityManager, table: SeededTable, insert: [string, unknown[]], find: [string, unknown[]]): Promise<string> => {
    count(table, await em.query(...insert));
    return (await em.query(...find))[0].id as string;
  };

  await dataSource.transaction(async (em) => {
    await assertNoCatalogConflictsWithDatabase(em, catalog);

    for (const course of catalog.values()) {
      count(
        'courses',
        await em.query(
          `INSERT INTO courses (code, name_vi, name_en, credits, theory_periods, lab_periods, exercise_periods, project_periods)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (code) DO NOTHING RETURNING code`,
          [
            course.code,
            course.name_vi,
            course.name_en,
            course.credits,
            course.theory_periods,
            course.lab_periods,
            course.exercise_periods,
            course.project_periods,
          ],
        ),
      );
    }

    for (const seed of seeds) {
      const { program, curriculum } = seed;
      const programId = await insertOrFind(
        em,
        'programs',
        [
          `INSERT INTO programs (code, name_vi, name_en, faculty) VALUES ($1, $2, $3, $4)
           ON CONFLICT (code) DO NOTHING RETURNING id`,
          [program.code, program.name_vi, program.name_en, program.faculty],
        ],
        [`SELECT id FROM programs WHERE code = $1`, [program.code]],
      );

      const curriculumId = await insertOrFind(
        em,
        'curriculums',
        [
          `INSERT INTO curriculums (program_id, cohort_year, code, name_vi, name_en, language, total_credits_min)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (program_id, cohort_year) DO NOTHING RETURNING id`,
          [
            programId,
            curriculum.cohort_year,
            curriculum.code,
            curriculum.name_vi,
            curriculum.name_en,
            curriculum.language,
            curriculum.total_credits_min,
          ],
        ],
        [`SELECT id FROM curriculums WHERE program_id = $1 AND cohort_year = $2`, [programId, curriculum.cohort_year]],
      );

      for (const group of seed.groups) {
        const groupId = await insertOrFind(
          em,
          'requirement_groups',
          [
            `INSERT INTO requirement_groups (curriculum_id, name, kind, official_notes, credits_total, credits_total_min)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (curriculum_id, name) DO NOTHING RETURNING id`,
            [curriculumId, group.name, group.kind, group.official_notes, group.credits_total, group.credits_total_min],
          ],
          [`SELECT id FROM requirement_groups WHERE curriculum_id = $1 AND name = $2`, [curriculumId, group.name]],
        );

        for (const row of group.rows) {
          count(
            'links',
            await em.query(
              `INSERT INTO requirement_group_courses (requirement_group_id, course_code)
               VALUES ($1, $2)
               ON CONFLICT (requirement_group_id, course_code) DO NOTHING RETURNING course_code`,
              [groupId, row.code],
            ),
          );
        }
      }
    }
  });
  return report;
}

async function assertNoCatalogConflictsWithDatabase(em: EntityManager, catalog: Map<string, CatalogCourse>): Promise<void> {
  const existing: { code: string; name_vi: string; credits: number }[] = await em.query(
    `SELECT code, ${FIELDS_CHECKED_AGAINST_DATABASE.join(', ')} FROM courses WHERE code = ANY($1)`,
    [[...catalog.keys()]],
  );
  const conflicts: CatalogConflict[] = [];
  for (const row of existing) {
    const seeded = catalog.get(row.code)!;
    for (const field of FIELDS_CHECKED_AGAINST_DATABASE) {
      if (row[field] !== seeded[field]) {
        conflicts.push({
          code: row.code,
          field,
          values: [
            { where: 'database', value: row[field] },
            { where: 'seed', value: seeded[field] },
          ],
        });
      }
    }
  }
  if (conflicts.length) throw new CatalogConflictError(conflicts);
}
