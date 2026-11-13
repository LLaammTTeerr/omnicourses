import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { CatalogConflictError } from '../src/curriculum/seeds/catalog.js';
import { CATALOG_DECISIONS, CURRICULUM_SEEDS } from '../src/curriculum/seeds/index.js';
import { AddAuditRulesToCurriculum1794300000000 } from '../src/database/migrations/1794300000000-add-audit-rules-to-curriculum.js';
import { seedCurricula } from '../src/curriculum/seeds/seed-curricula.js';
import { privateSchema } from './support/schema.js';

const TABLES = [
  'programs',
  'curriculums',
  'requirement_groups',
  'courses',
  'requirement_group_courses',
  'combined_minimums',
  'combined_minimum_groups',
  'requirement_group_overflows',
] as const;

async function counts(dataSource: DataSource): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const table of TABLES) {
    result[table] = Number((await dataSource.query(`SELECT count(*)::int AS n FROM ${table}`))[0].n);
  }
  return result;
}

const CLC_NOT_COUNTED = ['BAA00021', 'BAA00022', 'BAA00030'];
const EXPECTED_AUDIT_RULES = {
  programs: [
    { code: 'APCS', training_type: 'advanced' },
    ...CURRICULUM_SEEDS.filter((s) => s.program.code !== 'APCS').map((s) => ({ code: s.program.code, training_type: 'high_quality' })),
  ].sort((a, b) => (a.code < b.code ? -1 : 1)),
  // Every link outside the cohort total is also outside the GPA, in every curriculum.
  notCounted: CURRICULUM_SEEDS.flatMap((s) => CLC_NOT_COUNTED.map((code) => ({ curriculum: s.curriculum.code, course_code: code })))
    .sort((a, b) => (a.curriculum !== b.curriculum ? (a.curriculum < b.curriculum ? -1 : 1) : a.course_code < b.course_code ? -1 : 1)),
  overflows: ['APCS2024', 'APCS2025'].map((curriculum) => ({
    curriculum,
    from_group: 'Kiến thức Computer Science (A): tự chọn',
    to_group: 'Tự chọn Computer Science (C)',
  })),
  minimums: ['APCS2024', 'APCS2025'].map((curriculum) => ({
    curriculum,
    name: 'Kiến thức tự chọn',
    credits_min: 43,
    groups: ['Tự chọn Computer Science (C)', 'Tự chọn Math (B)'],
  })),
};

async function auditRules(dataSource: DataSource) {
  const curricula = CURRICULUM_SEEDS.map((s) => s.curriculum.code);
  return {
    programs: await dataSource.query(
      `SELECT code, training_type FROM programs WHERE code = ANY($1) ORDER BY code COLLATE "C"`,
      [CURRICULUM_SEEDS.map((s) => s.program.code)],
    ),
    notCounted: await dataSource.query(
      `SELECT c.code AS curriculum, l.course_code FROM requirement_group_courses l
       JOIN requirement_groups g ON g.id = l.requirement_group_id JOIN curriculums c ON c.id = g.curriculum_id
       WHERE c.code = ANY($1) AND (NOT l.counts_toward_total OR NOT l.counts_toward_gpa)
       ORDER BY c.code COLLATE "C", l.course_code COLLATE "C"`,
      [curricula],
    ),
    overflows: await dataSource.query(
      `SELECT c.code AS curriculum, f.name AS from_group, t.name AS to_group FROM requirement_group_overflows o
       JOIN requirement_groups f ON f.id = o.from_group_id JOIN requirement_groups t ON t.id = o.to_group_id
       JOIN curriculums c ON c.id = f.curriculum_id WHERE c.code = ANY($1) ORDER BY c.code COLLATE "C"`,
      [curricula],
    ),
    minimums: await dataSource.query(
      `SELECT c.code AS curriculum, m.name, m.credits_min,
              array_agg(g.name ORDER BY g.name COLLATE "C") AS groups
       FROM combined_minimums m JOIN curriculums c ON c.id = m.curriculum_id
       JOIN combined_minimum_groups mg ON mg.combined_minimum_id = m.id JOIN requirement_groups g ON g.id = mg.requirement_group_id
       WHERE c.code = ANY($1) GROUP BY c.code, m.id ORDER BY c.code COLLATE "C"`,
      [curricula],
    ),
  };
}

// Other e2e files share the database and leave curriculum rows behind.
describe('db:seed', () => {
  let schema: string;
  let dataSource: DataSource;
  let drop: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    ({ schema, dataSource, drop } = await privateSchema('seed_e2e'));
  });

  afterAll(async () => {
    await drop?.();
  });

  it('migrates into its own empty schema', async () => {
    const [{ current_schema }] = await dataSource.query(`SELECT current_schema()`);
    expect(current_schema).toBe(schema);
    expect(Object.values(await counts(dataSource))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('loads every curriculum, then loads nothing more when run again', async () => {
    const groups = CURRICULUM_SEEDS.flatMap((s) => s.groups);
    const expected = {
      programs: new Set(CURRICULUM_SEEDS.map((s) => s.program.code)).size,
      curriculums: CURRICULUM_SEEDS.length,
      requirement_groups: groups.length,
      courses: new Set(groups.flatMap((g) => g.rows.map((r) => r.code))).size,
      requirement_group_courses: groups.flatMap((g) => g.rows).length,
      combined_minimums: CURRICULUM_SEEDS.flatMap((s) => s.blocks.filter((b) => b.at_least)).length,
      combined_minimum_groups: CURRICULUM_SEEDS.flatMap((s) => s.blocks.filter((b) => b.at_least).flatMap((b) => b.groups)).length,
      requirement_group_overflows: groups.filter((g) => g.overflow_to !== undefined).length,
    };
    // APCS 2024 and 2025: one combined minimum over two groups, and one overflow, each.
    expect([expected.combined_minimums, expected.combined_minimum_groups, expected.requirement_group_overflows]).toEqual([2, 4, 2]);

    const first = await seedCurricula(dataSource, CURRICULUM_SEEDS, CATALOG_DECISIONS);
    const afterFirst = await counts(dataSource);
    expect(afterFirst).toEqual(expected);
    expect(first.inserted.links).toBe(expected.requirement_group_courses);

    const second = await seedCurricula(dataSource, CURRICULUM_SEEDS, CATALOG_DECISIONS);
    expect(await counts(dataSource)).toEqual(afterFirst);
    expect(second.inserted).toEqual({ programs: 0, curriculums: 0, requirement_groups: 0, courses: 0, links: 0, combined_minimums: 0, overflows: 0 });
  });

  it('writes the printed totals and the decided catalog values', async () => {
    const [apcs2024] = await dataSource.query(
      `SELECT c.total_credits_min FROM curriculums c JOIN programs p ON p.id = c.program_id
       WHERE p.code = 'APCS' AND c.cohort_year = 2024`,
    );
    expect(apcs2024.total_credits_min).toBe(163);

    const [cm102] = await dataSource.query(`SELECT name_vi, credits FROM courses WHERE code = 'CM102'`);
    expect(cm102).toEqual({ name_vi: 'Tư duy phản biện', credits: 4 });

    // The printed (A) group mixes BB and TC rows, so it is seeded as two groups:
    // 40 required credits over 10 BB courses, and 16 to choose among 6 TC courses.
    const splitA = await dataSource.query(
      `SELECT g.name, g.kind, g.credits_total, g.credits_total_min, count(l.course_code)::int AS courses
       FROM requirement_groups g
       JOIN curriculums c ON c.id = g.curriculum_id
       LEFT JOIN requirement_group_courses l ON l.requirement_group_id = g.id
       WHERE c.code = 'APCS2024' AND g.name LIKE 'Kiến thức Computer Science (A)%'
       GROUP BY g.id ORDER BY g.name`,
    );
    expect(splitA).toEqual([
      { name: 'Kiến thức Computer Science (A): bắt buộc', kind: 'compulsory', credits_total: 40, credits_total_min: null, courses: 10 },
      { name: 'Kiến thức Computer Science (A): tự chọn', kind: 'elective', credits_total: null, credits_total_min: 16, courses: 6 },
    ]);
  });

  it('writes the rules the degree audit reads (ADR 0013)', async () => {
    expect(await dataSource.query(`SELECT code, training_type FROM programs WHERE code IN ('APCS', 'CNTT-TCTA-KHMT') ORDER BY code`)).toEqual([
      { code: 'APCS', training_type: 'advanced' },
      { code: 'CNTT-TCTA-KHMT', training_type: 'high_quality' },
    ]);
    expect(await auditRules(dataSource)).toEqual(EXPECTED_AUDIT_RULES);
  });

  it('migration 1794300000000 sets the same rules on rows seeded before it existed', async () => {
    const migration = new AddAuditRulesToCurriculum1794300000000();
    const runner = dataSource.createQueryRunner();
    try {
      await migration.down(runner);
      await migration.up(runner);
    } finally {
      await runner.release();
    }
    const rules = await auditRules(dataSource);
    expect(rules.programs).toEqual(EXPECTED_AUDIT_RULES.programs);
    expect(rules.notCounted).toEqual(EXPECTED_AUDIT_RULES.notCounted);
    // The new tables come back empty; the next db:seed fills them (deploy runs migrate, then seed).
    expect(rules.overflows).toEqual([]);
    await seedCurricula(dataSource, CURRICULUM_SEEDS, CATALOG_DECISIONS);
    expect(await auditRules(dataSource)).toEqual(EXPECTED_AUDIT_RULES);
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
