import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apcs2024 } from '../src/curriculum/seeds/apcs-2024.js';
import { CATALOG_DECISIONS, CURRICULUM_SEEDS } from '../src/curriculum/seeds/index.js';
import { seedCurricula } from '../src/curriculum/seeds/seed-curricula.js';
import { bootApp } from './support/app.js';
import { signedInUser } from './support/users.js';

const CURRICULUM_TABLES = [
  'programs',
  'curriculums',
  'requirement_groups',
  'courses',
  'requirement_group_courses',
  'combined_minimums',
  'combined_minimum_groups',
  'requirement_group_overflows',
];

interface Group {
  id: string;
  name: string;
  kind: string;
  creditsTotal: number | null;
  creditsTotalMin: number | null;
  officialNotes: string | null;
  courses: { code: string; credits: number }[];
}

describe('Curriculum API (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const http = () => request(app.getHttpServer());
  const get = (path: string) => http().get(path).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await bootApp();
    // Insert-only: a database another test or a previous run already seeded is left as it is.
    await seedCurricula(app.get(DataSource), CURRICULUM_SEEDS, CATALOG_DECISIONS);
    ({ token } = await signedInUser(app));
  });

  afterAll(async () => {
    await app?.close();
  });

  it('maps the curriculum tables exactly as migrations 1792912952302 and 1794300000000 create them', async () => {
    const { upQueries } = await app.get(DataSource).driver.createSchemaBuilder().log();
    const touching = upQueries.map((q) => q.query).filter((q) => CURRICULUM_TABLES.some((t) => q.includes(`"${t}"`)));
    expect(touching).toEqual([]);
  });

  it('lists every seeded program with its cohorts', async () => {
    const { body } = await get('/api/programs').expect(200);
    const byCode = Object.fromEntries((body.programs as { code: string; cohortYears: number[] }[]).map((p) => [p.code, p]));
    expect(byCode.APCS).toEqual({ code: 'APCS', nameVi: apcs2024.program.name_vi, nameEn: null, faculty: null, trainingType: 'advanced', cohortYears: [2024, 2025] });
    for (const seed of CURRICULUM_SEEDS) expect(byCode[seed.program.code].cohortYears).toContain(seed.curriculum.cohort_year);
  });

  it('returns the APCS 2024 curriculum with every group and course of the seed', async () => {
    const { body } = await get('/api/programs/APCS/curricula/2024').expect(200);
    expect(body).toMatchObject({
      code: 'APCS2024',
      program: { code: 'APCS' },
      cohortYear: 2024,
      nameVi: apcs2024.curriculum.name_vi,
      language: 'en',
      totalCreditsMin: 163,
    });
    const groups = body.requirementGroups as Group[];
    const expected = apcs2024.groups
      .map((g) => ({
        name: g.name,
        kind: g.kind,
        creditsTotal: g.credits_total,
        creditsTotalMin: g.credits_total_min,
        officialNotes: g.official_notes,
        courses: g.rows.map((r) => r.code).sort(),
      }))
      .sort((a, b) => (a.name < b.name ? -1 : 1));
    expect(groups.every((g) => /^[0-9a-f-]{36}$/.test(g.id))).toBe(true);
    expect(groups.map(({ id: _, ...g }) => ({ ...g, courses: g.courses.map((c) => c.code) }))).toEqual(expected);

    const credits = Object.fromEntries(groups.flatMap((g) => g.courses.map((c) => [c.code, c.credits])));
    const printed = apcs2024.groups.flatMap((g) => g.rows);
    expect(Object.keys(credits).length).toBe(new Set(printed.map((r) => r.code)).size);
    // The catalog is shared: only decided values may differ from this PDF (apcs-catalog-decisions).
    const decided = new Set(CATALOG_DECISIONS.filter((d) => d.field === 'credits').map((d) => d.code));
    for (const row of printed) if (!decided.has(row.code)) expect(credits[row.code]).toBe(row.credits);
  });

  it('reads prerequisites and offering terms as not recorded (null), never as none, while F12 has stored none', async () => {
    // A CLC curriculum: no e2e file records rules for it, and no seed does (ADR 0011, amended 9 November 2026).
    const seed = CURRICULUM_SEEDS.find((s) => s.program.code !== 'APCS')!;
    const { body } = await get(`/api/programs/${seed.program.code}/curricula/${seed.curriculum.cohort_year}`).expect(200);
    const courses = (body.requirementGroups as Group[]).flatMap((g) => g.courses as unknown as { prerequisites: unknown; offeringTerms: unknown }[]);
    expect(courses.length).toBeGreaterThan(0);
    for (const course of courses) expect([course.prerequisites, course.offeringTerms]).toEqual([null, null]);
  });

  it('answers 404 for an unknown program, an unknown cohort or a malformed cohort', async () => {
    await get('/api/programs/ZZ-NOT-A-PROGRAM/curricula/2024').expect(404);
    await get('/api/programs/APCS/curricula/1999').expect(404);
    await get('/api/programs/APCS/curricula/twenty').expect(404);
  });

  it('returns a course with the groups that link to it, across cohorts', async () => {
    const code = apcs2024.groups.find((g) => g.name === 'Kiến thức Math')!.rows[0].code;
    const { body } = await get(`/api/courses/${code}`).expect(200);
    expect(body).toMatchObject({ code, credits: expect.any(Number) });
    const apcs = (body.memberships as { programCode: string; cohortYear: number; requirementGroupName: string }[]).filter((m) => m.programCode === 'APCS');
    expect(apcs).toContainEqual(expect.objectContaining({ cohortYear: 2024, curriculumCode: 'APCS2024', requirementGroupName: 'Kiến thức Math', kind: 'compulsory' }));
  });

  it('answers 404 for an unknown or malformed course code', async () => {
    await get('/api/courses/ZZ99999').expect(404);
    await get('/api/courses/csc10001').expect(404);
  });

  it('refuses every route without a token', async () => {
    for (const path of ['/api/programs', '/api/programs/APCS/curricula/2024', '/api/courses/ZZ99999']) {
      await http().get(path).expect(401);
    }
  });
});
