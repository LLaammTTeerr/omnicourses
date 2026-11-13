import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AccountPurgeService } from '../src/account/account-purge.service.js';
import { bootApp } from './support/app.js';
import { PASSWORD as password, signedInUser } from './support/users.js';

// Synthetic catalog and plans only (AGENTS.md hard rule 3), unique per run so reruns never collide.
const tag = randomBytes(3).toString('hex').toUpperCase();
const program = `ZZP${tag}`;
const code = (n: number) => `ZZ${tag}${String(n).padStart(2, '0')}`;
const PLAN_TABLES = ['plans', 'plan_placements'];

interface Catalog {
  /** The elective group of cohort 2030, and the one of cohort 2031 (another curriculum). */
  group2030: string;
  group2031: string;
}

const course = (courseCode: string) => ({ kind: 'course', courseCode, requirementGroupId: null, credits: null });
const slot = (requirementGroupId: string, credits: number) => ({ kind: 'slot', courseCode: null, requirementGroupId, credits });

describe('Plans API against PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let catalog: Catalog;
  const http = () => request(app.getHttpServer());

  async function student() {
    const { token, userId, email } = await signedInUser(app);
    const auth = { Authorization: `Bearer ${token}` };
    return { token, userId, email, auth };
  }

  const board = () => [
    { term: { year: 2030, number: 1 }, placements: [course(code(1)), course(code(2))] },
    { term: { year: 2030, number: 3 }, placements: [slot(catalog.group2030, 3), course(code(3))] },
  ];

  async function newPlan(auth: Record<string, string>, body: Record<string, unknown> = {}) {
    const res = await http().post('/api/plans').set(auth).send({ name: 'Main plan', programCode: program, cohortYear: 2030, ...body }).expect(201);
    return res.body;
  }

  beforeAll(async () => {
    app = await bootApp();
    db = app.get(DataSource);
    const [{ id: programId }] = await db.query(`INSERT INTO programs (code, name_vi) VALUES ($1, 'Chương trình thử') RETURNING id`, [program]);
    const curriculum = async (year: number) =>
      (await db.query(`INSERT INTO curriculums (program_id, cohort_year, code, name_vi) VALUES ($1, $2, $3, 'CTĐT thử') RETURNING id`, [programId, year, `${program}${year}`]))[0].id;
    const group = async (curriculumId: string) =>
      (await db.query(`INSERT INTO requirement_groups (curriculum_id, name, kind, credits_total_min) VALUES ($1, 'Electives', 'elective', 8) RETURNING id`, [curriculumId]))[0].id;
    catalog = { group2030: await group(await curriculum(2030)), group2031: await group(await curriculum(2031)) };
    for (const n of [1, 2, 3, 4]) await db.query(`INSERT INTO courses (code, name_vi, credits) VALUES ($1, 'Học phần thử', 4)`, [code(n)]);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('maps the two plan tables exactly as migration 1794218005469 creates them', async () => {
    const { upQueries } = await db.driver.createSchemaBuilder().log();
    const touching = upQueries.map((q) => q.query).filter((q) => PLAN_TABLES.some((t) => q.includes(`"${t}"`)));
    expect(touching).toEqual([]);
  });

  it('creates, lists, reads, fills and renames a plan', async () => {
    const { auth } = await student();
    expect((await http().get('/api/plans').set(auth).expect(200)).body).toEqual({ plans: [] });

    const created = await newPlan(auth);
    expect(created).toMatchObject({ name: 'Main plan', curriculum: { code: `${program}2030`, programCode: program, cohortYear: 2030 }, terms: [] });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);

    const filled = await http().put(`/api/plans/${created.id}/placements`).set(auth).send({ terms: [...board()].reverse() }).expect(200);
    expect(filled.body.terms).toEqual(board());
    expect(new Date(filled.body.updatedAt).getTime()).toBeGreaterThan(new Date(created.updatedAt).getTime());

    const renamed = await http().patch(`/api/plans/${created.id}`).set(auth).send({ name: '  Lighter load ' }).expect(200);
    expect(renamed.body).toMatchObject({ name: 'Lighter load', terms: board() });

    expect((await http().get(`/api/plans/${created.id}`).set(auth).expect(200)).body).toEqual(renamed.body);
    const { body } = await http().get('/api/plans').set(auth).expect(200);
    const { terms: _terms, ...summary } = renamed.body;
    const preview = { termCount: 2, courseCount: 3, slotCount: 1, firstTerm: { year: 2030, number: 1 }, lastTerm: { year: 2030, number: 3 } };
    expect(body).toEqual({ plans: [{ ...summary, preview }] });
  });

  it('creates a plan with its placements in one request (a generated plan, UC-07 step 10)', async () => {
    const { auth } = await student();
    const plan = await newPlan(auth, { terms: board() });
    expect(plan.terms).toEqual(board());
  });

  it('refuses a curriculum that does not exist and a bad name', async () => {
    const { auth } = await student();
    await http().post('/api/plans').set(auth).send({ name: 'x', programCode: program, cohortYear: 2099 }).expect(400);
    await http().post('/api/plans').set(auth).send({ name: '   ', programCode: program, cohortYear: 2030 }).expect(400);
    await http().post('/api/plans').set(auth).send({ name: 'x'.repeat(101), programCode: program, cohortYear: 2030 }).expect(400);
    expect((await http().get('/api/plans').set(auth).expect(200)).body.plans).toEqual([]);
  });

  it('replaces every placement at once, and a refused board changes nothing', async () => {
    const { auth } = await student();
    const plan = await newPlan(auth, { terms: board() });
    const put = (terms: unknown) => http().put(`/api/plans/${plan.id}/placements`).set(auth).send({ terms });

    const next = [{ term: { year: 2031, number: 2 }, placements: [course(code(4)), course(code(1))] }];
    expect((await put(next).expect(200)).body.terms).toEqual(next);

    const refused = [
      [{ term: { year: 2031, number: 1 }, placements: [course(code(2)), course('ZZNOSUCH99')] }], // not in the catalog
      [{ term: { year: 2031, number: 1 }, placements: [course(code(2)), course('csc10001')] }], // not a stored code
      [{ term: { year: 2031, number: 1 }, placements: [slot(catalog.group2031, 3)] }], // another curriculum's group
      [{ term: { year: 2031, number: 1 }, placements: [slot(randomUUID(), 3)] }], // no such group
      [{ term: { year: 2031, number: 1 }, placements: [course(code(2))] }, { term: { year: 2031, number: 2 }, placements: [course(code(2))] }], // placed twice
      [{ term: { year: 2031, number: 1 }, placements: [course(code(2))] }, { term: { year: 2031, number: 1 }, placements: [course(code(3))] }], // term twice
      [{ term: { year: 2031, number: 4 }, placements: [course(code(2))] }], // no term 4
      [{ term: { year: 2031, number: 1 }, placements: [] }], // empty term
      [{ term: { year: 2031, number: 1 }, placements: [{ ...course(code(2)), credits: 4 }] }], // credits on a course
      [{ term: { year: 2031, number: 1 }, placements: [{ ...slot(catalog.group2030, 3), courseCode: code(2) }] }], // a course on a slot
      [{ term: { year: 2031, number: 1 }, placements: [slot(catalog.group2030, 0)] }], // no credits
      [{ placements: [course(code(2))] }], // no term
    ];
    for (const terms of refused) await put(terms).expect(400);
    await http().put(`/api/plans/${plan.id}/placements`).set(auth).send({}).expect(400);

    const after = (await http().get(`/api/plans/${plan.id}`).set(auth).expect(200)).body;
    expect(after.terms).toEqual(next);
  });

  it('saves a plan while a row that references it is being inserted, and waits for another save of it before touching a placement', async () => {
    const { auth } = await student();
    const plan = await newPlan(auth, { terms: board() });
    const put = (terms: unknown) => http().put(`/api/plans/${plan.id}/placements`).set(auth).send({ terms });
    const other = db.createQueryRunner();
    await other.connect();
    try {
      const [{ pid }] = await other.query('SELECT pg_backend_pid() AS pid');
      // An insert that references the plan (a duplicate's rows, a share) holds a KEY SHARE lock on it.
      await other.startTransaction();
      await other.query('SELECT 1 FROM plans WHERE id = $1 FOR KEY SHARE', [plan.id]);
      expect((await put([]).expect(200)).body.terms).toEqual([]);
      await other.rollbackTransaction();

      // Another save of the plan holds it: this save waits before it touches a placement, so two
      // saves never interleave their rows.
      await put(board()).expect(200);
      await other.startTransaction();
      await other.query('SELECT 1 FROM plans WHERE id = $1 FOR NO KEY UPDATE', [plan.id]);
      const saving = put(board()).then((res) => res.status);
      await vi.waitFor(async () => {
        const [{ n }] = await db.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))', [pid]);
        expect(n).toBeGreaterThan(0);
      });
      await other.query('SELECT 1 FROM plan_placements WHERE plan_id = $1 FOR UPDATE NOWAIT', [plan.id]);
      await other.commitTransaction();
      expect(await saving).toBe(200);
    } finally {
      if (other.isTransactionActive) await other.rollbackTransaction();
      await other.release();
    }
    expect((await http().get(`/api/plans/${plan.id}`).set(auth).expect(200)).body.terms).toEqual(board());
  });

  it('empties a plan with an empty board', async () => {
    const { auth } = await student();
    const plan = await newPlan(auth, { terms: board() });
    expect((await http().put(`/api/plans/${plan.id}/placements`).set(auth).send({ terms: [] }).expect(200)).body.terms).toEqual([]);
  });

  it('keeps a placement owned by its plan’s student, even past the API', async () => {
    const owner = await student();
    const other = await student();
    const plan = await newPlan(owner.auth);
    await expect(
      db.query(`INSERT INTO plan_placements (plan_id, user_id, term_year, term_number, position, course_code) VALUES ($1, $2, 2030, 1, 0, $3)`, [plan.id, other.userId, code(1)]),
    ).rejects.toThrow(/plan_placements_plan_fkey/);
    await expect(
      db.query(`INSERT INTO plan_placements (plan_id, user_id, term_year, term_number, position, course_code, slot_credits) VALUES ($1, $2, 2030, 1, 0, $3, 3)`, [plan.id, owner.userId, code(1)]),
    ).rejects.toThrow(/ck_plan_placements_slot_credits/);
  });

  it('duplicates a plan into an independent copy', async () => {
    const { auth } = await student();
    const original = await newPlan(auth, { terms: board() });
    const copy = (await http().post(`/api/plans/${original.id}/duplicate`).set(auth).send({ name: 'What if' }).expect(201)).body;
    expect(copy.id).not.toBe(original.id);
    expect(copy).toMatchObject({ name: 'What if', curriculum: original.curriculum, terms: board() });

    const sameName = (await http().post(`/api/plans/${original.id}/duplicate`).set(auth).send({}).expect(201)).body;
    expect(sameName.name).toBe('Main plan');

    await http().put(`/api/plans/${copy.id}/placements`).set(auth).send({ terms: [] }).expect(200);
    expect((await http().get(`/api/plans/${original.id}`).set(auth).expect(200)).body.terms).toEqual(board());
    expect((await http().get('/api/plans').set(auth).expect(200)).body.plans.map((p: { id: string }) => p.id)).toEqual([original.id, copy.id, sameName.id]);
  });

  it('deletes a plan with its placements', async () => {
    const { auth } = await student();
    const plan = await newPlan(auth, { terms: board() });
    const kept = await newPlan(auth, { name: 'Kept' });
    await http().delete(`/api/plans/${plan.id}`).set(auth).expect(204);
    await http().get(`/api/plans/${plan.id}`).set(auth).expect(404);
    await http().delete(`/api/plans/${plan.id}`).set(auth).expect(404);
    expect(await db.query('SELECT 1 FROM plan_placements WHERE plan_id = $1', [plan.id])).toEqual([]);
    expect((await http().get('/api/plans').set(auth).expect(200)).body.plans.map((p: { id: string }) => p.id)).toEqual([kept.id]);
  });

  it("answers 404 for another student's plan, as for one that does not exist, and changes nothing", async () => {
    const owner = await student();
    const plan = await newPlan(owner.auth, { terms: board() });
    const intruder = await student();
    const missing = randomUUID();
    for (const id of [plan.id, missing, 'not-a-uuid']) {
      const answers = [
        await http().get(`/api/plans/${id}`).set(intruder.auth),
        await http().patch(`/api/plans/${id}`).set(intruder.auth).send({ name: 'Mine now' }),
        await http().put(`/api/plans/${id}/placements`).set(intruder.auth).send({ terms: [] }),
        await http().post(`/api/plans/${id}/duplicate`).set(intruder.auth).send({}),
        await http().delete(`/api/plans/${id}`).set(intruder.auth),
      ];
      for (const res of answers) expect([res.status, res.body.message]).toEqual([404, 'No plan with this id']);
    }
    expect((await http().get('/api/plans').set(intruder.auth).expect(200)).body.plans).toEqual([]);
    expect((await http().get(`/api/plans/${plan.id}`).set(owner.auth).expect(200)).body).toMatchObject({ name: 'Main plan', terms: board() });
  });

  it('answers 401 to a signed-out request', async () => {
    const id = randomUUID();
    await http().get('/api/plans').expect(401);
    await http().post('/api/plans').send({ name: 'x', programCode: program, cohortYear: 2030 }).expect(401);
    await http().get(`/api/plans/${id}`).expect(401);
    await http().patch(`/api/plans/${id}`).send({ name: 'x' }).expect(401);
    await http().put(`/api/plans/${id}/placements`).send({ terms: [] }).expect(401);
    await http().post(`/api/plans/${id}/duplicate`).send({}).expect(401);
    await http().delete(`/api/plans/${id}`).expect(401);
  });

  it('exports the plans with the account and purges them with it (ADR 0004)', async () => {
    const { auth, userId } = await student();
    const plan = await newPlan(auth, { terms: board() });

    const { body } = await http().get('/api/users/me/export').set(auth).expect(200);
    expect(body.tables.plans).toEqual([expect.objectContaining({ id: plan.id, user_id: userId, name: 'Main plan' })]);
    expect(body.tables.plan_placements).toHaveLength(4);
    expect(body.tables.plan_placements.every((p: { plan_id: string; user_id: string }) => p.plan_id === plan.id && p.user_id === userId)).toBe(true);

    await http().delete('/api/users/me').set(auth).send({ password }).expect(202);
    await db.query(`UPDATE users SET purge_after = now() - interval '1 minute' WHERE id = $1`, [userId]);
    await app.get(AccountPurgeService, { strict: false }).purge();
    expect(await db.query('SELECT 1 FROM plans WHERE user_id = $1', [userId])).toEqual([]);
    expect(await db.query('SELECT 1 FROM plan_placements WHERE user_id = $1', [userId])).toEqual([]);
  });

  it('keeps a curriculum and a requirement group that a plan uses from being deleted (ADR 0011)', async () => {
    const { auth } = await student();
    await newPlan(auth, { terms: board() });
    await expect(db.query('DELETE FROM requirement_groups WHERE id = $1', [catalog.group2030])).rejects.toThrow(/plan_placements_requirement_group_id_fkey/);
    await expect(db.query('DELETE FROM curriculums WHERE code = $1', [`${program}2030`])).rejects.toThrow(/plans_curriculum_id_fkey|plan_placements_requirement_group_id_fkey/);
  });
});
