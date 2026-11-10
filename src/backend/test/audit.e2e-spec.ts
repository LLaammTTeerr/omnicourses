import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CATALOG_DECISIONS, CURRICULUM_SEEDS } from '../src/database/seeds/index.js';
import { seedCurricula } from '../src/database/seeds/seed-curricula.js';
import { NOT_CHECKED_CONDITIONS } from '../src/rules/graduation.js';
import { bootApp } from './support/app.js';
import { signedInUser } from './support/users.js';

// F3 against the seeded APCS 2024 curriculum (ADR 0013). The transcript is synthetic (AGENTS.md
// hard rule 3): real course codes from the published curriculum, made-up grades. Every expected
// number is worked out by hand in the comments, not read from the code under test.

type Result = 'graded' | 'in_progress' | 'exempt' | 'pass' | 'fail';
const row = (courseCode: string, credits: number, result: Result, grade: number | null, year: number, number: 1 | 2 | 3) => ({
  courseCode,
  courseName: `Synthetic ${courseCode}`,
  credits,
  result,
  grade,
  term: { year, number },
});

const TRANSCRIPT = [
  // 2024-1: 23 credits, above the Tiên tiến maximum of 22. MTH251 failed, ZZ101 is in no group.
  row('CS160', 4, 'graded', 8, 2024, 1),
  row('CM102', 4, 'graded', 7, 2024, 1),
  row('MTH251', 4, 'graded', 3, 2024, 1),
  row('PH211', 4, 'exempt', null, 2024, 1),
  row('BAA00030', 4, 'pass', null, 2024, 1),
  row('ZZ101', 3, 'graded', 8.5, 2024, 1),
  // 2024-2: MTH251 retaken and passed; Thể dục 1 graded but outside the GPA and the total; CS163 failed.
  row('MTH251', 4, 'graded', 6.5, 2024, 2),
  row('BAA00021', 2, 'graded', 9, 2024, 2),
  row('CS251', 4, 'graded', 9, 2024, 2),
  row('CS252', 4, 'graded', 8, 2024, 2),
  row('CS163', 4, 'graded', 4, 2024, 2),
  // 2024-3, a main term in APCS: 8 credits, below the minimum of 10.
  row('CS311', 4, 'graded', 7, 2024, 3),
  row('CS320', 4, 'graded', 7, 2024, 3),
  // 2025-1: the last two (A) tự chọn courses (24 credits of (A) tự chọn in all), and one (B).
  row('CS350', 4, 'graded', 6, 2025, 1),
  row('CS420', 4, 'graded', 8, 2025, 1),
  row('MTH253', 4, 'graded', 7, 2025, 1),
  // 2025-2: one (C) course in progress.
  row('CS412', 4, 'in_progress', null, 2025, 2),
];

const ONBOARDED = { program: 'APCS', cohort: 2024, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: true };

describe('Degree audit API (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  const http = () => request(app.getHttpServer());

  async function student(onboarding: object | null = ONBOARDED, rows: object[] = TRANSCRIPT) {
    const { token, userId } = await signedInUser(app);
    const auth = { Authorization: `Bearer ${token}` };
    if (onboarding) await http().put('/api/users/me/onboarding').set(auth).send(onboarding).expect(200);
    if (rows.length) await http().put('/api/users/me/transcript').set(auth).send({ rows }).expect(200);
    return { auth, userId };
  }

  beforeAll(async () => {
    app = await bootApp();
    db = app.get(DataSource);
    await seedCurricula(db, CURRICULUM_SEEDS, CATALOG_DECISIONS);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('answers 401 without a token', async () => {
    await http().get('/api/users/me/audit').expect(401);
  });

  it('answers 409 onboarding_required before onboarding is finished', async () => {
    const fresh = await student(null, []);
    const { body } = await http().get('/api/users/me/audit').set(fresh.auth).expect(409);
    expect(body).toMatchObject({ statusCode: 409, code: 'onboarding_required' });

    const unfinished = await student({ ...ONBOARDED, finished: false });
    expect((await http().get('/api/users/me/audit').set(unfinished.auth).expect(409)).body.code).toBe('onboarding_required');
  });

  it('answers 409 curriculum_not_found when the cohort has no curriculum', async () => {
    const { auth, userId } = await student();
    await db.query(`UPDATE onboarding_answers SET cohort_year = 2023 WHERE user_id = $1`, [userId]);
    const { body } = await http().get('/api/users/me/audit').set(auth).expect(409);
    expect(body).toMatchObject({ statusCode: 409, code: 'curriculum_not_found' });
  });

  describe('a synthetic APCS 2024 student', () => {
    let audit: Record<string, any>;
    const group = (name: string) => (audit.groups as { name: string }[]).find((g) => g.name === name) as Record<string, any>;

    beforeAll(async () => {
      const { auth } = await student();
      audit = (await http().get('/api/users/me/audit').set(auth).expect(200)).body;
    });

    it('names the program, its training type and the curriculum', () => {
      expect(audit).toMatchObject({ programCode: 'APCS', trainingType: 'advanced', cohortYear: 2024, curriculumCode: 'APCS2024' });
    });

    it('covers every requirement group, with (A) tự chọn overflowing into (C)', () => {
      const rows = (audit.groups as Record<string, any>[]).map((g) => [
        g.name,
        g.requiredCredits,
        g.passedCredits,
        g.inProgressCredits,
        g.overflowInCredits,
        g.overflowOutCredits,
        g.remainingCredits,
        g.met,
      ]);
      expect(rows).toEqual([
        // name, required, passed, in progress, overflow in, overflow out, remaining, met
        ['Kiến thức Computer Science (A): bắt buộc', 40, 4, 0, 0, 0, 36, false],
        // CS251, CS252, CS311, CS320, CS350, CS420: 24 passed, 8 beyond the 16 required.
        ['Kiến thức Computer Science (A): tự chọn', 16, 24, 0, 0, 8, 0, true],
        ['Kiến thức Math', 16, 4, 0, 0, 0, 12, false],
        // CM102 only: Thể dục 1 and GDQP are passed but outside the 26.
        ['Kiến thức Non Computer Science', 26, 4, 0, 0, 0, 22, false],
        // PH211 exempt counts.
        ['Kiến thức Physics', 12, 4, 0, 0, 0, 8, false],
        ['Kiến thức tốt nghiệp', 10, 0, 0, 0, 0, 10, false],
        ['Tự chọn Computer Science (C)', null, 0, 4, 8, 0, null, true],
        ['Tự chọn Math (B)', 8, 4, 0, 0, 0, 4, false],
      ]);
      const statuses = (name: string) => Object.fromEntries((group(name).courses as { code: string; status: string }[]).map((c) => [c.code, c.status]));
      expect(statuses('Kiến thức Computer Science (A): bắt buộc')).toMatchObject({ CS160: 'passed', CS163: 'failed', CS201: 'not_taken' });
      expect(statuses('Kiến thức Non Computer Science')).toMatchObject({ BAA00021: 'passed', BAA00030: 'passed', BAA00022: 'not_taken' });
      expect(statuses('Tự chọn Computer Science (C)')).toMatchObject({ CS412: 'in_progress' });
      expect(group('Kiến thức Math').courses.find((c: { code: string }) => c.code === 'MTH251')).toMatchObject({ status: 'passed', grade: 6.5 });
      expect(group('Kiến thức Non Computer Science').courses.find((c: { code: string }) => c.code === 'BAA00021')).toMatchObject({
        countsTowardTotal: false,
        countsTowardGpa: false,
      });
    });

    it('adds (B) and (C) together, with the overflow from (A), against 43', () => {
      // (B) 4 + (C) 0 + 8 from (A) tự chọn = 12; CS412 in progress: 4; 43 − 12 − 4 = 27.
      expect(audit.combinedMinimums).toEqual([
        expect.objectContaining({ name: 'Kiến thức tự chọn', creditsMin: 43, credits: 12, inProgressCredits: 4, remainingCredits: 27, met: false }),
      ]);
    });

    it('counts the credits', () => {
      // Passed: CS160, CM102, MTH251, PH211, BAA00030 (4 each), BAA00021 (2), six (A) tự chọn (24), MTH253 (4) = 50.
      // Toward the 163: 50 − 4 (GDQP) − 2 (Thể dục 1) = 44.
      expect(audit.credits).toEqual({ accumulated: 50, towardTotal: 44, inProgressTowardTotal: 4, totalRequired: 163, remaining: 119, yearLevel: 2 });
    });

    it('computes the averages (Điều 15)', () => {
      // Passed graded courses, official grades × 4 credits:
      // CS160 8, CM102 7, MTH251 6.5 (the retake), CS251 9, CS252 8, CS311 7, CS320 7, CS350 6, CS420 8, MTH253 7
      // = 73.5 × 4 = 294 over 40 credits = 7.35. With CS163 (4 × 4 = 16): 310 / 44 = 7.045… → 7.05.
      // 4-point: 3.5 + 3 + 2.5 + 4 + 3.5 + 3 + 3 + 2.5 + 3.5 + 3 = 31.5 × 4 / 40 = 3.15.
      // Left out: PH211 (exempt), BAA00030 (pass), BAA00021 (Điều 15.1.c), ZZ101 (not in the curriculum).
      expect(audit.gpa).toEqual({ average: 7.05, accumulatedAverage: 7.35, accumulatedAverageFourPoint: 3.15, classification: 'good', gradedCredits: 40 });
    });

    it('summarises each term, with the APCS caps', () => {
      const terms = (audit.terms as Record<string, any>[]).map((t) => [
        `${t.term.year}-${t.term.number}`,
        t.kind,
        t.credits,
        t.passedCredits,
        t.average,
        t.accumulatedAverage,
        t.cumulativeAccumulatedAverage,
        t.failedCourseCodes,
        t.inProgressCourseCodes,
        t.capViolations.map((v: { rule: string; credits: number; limit: number }) => `${v.rule} ${v.credits}/${v.limit}`),
      ]);
      expect(terms).toEqual([
        // (8·4 + 7·4 + 3·4) / 12 = 6; passed only (32 + 28) / 8 = 7.5.
        ['2024-1', 'main', 23, 19, 6, 7.5, 7.5, ['MTH251'], [], ['above_maximum 23/22']],
        // (26 + 36 + 32 + 16) / 16 = 6.875 → 6.88; passed (26 + 36 + 32) / 12 = 7.83; from the start 154 / 20 = 7.7.
        ['2024-2', 'main', 18, 14, 6.88, 7.83, 7.7, ['CS163'], [], []],
        // Term 3 is a main term in a Tiên tiến program (ADR 0012). Cumulative 210 / 28 = 7.5.
        ['2024-3', 'main', 8, 8, 7, 7, 7.5, [], [], ['below_minimum 8/10']],
        ['2025-1', 'main', 12, 12, 7, 7, 7.35, [], [], []],
        ['2025-2', 'main', 4, 0, null, null, 7.35, [], ['CS412'], ['below_minimum 4/10']],
      ]);
      expect(audit.terms[0].caps).toEqual({ min: 10, max: 22 });
      expect(audit.terms[0].capViolations[0]).toMatchObject({ citation: 'QĐ 1175/QĐ-KHTN Điều 7.2' });
    });

    it('lists the course outside the curriculum as unmatched', () => {
      expect(audit.unmatchedCourses).toEqual([
        { code: 'ZZ101', name: 'Synthetic ZZ101', credits: 3, result: 'graded', grade: 8.5, passed: true, inProgress: false },
      ]);
      expect(audit.warnings.map((w: { code: string; courseCode: string }) => [w.code, w.courseCode])).toEqual([['not_in_curriculum', 'ZZ101']]);
    });

    it('is not done, names what is unmet, and lists what it cannot check', () => {
      expect(audit.graduation.status).toBe('not_yet');
      expect(audit.graduation.unmet.map((c: { description: string }) => c.description)).toEqual([
        'Requirement group "Kiến thức Computer Science (A): bắt buộc"',
        'Requirement group "Kiến thức Math"',
        'Requirement group "Kiến thức Non Computer Science"',
        'Requirement group "Kiến thức Physics"',
        'Requirement group "Kiến thức tốt nghiệp"',
        'Requirement group "Tự chọn Math (B)"',
        '"Kiến thức tự chọn": at least 43 credits across its groups',
        'At least 163 credits toward the cohort total',
      ]);
      expect(audit.graduation.notChecked).toEqual(NOT_CHECKED_CONDITIONS);
    });
  });

  // TC-B1-ACAD-01c (docs/test/test-cases-b1.md §6 item 13): a synthetic student who has passed every
  // requirement of APCS 2024. The file is the exact PUT /api/users/me/transcript body, so the manual run
  // on a server saves the same rows. Changing it means updating the checksum and values in §6 item 13.
  describe('the APCS 2024 completion fixture', () => {
    const file = readFileSync(join(__dirname, 'fixtures', 'apcs-2024-completion.json'));
    const fixture = JSON.parse(file.toString('utf8')) as { rows: object[] };
    let audit: Record<string, any>;

    beforeAll(async () => {
      const { auth } = await student(ONBOARDED, fixture.rows);
      audit = (await http().get('/api/users/me/audit').set(auth).expect(200)).body;
    });

    it('is the version the test cases record', () => {
      expect(createHash('sha256').update(file).digest('hex')).toBe('d0a0493f2fe62da8b070d853392100a9f47babac789f2c099ed69ccfdf3facde');
      expect(fixture.rows).toHaveLength(45);
    });

    it('meets every group and the combined minimum', () => {
      const rows = (audit.groups as Record<string, any>[]).map((g) => [g.name, g.requiredCredits, g.passedCredits, g.overflowOutCredits, g.remainingCredits, g.met]);
      expect(rows).toEqual([
        // name, required, passed, overflow out, remaining, met
        ['Kiến thức Computer Science (A): bắt buộc', 40, 40, 0, 0, true],
        // CS251, CS252, CS311, CS420: exactly 16, nothing overflows to (C).
        ['Kiến thức Computer Science (A): tự chọn', 16, 16, 0, 0, true],
        ['Kiến thức Math', 16, 16, 0, 0, true],
        // The 26 credits, plus Thể dục 1, Thể dục 2 and GDQP passed outside them.
        ['Kiến thức Non Computer Science', 26, 26, 0, 0, true],
        ['Kiến thức Physics', 12, 12, 0, 0, true],
        // CS468 Khóa luận tốt nghiệp, 10 credits.
        ['Kiến thức tốt nghiệp', 10, 10, 0, 0, true],
        // Nine courses of 4 credits.
        ['Tự chọn Computer Science (C)', null, 36, 0, null, true],
        // MTH253 and MTH346.
        ['Tự chọn Math (B)', 8, 8, 0, 0, true],
      ]);
      const courses = (audit.groups as { courses: { code: string; status: string }[] }[]).flatMap((g) => g.courses);
      expect(courses.filter((c) => ['BAA00021', 'BAA00022', 'BAA00030'].includes(c.code)).map((c) => c.status)).toEqual(['passed', 'passed', 'passed']);
      // (B) 8 + (C) 36 = 44 ≥ 43.
      expect(audit.combinedMinimums).toEqual([expect.objectContaining({ name: 'Kiến thức tự chọn', creditsMin: 43, credits: 44, remainingCredits: 0, met: true })]);
    });

    it('counts 164 credits toward the 163', () => {
      // 40 + 16 + 26 + 16 + 12 + 10 + 36 + 8 = 164; accumulated adds Thể dục 1 and 2 (2 each) and GDQP (4).
      expect(audit.credits).toEqual({ accumulated: 172, towardTotal: 164, inProgressTowardTotal: 0, totalRequired: 163, remaining: 0, yearLevel: 4 });
    });

    it('computes the averages from the 42 graded courses', () => {
      // Σ grade × credits = 1274 over 164 credits = 7.768… → 7.77; 4-point 540.5 / 164 = 3.295… → 3.30.
      // Every graded course is passed, so both averages are the same. The three `pass` rows enter neither.
      expect(audit.gpa).toEqual({ average: 7.77, accumulatedAverage: 7.77, accumulatedAverageFourPoint: 3.3, classification: 'good', gradedCredits: 164 });
    });

    it('keeps every term within the APCS caps', () => {
      const terms = (audit.terms as Record<string, any>[]).map((t) => [`${t.term.year}-${t.term.number}`, t.credits, t.average, t.cumulativeAccumulatedAverage, t.capViolations.length]);
      expect(terms).toEqual([
        // term, credits (Thể dục and GDQP included, Điều 7.1.b), average, cumulative, violations
        ['2024-1', 20, 7.38, 7.38, 0], // 118 / 16
        ['2024-2', 15, 7.2, 7.29, 0], // 108 / 15; 226 / 31
        ['2024-3', 15, 7.4, 7.33, 0], // 111 / 15; 337 / 46
        ['2025-1', 18, 8.13, 7.53, 0], // 130 / 16; 467 / 62
        ['2025-2', 18, 7.25, 7.47, 0], // 116 / 16; 583 / 78
        ['2025-3', 16, 8, 7.56, 0], // 128 / 16; 711 / 94
        ['2026-1', 18, 7.61, 7.57, 0], // 137 / 18; 848 / 112
        ['2026-2', 10, 7.8, 7.59, 0], // 78 / 10; 926 / 122
        ['2026-3', 12, 8.33, 7.66, 0], // 100 / 12; 1026 / 134
        ['2027-1', 10, 7.8, 7.67, 0], // 78 / 10; 1104 / 144
        ['2027-2', 10, 8, 7.69, 0], // 80 / 10; 1184 / 154
        ['2027-3', 10, 9, 7.77, 0], // 90 / 10; 1274 / 164
      ]);
    });

    it('is done, with the conditions it cannot check still listed, and no warning', () => {
      expect(audit.graduation.status).toBe('done');
      expect(audit.graduation.unmet).toEqual([]);
      expect(audit.graduation.notChecked).toEqual(NOT_CHECKED_CONDITIONS);
      expect(audit.unmatchedCourses).toEqual([]);
      expect(audit.warnings).toEqual([]);
    });
  });

  it('recomputes after a new transcript is saved, for that student only', async () => {
    const first = await student();
    const other = await student();
    await http()
      .put('/api/users/me/transcript')
      .set(first.auth)
      .send({ rows: [row('CS160', 4, 'graded', 10, 2024, 1)] })
      .expect(200);
    const mine = (await http().get('/api/users/me/audit').set(first.auth).expect(200)).body;
    expect(mine.credits).toMatchObject({ accumulated: 4, towardTotal: 4 });
    expect(mine.gpa).toMatchObject({ average: 10, classification: 'excellent' });
    const theirs = (await http().get('/api/users/me/audit').set(other.auth).expect(200)).body;
    expect(theirs.credits).toMatchObject({ accumulated: 50, towardTotal: 44 });
  });

  it('audits an empty transcript', async () => {
    const { auth } = await student(ONBOARDED, []);
    const { body } = await http().get('/api/users/me/audit').set(auth).expect(200);
    expect(body.credits).toEqual({ accumulated: 0, towardTotal: 0, inProgressTowardTotal: 0, totalRequired: 163, remaining: 163, yearLevel: 1 });
    expect(body.gpa.average).toBeNull();
    expect(body.terms).toEqual([]);
    expect(body.graduation.status).toBe('not_yet');
  });
});
