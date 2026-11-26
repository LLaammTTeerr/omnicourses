import type { DataSource, EntityManager } from 'typeorm';
import { buildCatalog, CatalogConflictError, type CatalogConflict } from '../database/seeds/catalog.js';
import { CATALOG_DECISIONS, CURRICULUM_SEEDS } from '../database/seeds/index.js';
import type { CatalogCourse, CatalogDecision, CurriculumSeed } from '../database/seeds/seed-types.js';

const SEEDED_TABLES = ['programs', 'curriculums', 'requirement_groups', 'courses', 'links', 'combined_minimums', 'overflows', 'prerequisite_lists', 'prerequisites'] as const;
type SeededTable = (typeof SEEDED_TABLES)[number];
type Query = [sql: string, parameters: unknown[]];
type Group = CurriculumSeed['groups'][number];

export interface SeedReport {
  inserted: Record<SeededTable, number>;
  skipped: Record<SeededTable, number>;
}

const FIELDS_CHECKED_AGAINST_DATABASE = ['name_vi', 'credits'] as const;

export async function seed(dataSource: DataSource): Promise<string[]> {
  const report = await seedCurricula(dataSource, CURRICULUM_SEEDS, CATALOG_DECISIONS);
  return [`Inserted: ${JSON.stringify(report.inserted)}`, `Already present, left untouched: ${JSON.stringify(report.skipped)}`];
}

export async function seedCurricula(
  dataSource: DataSource,
  seeds: CurriculumSeed[],
  decisions: CatalogDecision[],
): Promise<SeedReport> {
  const catalog = buildCatalog(seeds, decisions);
  const report: SeedReport = { inserted: noRows(), skipped: noRows() };
  await dataSource.transaction(async (em) => {
    await assertNoCatalogConflictsWithDatabase(em, catalog);
    const writer = new SeedWriter(em, report);
    await insertCourses(writer, catalog);
    for (const seed of seeds) await insertCurriculum(writer, seed);
  });
  return report;
}

function noRows(): Record<SeededTable, number> {
  return Object.fromEntries(SEEDED_TABLES.map((table) => [table, 0])) as Record<SeededTable, number>;
}

class SeedWriter {
  constructor(
    private readonly em: EntityManager,
    readonly report: SeedReport,
  ) {}

  query(...[sql, parameters]: Query): Promise<unknown[]> {
    return this.em.query(sql, parameters);
  }

  async insert(table: SeededTable, ...query: Query): Promise<unknown[]> {
    const rows = await this.query(...query);
    if (rows.length) this.report.inserted[table]++;
    else this.report.skipped[table]++;
    return rows;
  }

  async insertOrFind(table: SeededTable, insert: Query, find: Query): Promise<string> {
    await this.insert(table, ...insert);
    return ((await this.query(...find))[0] as { id: string }).id;
  }
}

async function insertCourses(writer: SeedWriter, catalog: Map<string, CatalogCourse>): Promise<void> {
  for (const course of catalog.values()) {
    await writer.insert(
      'courses',
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
    );
  }
}

async function insertCurriculum(writer: SeedWriter, seed: CurriculumSeed): Promise<void> {
  const { program, curriculum } = seed;
  const programId = await writer.insertOrFind(
    'programs',
    [
      `INSERT INTO programs (code, name_vi, name_en, faculty, training_type) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO NOTHING RETURNING id`,
      [program.code, program.name_vi, program.name_en, program.faculty, program.training_type],
    ],
    [`SELECT id FROM programs WHERE code = $1`, [program.code]],
  );
  const curriculumId = await writer.insertOrFind(
    'curriculums',
    [
      `INSERT INTO curriculums (program_id, cohort_year, code, name_vi, name_en, language, total_credits_min)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (program_id, cohort_year) DO NOTHING RETURNING id`,
      [programId, curriculum.cohort_year, curriculum.code, curriculum.name_vi, curriculum.name_en, curriculum.language, curriculum.total_credits_min],
    ],
    [`SELECT id FROM curriculums WHERE program_id = $1 AND cohort_year = $2`, [programId, curriculum.cohort_year]],
  );
  const groupIds = await insertGroups(writer, curriculumId, seed.groups);
  const groupId = (name: string): string => {
    const id = groupIds.get(name);
    if (!id) throw new Error(`${curriculum.code}: no requirement group named "${name}"`);
    return id;
  };
  await insertCombinedMinimums(writer, curriculumId, seed.blocks, groupId);
  await insertOverflows(writer, seed.groups, groupId);
  if (seed.no_prerequisites) await insertPrerequisiteLists(writer, curriculumId, seed.groups, seed.no_prerequisites.except);
}

async function insertGroups(writer: SeedWriter, curriculumId: string, groups: Group[]): Promise<Map<string, string>> {
  const groupIds = new Map<string, string>();
  for (const group of groups) {
    const groupId = await writer.insertOrFind(
      'requirement_groups',
      [
        `INSERT INTO requirement_groups (curriculum_id, name, kind, official_notes, credits_total, credits_total_min)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (curriculum_id, name) DO NOTHING RETURNING id`,
        [curriculumId, group.name, group.kind, group.official_notes, group.credits_total, group.credits_total_min],
      ],
      [`SELECT id FROM requirement_groups WHERE curriculum_id = $1 AND name = $2`, [curriculumId, group.name]],
    );
    groupIds.set(group.name, groupId);
    await insertGroupCourses(writer, groupId, group);
  }
  return groupIds;
}

async function insertGroupCourses(writer: SeedWriter, groupId: string, group: Group): Promise<void> {
  for (const row of group.rows) {
    await writer.insert(
      'links',
      `INSERT INTO requirement_group_courses (requirement_group_id, course_code, counts_toward_total, counts_toward_gpa)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (requirement_group_id, course_code) DO NOTHING RETURNING course_code`,
      [groupId, row.code, row.counts_toward_total, row.counts_toward_gpa],
    );
  }
}

async function insertCombinedMinimums(writer: SeedWriter, curriculumId: string, blocks: CurriculumSeed['blocks'], groupId: (name: string) => string): Promise<void> {
  for (const block of blocks.filter((b) => b.at_least)) {
    const minimumId = await writer.insertOrFind(
      'combined_minimums',
      [
        `INSERT INTO combined_minimums (curriculum_id, name, credits_min) VALUES ($1, $2, $3)
         ON CONFLICT (curriculum_id, name) DO NOTHING RETURNING id`,
        [curriculumId, block.name, block.credits],
      ],
      [`SELECT id FROM combined_minimums WHERE curriculum_id = $1 AND name = $2`, [curriculumId, block.name]],
    );
    for (const name of block.groups) {
      await writer.query(
        `INSERT INTO combined_minimum_groups (combined_minimum_id, requirement_group_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [minimumId, groupId(name)],
      );
    }
  }
}

async function insertOverflows(writer: SeedWriter, groups: Group[], groupId: (name: string) => string): Promise<void> {
  for (const group of groups.filter((g) => g.overflow_to !== undefined)) {
    await writer.insert(
      'overflows',
      `INSERT INTO requirement_group_overflows (from_group_id, to_group_id) VALUES ($1, $2)
       ON CONFLICT (from_group_id) DO NOTHING RETURNING from_group_id`,
      [groupId(group.name), groupId(group.overflow_to!)],
    );
  }
}

type PrintedPrerequisites = NonNullable<CurriculumSeed['no_prerequisites']>['except'];

async function insertPrerequisiteLists(writer: SeedWriter, curriculumId: string, groups: Group[], except: PrintedPrerequisites): Promise<void> {
  const printed = new Map(except.map((e) => [e.code, e.requires]));
  for (const code of new Set(groups.flatMap((g) => g.rows.map((r) => r.code)))) {
    const list = await writer.insert(
      'prerequisite_lists',
      `INSERT INTO course_prerequisite_lists (curriculum_id, course_code) VALUES ($1, $2)
       ON CONFLICT (curriculum_id, course_code) DO NOTHING RETURNING course_code`,
      [curriculumId, code],
    );
    for (const prerequisite of printed.get(code) ?? []) {
      if (!list.length) {
        writer.report.skipped.prerequisites++;
        continue;
      }
      await writer.insert(
        'prerequisites',
        `INSERT INTO course_prerequisites (curriculum_id, course_code, prerequisite_code) VALUES ($1, $2, $3) RETURNING course_code`,
        [curriculumId, code, prerequisite],
      );
    }
  }
}

async function assertNoCatalogConflictsWithDatabase(em: EntityManager, catalog: Map<string, CatalogCourse>): Promise<void> {
  const existing: Pick<CatalogCourse, 'code' | (typeof FIELDS_CHECKED_AGAINST_DATABASE)[number]>[] = await em.query(
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
