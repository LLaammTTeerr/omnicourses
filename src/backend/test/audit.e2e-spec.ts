import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CATALOG_DECISIONS, CURRICULUM_SEEDS } from '../src/curriculum/seeds/index.js';
import { seedCurricula } from '../src/curriculum/seed-curricula.js';
import { EXPECTED_NOT_CHECKED_CONDITIONS } from '../src/rules/testing/fixtures.js';
import { bootApp } from './support/app.js';
import { signedInUser } from './support/users.js';

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
  row('CS160', 4, 'graded', 8, 2024, 1),
  row('CM102', 4, 'graded', 7, 2024, 1),
  row('MTH251', 4, 'graded', 3, 2024, 1),
  row('PH211', 4, 'exempt', null, 2024, 1),
  row('BAA00030', 4, 'pass', null, 2024, 1),
  row('ZZ101', 3, 'graded', 8.5, 2024, 1),
  row('MTH251', 4, 'graded', 6.5, 2024, 2),
  row('BAA00021', 2, 'graded', 9, 2024, 2),
  row('CS251', 4, 'graded', 9, 2024, 2),
  row('CS252', 4, 'graded', 8, 2024, 2),
  row('CS163', 4, 'graded', 4, 2024, 2),
  row('CS311', 4, 'graded', 7, 2024, 3),
  row('CS320', 4, 'graded', 7, 2024, 3),
  row('CS350', 4, 'graded', 6, 2025, 1),
  row('CS420', 4, 'graded', 8, 2025, 1),
  row('MTH253', 4, 'graded', 7, 2025, 1),
  row('CS412', 4, 'in_progress', null, 2025, 2),
];

const halfUpTo2 = (numerator: number, denominator: number): number => Math.round((numerator * 100) / denominator) / 100;

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
        ['Kiến thức Computer Science (A): bắt buộc', 40, 4, 0, 0, 0, 36, false],
        ['Kiến thức Computer Science (A): tự chọn', 16, 24, 0, 0, 8, 0, true],
        ['Kiến thức Math', 16, 4, 0, 0, 0, 12, false],
        ['Kiến thức Non Computer Science', 26, 4, 0, 0, 0, 22, false],
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
      expect(audit.combinedMinimums).toEqual([
        expect.objectContaining({ name: 'Kiến thức tự chọn', creditsMin: 43, credits: 4 + 0 + 8, inProgressCredits: 4, remainingCredits: 43 - 12 - 4, met: false }),
      ]);
    });

    it('counts the credits', () => {
      expect(audit.credits).toEqual({ accumulated: 4 * 5 + 2 + 6 * 4 + 4, towardTotal: 50 - 4 - 2, inProgressTowardTotal: 4, totalRequired: 163, remaining: 119, yearLevel: 2 });
    });

    it('computes the averages (Điều 15)', () => {
      const passedGradePoints = (8 + 7 + 6.5 + 9 + 8 + 7 + 7 + 6 + 8 + 7) * 4;
      const fourPointGradePoints = (3.5 + 3 + 2.5 + 4 + 3.5 + 3 + 3 + 2.5 + 3.5 + 3) * 4;
      expect(audit.gpa).toEqual({
        average: halfUpTo2(passedGradePoints + 4 * 4, 44),
        accumulatedAverage: halfUpTo2(passedGradePoints, 40),
        accumulatedAverageFourPoint: halfUpTo2(fourPointGradePoints, 40),
        classification: 'good',
        gradedCredits: 40,
      });
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
        ['2024-1', 'main', 23, 19, (8 * 4 + 7 * 4 + 3 * 4) / 12, (32 + 28) / 8, (32 + 28) / 8, ['MTH251'], [], ['above_maximum 23/22']],
        ['2024-2', 'main', 18, 14, halfUpTo2(26 + 36 + 32 + 16, 16), halfUpTo2(26 + 36 + 32, 12), halfUpTo2(154, 20), ['CS163'], [], []],
        ['2024-3', 'main', 8, 8, 7, 7, halfUpTo2(210, 28), [], [], ['below_minimum 8/10']],
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
      expect(audit.graduation.notChecked).toEqual(EXPECTED_NOT_CHECKED_CONDITIONS);
    });
  });

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
        ['Kiến thức Computer Science (A): bắt buộc', 40, 40, 0, 0, true],
        ['Kiến thức Computer Science (A): tự chọn', 16, 16, 0, 0, true],
        ['Kiến thức Math', 16, 16, 0, 0, true],
        ['Kiến thức Non Computer Science', 26, 26, 0, 0, true],
        ['Kiến thức Physics', 12, 12, 0, 0, true],
        ['Kiến thức tốt nghiệp', 10, 10, 0, 0, true],
        ['Tự chọn Computer Science (C)', null, 36, 0, null, true],
        ['Tự chọn Math (B)', 8, 8, 0, 0, true],
      ]);
      const courses = (audit.groups as { courses: { code: string; status: string }[] }[]).flatMap((g) => g.courses);
      expect(courses.filter((c) => ['BAA00021', 'BAA00022', 'BAA00030'].includes(c.code)).map((c) => c.status)).toEqual(['passed', 'passed', 'passed']);
      expect(audit.combinedMinimums).toEqual([expect.objectContaining({ name: 'Kiến thức tự chọn', creditsMin: 43, credits: 8 + 36, remainingCredits: 0, met: true })]);
    });

    it('counts 164 credits toward the 163', () => {
      expect(audit.credits).toEqual({ accumulated: 164 + 2 + 2 + 4, towardTotal: 40 + 16 + 26 + 16 + 12 + 10 + 36 + 8, inProgressTowardTotal: 0, totalRequired: 163, remaining: 0, yearLevel: 4 });
    });

    it('computes the averages from the 42 graded courses (Điều 15)', () => {
      expect(audit.gpa).toEqual({ average: halfUpTo2(1274, 164), accumulatedAverage: halfUpTo2(1274, 164), accumulatedAverageFourPoint: halfUpTo2(540.5, 164), classification: 'good', gradedCredits: 164 });
    });

    it('keeps every term within the APCS caps', () => {
      const terms = (audit.terms as Record<string, any>[]).map((t) => [`${t.term.year}-${t.term.number}`, t.credits, t.average, t.cumulativeAccumulatedAverage, t.capViolations.length]);
      expect(terms).toEqual([
        ['2024-1', 20, 7.38, 7.38, 0],
        ['2024-2', 15, 7.2, 7.29, 0],
        ['2024-3', 15, 7.4, 7.33, 0],
        ['2025-1', 18, 8.13, 7.53, 0],
        ['2025-2', 18, 7.25, 7.47, 0],
        ['2025-3', 16, 8, 7.56, 0],
        ['2026-1', 18, 7.61, 7.57, 0],
        ['2026-2', 10, 7.8, 7.59, 0],
        ['2026-3', 12, 8.33, 7.66, 0],
        ['2027-1', 10, 7.8, 7.67, 0],
        ['2027-2', 10, 8, 7.69, 0],
        ['2027-3', 10, 9, 7.77, 0],
      ]);
    });

    it('is done, with the conditions it cannot check still listed, and no warning', () => {
      expect(audit.graduation.status).toBe('done');
      expect(audit.graduation.unmet).toEqual([]);
      expect(audit.graduation.notChecked).toEqual(EXPECTED_NOT_CHECKED_CONDITIONS);
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

  describe('as it stood at the end of a term (UC-03 A2)', () => {
    let auth: Record<string, string>;
    let today: Record<string, any>;

    beforeAll(async () => {
      ({ auth } = await student());
      today = (await http().get('/api/users/me/audit').set(auth).expect(200)).body;
    });

    it('lists every sitting of each term, with credits and the change of the average to date', () => {
      const first = today.terms[0];
      expect(first.attempts.map((a: Record<string, any>) => [a.code, a.credits, a.result, a.grade, a.passed, a.requirementGroupId === null])).toEqual([
        ['BAA00030', 4, 'pass', null, true, false],
        ['CM102', 4, 'graded', 7, true, false],
        ['CS160', 4, 'graded', 8, true, false],
        ['MTH251', 4, 'graded', 3, false, false],
        ['PH211', 4, 'exempt', null, true, false],
        ['ZZ101', 3, 'graded', 8.5, true, true],
      ]);
      expect(today.terms.at(-1).attempts).toEqual([expect.objectContaining({ code: 'CS412', inProgress: true, passed: false })]);
      expect(today.terms.map((t: Record<string, any>) => [t.cumulativeAccumulatedCredits, t.cumulativeTowardTotal])).toEqual([
        [16, 12],
        [30, 24],
        [38, 32],
        [50, 44],
        [50, 44],
      ]);
      expect(today.terms.map((t: Record<string, any>) => t.cumulativeAccumulatedAverageChange)).toEqual([
        null,
        ...today.terms.slice(1).map((t: Record<string, any>, i: number) => Math.round((t.cumulativeAccumulatedAverage - today.terms[i].cumulativeAccumulatedAverage) * 100) / 100),
      ]);
      expect(today.asOfTerm).toBeNull();
    });

    it('audits only the rows up to the term asked for', async () => {
      const { body } = await http().get('/api/users/me/audit').query({ asOfYear: 2024, asOfNumber: 1 }).set(auth).expect(200);
      expect(body.asOfTerm).toEqual({ year: 2024, number: 1 });
      expect(body.terms).toEqual(today.terms.slice(0, 1));
      expect(body.credits).toMatchObject({ accumulated: 16, towardTotal: 12, inProgressTowardTotal: 0 });
      expect(body.gpa.accumulatedAverage).toBe(today.terms[0].cumulativeAccumulatedAverage);
      expect(body.gpa.classification).toBe(today.terms[0].cumulativeClassification);
      expect(body.credits.yearLevel).toBe(today.terms[0].cumulativeYearLevel);
      const math = (body.groups as Record<string, any>[]).find((g) => g.name === 'Kiến thức Math')!;
      expect(math.courses.find((c: { code: string }) => c.code === 'MTH251')).toMatchObject({ status: 'failed', grade: 3 });
    });

    it('agrees with each term summary on the credits, the year level and the classification at its end', async () => {
      for (const t of today.terms as Record<string, any>[]) {
        const { body } = await http().get('/api/users/me/audit').query({ asOfYear: t.term.year, asOfNumber: t.term.number }).set(auth).expect(200);
        expect([body.credits.accumulated, body.credits.towardTotal, body.credits.yearLevel, body.gpa.accumulatedAverage, body.gpa.classification]).toEqual([
          t.cumulativeAccumulatedCredits,
          t.cumulativeTowardTotal,
          t.cumulativeYearLevel,
          t.cumulativeAccumulatedAverage,
          t.cumulativeClassification,
        ]);
      }
      expect(today.terms.map((t: Record<string, any>) => t.cumulativeYearLevel)).toEqual([1, 1, 2, 2, 2]);
    });

    it('gives the groups, combined minimums and remaining credits at the end of each term, as the audit of that term does', async () => {
      for (const t of today.terms as Record<string, any>[]) {
        const { body } = await http().get('/api/users/me/audit').query({ asOfYear: t.term.year, asOfNumber: t.term.number }).set(auth).expect(200);
        expect(t.cumulativeRemaining).toBe(body.credits.remaining);
        expect(t.cumulativeGroups).toEqual(
          (body.groups as Record<string, any>[]).map((g) => ({
            id: g.id,
            passedCredits: g.passedCredits,
            inProgressCredits: g.inProgressCredits,
            overflowInCredits: g.overflowInCredits,
            remainingCredits: g.remainingCredits,
            courses: (g.courses as Record<string, any>[]).map((c) => ({ code: c.code, credits: c.credits, status: c.status, grade: c.grade })),
          })),
        );
        expect(t.cumulativeCombinedMinimums).toEqual(
          (body.combinedMinimums as Record<string, any>[]).map((c) => ({ id: c.id, credits: c.credits, inProgressCredits: c.inProgressCredits, remainingCredits: c.remainingCredits })),
        );
      }
      const math = (today.terms[0].cumulativeGroups as Record<string, any>[]).find((g) => g.courses.some((c: { code: string }) => c.code === 'MTH251'))!;
      expect(math.courses.find((c: { code: string }) => c.code === 'MTH251')).toMatchObject({ status: 'failed', grade: 3 });
    });

    it('answers the whole audit for the last term, and with no term', async () => {
      const last = (await http().get('/api/users/me/audit').query({ asOfYear: 2025, asOfNumber: 2 }).set(auth).expect(200)).body;
      expect({ ...last, asOfTerm: null }).toEqual(today);
    });

    it.each([{ asOfYear: 2024 }, { asOfNumber: 1 }, { asOfYear: 2024, asOfNumber: 4 }, { asOfYear: 'x', asOfNumber: 1 }, { asOfYear: 1999, asOfNumber: 1 }])(
      'answers 400 for %o',
      async (query) => {
        await http().get('/api/users/me/audit').query(query).set(auth).expect(400);
      },
    );
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
