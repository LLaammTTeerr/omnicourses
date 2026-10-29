import type { DataSource, QueryRunner } from 'typeorm';
import { buildCatalog, CatalogConflictError, type CatalogConflict } from './catalog.js';
import type { CatalogCourse, CatalogDecision, CurriculumSeed } from './seed-types.js';

export interface SeedReport {
  inserted: { programs: number; curriculums: number; requirement_groups: number; courses: number; links: number };
  skipped: { programs: number; curriculums: number; requirement_groups: number; courses: number; links: number };
}

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
  // Throws before touching the database if the seeds disagree with each other.
  const catalog = buildCatalog(seeds, decisions);

  const report: SeedReport = {
    inserted: { programs: 0, curriculums: 0, requirement_groups: 0, courses: 0, links: 0 },
    skipped: { programs: 0, curriculums: 0, requirement_groups: 0, courses: 0, links: 0 },
  };
  const count = (table: keyof SeedReport['inserted'], rows: unknown[]) => {
    if (rows.length) report.inserted[table]++;
    else report.skipped[table]++;
  };

  const runner = dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await assertNoCatalogConflictsWithDatabase(runner, catalog);

    for (const course of catalog.values()) {
      count(
        'courses',
        await runner.query(
          `INSERT INTO courses (code, name_vi, name_en, credits, theory_time, lab_work_time, exercise_time, project_time)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (code) DO NOTHING RETURNING code`,
          [
            course.code,
            course.name_vi,
            course.name_en,
            course.credits,
            course.theory_time,
            course.lab_work_time,
            course.exercise_time,
            course.project_time,
          ],
        ),
      );
    }

    for (const seed of seeds) {
      const { program, curriculum } = seed;
      const insertedProgram = await runner.query(
        `INSERT INTO programs (code, name_vi, name_en, faculty) VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO NOTHING RETURNING id`,
        [program.code, program.name_vi, program.name_en, program.faculty],
      );
      count('programs', insertedProgram);
      const programId = (await runner.query(`SELECT id FROM programs WHERE code = $1`, [program.code]))[0].id as string;

      const insertedCurriculum = await runner.query(
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
      );
      count('curriculums', insertedCurriculum);
      const curriculumId = (
        await runner.query(`SELECT id FROM curriculums WHERE program_id = $1 AND cohort_year = $2`, [
          programId,
          curriculum.cohort_year,
        ])
      )[0].id as string;

      for (const group of seed.groups) {
        const insertedGroup = await runner.query(
          `INSERT INTO requirement_groups (curriculum_id, name, kind, official_notes, credits_total, credits_total_min)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (curriculum_id, name) DO NOTHING RETURNING id`,
          [curriculumId, group.name, group.kind, group.official_notes, group.credits_total, group.credits_total_min],
        );
        count('requirement_groups', insertedGroup);
        const groupId = (
          await runner.query(`SELECT id FROM requirement_groups WHERE curriculum_id = $1 AND name = $2`, [
            curriculumId,
            group.name,
          ])
        )[0].id as string;

        for (const row of group.rows) {
          count(
            'links',
            await runner.query(
              `INSERT INTO requirement_group_courses (requirement_group_id, course_code, compulsory)
               VALUES ($1, $2, $3)
               ON CONFLICT (requirement_group_id, course_code) DO NOTHING RETURNING course_code`,
              [groupId, row.code, row.type === 'BB'],
            ),
          );
        }
      }
    }

    await runner.commitTransaction();
    return report;
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
}

/** Rows of `courses` whose name_vi or credits differ from the seed's. */
async function assertNoCatalogConflictsWithDatabase(runner: QueryRunner, catalog: Map<string, CatalogCourse>): Promise<void> {
  const existing: { code: string; name_vi: string; credits: number }[] = await runner.query(
    `SELECT code, name_vi, credits FROM courses WHERE code = ANY($1)`,
    [[...catalog.keys()]],
  );
  const conflicts: CatalogConflict[] = [];
  for (const row of existing) {
    const seeded = catalog.get(row.code)!;
    for (const field of ['name_vi', 'credits'] as const) {
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
