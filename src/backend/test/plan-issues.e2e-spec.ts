import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApp } from './support/app.js';
import { signedInUser } from './support/users.js';

// GET /api/plans/{id}/issues (ADR 0014) against PostgreSQL. A synthetic Tiên tiến curriculum
// (AGENTS.md hard rule 3), unique per run so reruns never collide. Expected values are worked out
// by hand in the comments, not read from the code under test.
const tag = randomBytes(3).toString('hex').toUpperCase();
const program = `ZZI${tag}`;
const code = (n: number) => `ZZI${tag}${n}`;

const course = (courseCode: string) => ({ kind: 'course', courseCode, requirementGroupId: null, credits: null });
const slot = (requirementGroupId: string, credits: number) => ({ kind: 'slot', courseCode: null, requirementGroupId, credits });
const brief = (issues: { code: string; courseCode: string | null; term: { year: number; number: number } | null }[]) =>
  issues.map((i) => [i.code, i.courseCode, i.term ? `${i.term.year}-${i.term.number}` : null].join(' '));

describe('Plan issues API (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let electives: string;
  const http = () => request(app.getHttpServer());

  async function student() {
    const { token } = await signedInUser(app);
    return { Authorization: `Bearer ${token}` };
  }

  async function newPlan(auth: Record<string, string>, terms: unknown[]) {
    return (await http().post('/api/plans').set(auth).send({ name: 'Main plan', programCode: program, cohortYear: 2030, terms }).expect(201)).body;
  }

  beforeAll(async () => {
    app = await bootApp();
    db = app.get(DataSource);
    // Tiên tiến: 10–22 credits in every term (ADR 0012). Total 16: Core 8 (1, 2) + Electives ≥ 8 (3, 4, 5). Course 6 is in no group.
    const [{ id: programId }] = await db.query(`INSERT INTO programs (code, name_vi, training_type) VALUES ($1, 'Chương trình thử', 'advanced') RETURNING id`, [program]);
    const [{ id: curriculumId }] = await db.query(
      `INSERT INTO curriculums (program_id, cohort_year, code, name_vi, total_credits_min) VALUES ($1, 2030, $2, 'CTĐT thử', 16) RETURNING id`,
      [programId, `${program}2030`],
    );
    for (const n of [1, 2, 3, 4, 5, 6]) await db.query(`INSERT INTO courses (code, name_vi, credits) VALUES ($1, 'Học phần thử', 4)`, [code(n)]);
    const group = async (name: string, kind: string, total: number | null, min: number | null, members: number[]) => {
      const [{ id }] = await db.query(
        `INSERT INTO requirement_groups (curriculum_id, name, kind, credits_total, credits_total_min) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [curriculumId, name, kind, total, min],
      );
      for (const n of members) await db.query(`INSERT INTO requirement_group_courses (requirement_group_id, course_code) VALUES ($1, $2)`, [id, code(n)]);
      return id as string;
    };
    await group('Core', 'compulsory', 8, null, [1, 2]);
    electives = await group('Electives', 'elective', null, 8, [3, 4, 5]);
    // Recorded: 1 has no prerequisite, 2 needs 1. Offered: 1 in term 1, 2 in term 2, 3 in every term. The rest is not recorded.
    for (const n of [1, 2]) await db.query(`INSERT INTO course_prerequisite_lists (curriculum_id, course_code) VALUES ($1, $2)`, [curriculumId, code(n)]);
    await db.query(`INSERT INTO course_prerequisites (curriculum_id, course_code, prerequisite_code) VALUES ($1, $2, $3)`, [curriculumId, code(2), code(1)]);
    for (const [n, t] of [[1, 1], [2, 2], [3, 1], [3, 2], [3, 3]]) {
      await db.query(`INSERT INTO course_offering_terms (curriculum_id, course_code, term_number) VALUES ($1, $2, $3)`, [curriculumId, code(n), t]);
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it("reports the owner's plan per term and placement, unrecorded data as unknown, and the coverage", async () => {
    const auth = await student();
    // Course 5 passed in 2029: placing it again is a grade improvement.
    const row = { courseCode: code(5), courseName: 'Synthetic', credits: 4, result: 'graded', grade: 7, term: { year: 2029, number: 1 } };
    await http().put('/api/users/me/transcript').set(auth).send({ rows: [row] }).expect(200);
    const plan = await newPlan(auth, [
      // 12 credits. 2 needs 1, placed in the same term, so not before; 2 is taught in term 2 only. 3's prerequisites are not recorded.
      { term: { year: 2030, number: 1 }, placements: [course(code(2)), course(code(1)), course(code(3))] },
      // 12 credits. 5 already passed; 4 and 5 have nothing recorded; 6 is in no group.
      { term: { year: 2030, number: 2 }, placements: [course(code(5)), course(code(4)), course(code(6))] },
    ]);

    const { body } = await http().get(`/api/plans/${plan.id}/issues`).set(auth).expect(200);
    expect(body.planId).toBe(plan.id);
    expect(body.trainingType).toBe('advanced');
    expect(body.terms).toEqual([
      { term: { year: 2030, number: 1 }, kind: 'main', credits: 12, caps: { min: 10, max: 22 } },
      { term: { year: 2030, number: 2 }, kind: 'main', credits: 12, caps: { min: 10, max: 22 } },
    ]);
    expect(brief(body.issues)).toEqual([
      `prerequisite_not_met ${code(2)} 2030-1`,
      `not_offered ${code(2)} 2030-1`,
      `prerequisites_not_recorded ${code(3)} 2030-1`,
      `already_passed ${code(5)} 2030-2`,
      `prerequisites_not_recorded ${code(5)} 2030-2`,
      `offering_terms_not_recorded ${code(5)} 2030-2`,
      `prerequisites_not_recorded ${code(4)} 2030-2`,
      `offering_terms_not_recorded ${code(4)} 2030-2`,
      `not_in_curriculum ${code(6)} 2030-2`,
      `prerequisites_not_recorded ${code(6)} 2030-2`,
      `offering_terms_not_recorded ${code(6)} 2030-2`,
    ]);
    expect(body.issues[0]).toMatchObject({ kind: 'violation', position: 0, missingCourseCodes: [code(1)], citation: 'QĐ 1175/QĐ-KHTN Điều 3.1.c' });
    expect(body.issues[1]).toMatchObject({ kind: 'violation', offeredTermNumbers: [2], citation: 'QĐ 1175/QĐ-KHTN Điều 6.5, 7.1.a' });
    expect(body.issues[2]).toMatchObject({ kind: 'unknown', position: 2 });
    expect(body.issues[3]).toMatchObject({ kind: 'flag', citation: 'QĐ 1175/QĐ-KHTN Điều 14.2' });
    // Core 1 + 2 = 8, met. Electives 3 + 4 + 5 = 12 ≥ 8. Total 8 + 12 = 20 ≥ 16; 6 counts toward nothing.
    expect(body.coverage).toMatchObject({ totalRequired: 16, totalCredits: 20, totalRemaining: 0, graduation: 'done' });
    expect(body.coverage.groups.map((g: { name: string; credits: number; met: boolean }) => [g.name, g.credits, g.met])).toEqual([
      ['Core', 8, true],
      ['Electives', 12, true],
    ]);
  });

  it('flags a term outside the Tiên tiến caps without refusing the plan, and reports what is left to cover', async () => {
    const auth = await student();
    const plan = await newPlan(auth, [
      // 4 credits, below 10.
      { term: { year: 2031, number: 1 }, placements: [course(code(1))] },
      // 2, 3, 4, 5, 6 and a 4-credit slot: 24 credits, above 22.
      { term: { year: 2031, number: 2 }, placements: [course(code(2)), course(code(3)), course(code(4)), course(code(5)), course(code(6)), slot(electives, 4)] },
    ]);
    const { body } = await http().get(`/api/plans/${plan.id}/issues`).set(auth).expect(200);
    expect(body.issues.filter((i: { code: string }) => i.code.startsWith('load_'))).toEqual([
      expect.objectContaining({ code: 'load_below_minimum', kind: 'flag', term: { year: 2031, number: 1 }, position: null, credits: 4, limit: 10, citation: 'QĐ 1175/QĐ-KHTN Điều 7.2' }),
      expect.objectContaining({ code: 'load_above_maximum', kind: 'flag', term: { year: 2031, number: 2 }, position: null, credits: 24, limit: 22, citation: 'QĐ 1175/QĐ-KHTN Điều 7.2' }),
    ]);
    expect(body.issues[0].message).toContain('petition');
    expect(body.issues.some((i: { code: string }) => i.code === 'requirement_not_covered')).toBe(false);

    // The same plan without the second term: Core still needs 2, Electives and the total are short.
    await http().put(`/api/plans/${plan.id}/placements`).set(auth).send({ terms: [{ term: { year: 2031, number: 1 }, placements: [course(code(1))] }] }).expect(200);
    const short = (await http().get(`/api/plans/${plan.id}/issues`).set(auth).expect(200)).body;
    expect(short.issues.filter((i: { code: string }) => i.code === 'requirement_not_covered')).toEqual([
      expect.objectContaining({ kind: 'violation', term: null, missingCourseCodes: [code(2)], credits: 4, limit: 8, citation: 'QĐ 1175/QĐ-KHTN Điều 17.3.b' }),
      expect.objectContaining({ requirementGroupId: electives, credits: 0, limit: 8 }),
      expect.objectContaining({ requirementGroupId: null, combinedMinimumId: null, credits: 4, limit: 16 }),
    ]);
    expect(short.coverage).toMatchObject({ totalCredits: 4, totalRemaining: 12, graduation: 'not_yet' });
  });

  it("answers 404 for another student's plan, as for a missing or malformed id, and 401 when signed out", async () => {
    const owner = await student();
    const plan = await newPlan(owner, [{ term: { year: 2030, number: 1 }, placements: [course(code(1))] }]);
    const stranger = await student();
    for (const id of [plan.id, randomUUID(), 'not-a-uuid']) {
      const res = await http().get(`/api/plans/${id}/issues`).set(stranger);
      expect([res.status, res.body.message, res.body.issues]).toEqual([404, 'No plan with this id', undefined]);
    }
    await http().get(`/api/plans/${plan.id}/issues`).expect(401);
    await http().get(`/api/plans/${plan.id}/issues`).set(owner).expect(200);
  });

  it('checks one drop on several terms in one request (the drag preview), in the order sent', async () => {
    const auth = await student();
    const plan = await newPlan(auth, [{ term: { year: 2032, number: 1 }, placements: [course(code(2))] }]);
    // 1 dropped on 2032-1 (taught there) and on 2032-2 (not taught there, and a term not saved yet).
    const targets = [{ year: 2032, number: 2 }, { year: 2032, number: 1 }];
    const { body } = await http().post(`/api/plans/${plan.id}/issues/drops`).set(auth).send({ terms: plan.terms, placement: course(code(1)), targets }).expect(200);
    expect(body.reports.map((r: { term: unknown }) => r.term)).toEqual(targets);
    const notOffered = (r: { issues: { issues: { code: string; courseCode: string | null }[] } }) => r.issues.issues.some((i) => i.code === 'not_offered' && i.courseCode === code(1));
    expect(body.reports.map(notOffered)).toEqual([true, false]);
    // 1 sits after 2 in 2032-1: the report's position for it is 1, as the planner draws the drop.
    expect(body.reports[1].issues.terms).toEqual([{ term: { year: 2032, number: 1 }, kind: 'main', credits: 8, caps: { min: 10, max: 22 } }]);
    // Nothing was saved.
    expect((await http().get(`/api/plans/${plan.id}`).set(auth).expect(200)).body.terms).toEqual(plan.terms);
    // A drop the board refuses (the course is already placed), a target twice, no target, another student's plan.
    const send = (body: unknown, as = auth) => http().post(`/api/plans/${plan.id}/issues/drops`).set(as).send(body);
    await send({ terms: plan.terms, placement: course(code(2)), targets }).expect(400);
    await send({ terms: plan.terms, placement: course(code(1)), targets: [targets[0], targets[0]] }).expect(400);
    await send({ terms: plan.terms, placement: course(code(1)), targets: [] }).expect(400);
    await send({ terms: plan.terms, placement: course('ZZNOSUCH1'), targets }).expect(400);
    await send({ terms: plan.terms, placement: course(code(1)), targets }, await student()).expect(404);
  });

  it('checks a board that is not saved (POST), without changing the saved plan', async () => {
    const auth = await student();
    // Saved: 1 in 2032-1, 4 credits. 1 is taught in term 1 only.
    const plan = await newPlan(auth, [{ term: { year: 2032, number: 1 }, placements: [course(code(1))] }]);
    // The preview: 1 moved to 2032-2, where it is not taught.
    const board = { terms: [{ term: { year: 2032, number: 2 }, placements: [course(code(1))] }] };
    const { body } = await http().post(`/api/plans/${plan.id}/issues`).set(auth).send(board).expect(200);
    expect(body.planId).toBe(plan.id);
    expect(body.terms).toEqual([{ term: { year: 2032, number: 2 }, kind: 'main', credits: 4, caps: { min: 10, max: 22 } }]);
    expect(body.issues.find((i: { code: string }) => i.code === 'not_offered')).toMatchObject({ courseCode: code(1), term: { year: 2032, number: 2 }, position: 0, offeredTermNumbers: [1] });

    // Nothing was saved: the plan and its own check still have 1 in 2032-1.
    const saved = (await http().get(`/api/plans/${plan.id}`).set(auth).expect(200)).body;
    expect(saved.terms.map((t: { term: { year: number; number: number } }) => `${t.term.year}-${t.term.number}`)).toEqual(['2032-1']);
    const own = (await http().get(`/api/plans/${plan.id}/issues`).set(auth).expect(200)).body;
    expect(own.issues.some((i: { code: string }) => i.code === 'not_offered')).toBe(false);

    // A board a save would refuse is refused here too; another student's plan is a 404.
    await http().post(`/api/plans/${plan.id}/issues`).set(auth).send({ terms: [{ term: { year: 2032, number: 1 }, placements: [course('ZZNOSUCH1')] }] }).expect(400);
    await http().post(`/api/plans/${plan.id}/issues`).set(await student()).send(board).expect(404);
    await http().post(`/api/plans/${plan.id}/issues`).send(board).expect(401);
  });
});
