import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../src/database/data-source.js';
import { CatalogConflictError } from '../src/database/seeds/catalog.js';
import { CATALOG_DECISIONS, CURRICULUM_SEEDS } from '../src/database/seeds/index.js';
import { seedCurricula } from '../src/database/seeds/seed-curricula.js';

const databaseUrl = process.env.DATABASE_URL;

// Other e2e files share the database and leave curriculum rows behind, so this
// file migrates and seeds a schema of its own, then drops it.
const schema = `seed_e2e_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

const TABLES = ['programs', 'curriculums', 'requirement_groups', 'courses', 'requirement_group_courses'] as const;

async function counts(dataSource: DataSource): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const table of TABLES) {
    result[table] = Number((await dataSource.query(`SELECT count(*)::int AS n FROM ${table}`))[0].n);
  }
  return result;
}

describe.skipIf(!databaseUrl)('db:seed', () => {
  let admin: DataSource;
  let dataSource: DataSource;

  beforeAll(async () => {
    admin = new DataSource({ ...dataSourceOptions, url: databaseUrl });
    await admin.initialize();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    dataSource = new DataSource({
      ...dataSourceOptions,
      url: databaseUrl,
      schema,
      extra: { options: `-c search_path=${schema}` },
    });
    await dataSource.initialize();
    await dataSource.runMigrations({ transaction: 'each' });
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await admin?.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin?.destroy();
  });

  it('migrates into its own empty schema', async () => {
    const [{ current_schema }] = await dataSource.query(`SELECT current_schema()`);
    expect(current_schema).toBe(schema);
    expect(Object.values(await counts(dataSource))).toEqual([0, 0, 0, 0, 0]);
  });

  it('loads every curriculum, then loads nothing more when run again', async () => {
    const groups = CURRICULUM_SEEDS.flatMap((s) => s.groups);
    const expected = {
      programs: new Set(CURRICULUM_SEEDS.map((s) => s.program.code)).size,
      curriculums: CURRICULUM_SEEDS.length,
      requirement_groups: groups.length,
      courses: new Set(groups.flatMap((g) => g.rows.map((r) => r.code))).size,
      requirement_group_courses: groups.flatMap((g) => g.rows).length,
    };

    const first = await seedCurricula(dataSource, CURRICULUM_SEEDS, CATALOG_DECISIONS);
    const afterFirst = await counts(dataSource);
    expect(afterFirst).toEqual(expected);
    expect(first.inserted.links).toBe(expected.requirement_group_courses);

    const second = await seedCurricula(dataSource, CURRICULUM_SEEDS, CATALOG_DECISIONS);
    expect(await counts(dataSource)).toEqual(afterFirst);
    expect(second.inserted).toEqual({ programs: 0, curriculums: 0, requirement_groups: 0, courses: 0, links: 0 });
  });

  it('writes the printed totals and the decided catalog values', async () => {
    const [apcs2024] = await dataSource.query(
      `SELECT c.total_credits_min FROM curriculums c JOIN programs p ON p.id = c.program_id
       WHERE p.code = 'APCS' AND c.cohort_year = 2024`,
    );
    expect(apcs2024.total_credits_min).toBe(163);

    const [cm102] = await dataSource.query(`SELECT name_vi, credits FROM courses WHERE code = 'CM102'`);
    expect(cm102).toEqual({ name_vi: 'Tư duy phản biện', credits: 4 });

    const [{ compulsory }] = await dataSource.query(
      `SELECT count(*)::int AS compulsory FROM requirement_group_courses l
       JOIN requirement_groups g ON g.id = l.requirement_group_id
       JOIN curriculums c ON c.id = g.curriculum_id
       WHERE c.code = 'APCS2024' AND g.name = 'Kiến thức Computer Science (A)' AND l.compulsory`,
    );
    expect(compulsory).toBe(10);
  });

  it('keeps an admin edit to a group, and aborts on a catalog course edited to a new name', async () => {
    await dataSource.query(`UPDATE requirement_groups SET official_notes = 'edited by an admin' WHERE name = 'Kiến thức Math'`);
    await seedCurricula(dataSource, CURRICULUM_SEEDS, CATALOG_DECISIONS);
    const notes = await dataSource.query(`SELECT official_notes FROM requirement_groups WHERE name = 'Kiến thức Math'`);
    expect(notes.every((n: { official_notes: string }) => n.official_notes === 'edited by an admin')).toBe(true);

    await dataSource.query(`UPDATE courses SET name_vi = 'Renamed' WHERE code = 'CS160'`);
    await expect(seedCurricula(dataSource, CURRICULUM_SEEDS, CATALOG_DECISIONS)).rejects.toThrow(CatalogConflictError);
    await expect(seedCurricula(dataSource, CURRICULUM_SEEDS, CATALOG_DECISIONS)).rejects.toThrow(/CS160\.name_vi/);
    await dataSource.query(`UPDATE courses SET name_vi = 'Nhập môn Tin học' WHERE code = 'CS160'`);
  });

  it('rolls back everything when one insert fails', async () => {
    const before = await counts(dataSource);
    const broken = structuredClone(CURRICULUM_SEEDS[CURRICULUM_SEEDS.length - 1]);
    broken.curriculum.cohort_year = 2099;
    broken.curriculum.code = 'BROKEN2099';
    broken.groups.push({ ...structuredClone(broken.groups[0]), name: 'Broken group', kind: 'other' as 'elective' });
    await expect(seedCurricula(dataSource, [broken], CATALOG_DECISIONS)).rejects.toThrow(/ck_requirement_groups_kind/);
    expect(await counts(dataSource)).toEqual(before);
  });
});
