import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AccountPurgeService } from '../src/account/account-purge.service.js';
import { TranscriptService } from '../src/transcript/transcript.service.js';
import { bootApp } from './support/app.js';
import { offerAlso } from './support/offer.js';
import { PASSWORD as password, signedInUser } from './support/users.js';

const tag = randomBytes(3).toString('hex').toUpperCase();
const program = `ZZS${tag}`;
const code = (n: number) => `ZZS${tag}${n}`;

const course = (courseCode: string) => ({ kind: 'course', courseCode, requirementGroupId: null, credits: null });
const slot = (requirementGroupId: string, credits: number) => ({ kind: 'slot', courseCode: null, requirementGroupId, credits });

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const NOT_SHARED = { statusCode: 404, message: 'This plan is not shared', error: 'Not Found' };
const KEYS = {
  plan: ['curriculum', 'issueCodesNotShown', 'issues', 'name', 'ownerName', 'terms', 'updatedAt'],
  curriculum: ['code', 'cohortYear', 'nameEn', 'nameVi', 'program'],
  program: ['code', 'nameEn', 'nameVi'],
  term: ['caps', 'credits', 'kind', 'placements', 'term'],
  placement: ['courseCode', 'credits', 'kind', 'nameEn', 'nameVi', 'requirementGroupName'],
  issue: ['citation', 'code', 'courseCode', 'credits', 'kind', 'limit', 'message', 'offeredTermNumbers', 'position', 'term'],
};
const keys = (value: object) => Object.keys(value).sort();

describe('Plan sharing API (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let curriculumId: string;
  let core: string;
  let electives: string;
  const http = () => request(app.getHttpServer());

  async function student() {
    const { token, userId, email } = await signedInUser(app);
    return { userId, email, auth: { Authorization: `Bearer ${token}` } };
  }

  const board = () => [
    { term: { year: 2030, number: 1 }, placements: [course(code(2)), course(code(1)), course(code(3))] },
    { term: { year: 2030, number: 2 }, placements: [course(code(5)), slot(electives, 3), course(code(6))] },
  ];

  async function newPlan(auth: Record<string, string>, body: Record<string, unknown> = {}) {
    return (await http().post('/api/plans').set(auth).send({ name: 'Main plan', programCode: program, cohortYear: 2030, terms: board(), ...body }).expect(201)).body;
  }

  async function share(auth: Record<string, string>, planId: string, body: Record<string, unknown> = {}): Promise<string> {
    const res = await http().put(`/api/plans/${planId}/share`).set(auth).send(body).expect(200);
    expect(res.body.token).toMatch(TOKEN);
    return res.body.token;
  }

  const read = (token: string) => http().get(`/api/shared-plans/${token}`);

  async function expectDead(token: string, why: string) {
    const res = await read(token);
    expect([res.status, res.body], why).toEqual([404, NOT_SHARED]);
    expect(res.headers['x-robots-tag'], why).toBe('noindex, nofollow');
    expect(res.headers['cache-control'], why).toBe('no-store');
  }

  beforeAll(async () => {
    app = await bootApp();
    offerAlso(app, program, [2030]);
    db = app.get(DataSource);
    const [{ id: programId }] = await db.query(`INSERT INTO programs (code, name_vi, name_en, training_type) VALUES ($1, 'Chương trình thử', 'Test program', 'advanced') RETURNING id`, [program]);
    [{ id: curriculumId }] = await db.query(
      `INSERT INTO curriculums (program_id, cohort_year, code, name_vi, total_credits_min) VALUES ($1, 2030, $2, 'CTĐT thử', 16) RETURNING id`,
      [programId, `${program}2030`],
    );
    for (const n of [1, 2, 3, 4, 5, 6]) await db.query(`INSERT INTO courses (code, name_vi, name_en, credits) VALUES ($1, $2, $3, 4)`, [code(n), `Học phần thử ${n}`, n === 1 ? 'Test course 1' : null]);
    const group = async (name: string, kind: string, total: number | null, min: number | null, members: number[]) => {
      const [{ id }] = await db.query(
        `INSERT INTO requirement_groups (curriculum_id, name, kind, credits_total, credits_total_min) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [curriculumId, name, kind, total, min],
      );
      for (const n of members) await db.query(`INSERT INTO requirement_group_courses (requirement_group_id, course_code) VALUES ($1, $2)`, [id, code(n)]);
      return id as string;
    };
    core = await group('Core', 'compulsory', 8, null, [1, 2]);
    electives = await group('Electives', 'elective', null, 8, [3, 4, 5]);
    for (const n of [1, 2]) await db.query(`INSERT INTO course_prerequisite_lists (curriculum_id, course_code) VALUES ($1, $2)`, [curriculumId, code(n)]);
    await db.query(`INSERT INTO course_prerequisites (curriculum_id, course_code, prerequisite_code) VALUES ($1, $2, $3)`, [curriculumId, code(2), code(1)]);
    for (const [n, t] of [[1, 1], [2, 2], [3, 1], [3, 2], [3, 3]]) {
      await db.query(`INSERT INTO course_offering_terms (curriculum_id, course_code, term_number) VALUES ($1, $2, $3)`, [curriculumId, code(n), t]);
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('maps plan_shares exactly as migration 1795564800000 creates it', async () => {
    const { upQueries } = await db.driver.createSchemaBuilder().log();
    expect(upQueries.map((q) => q.query).filter((q) => q.includes('"plan_shares"'))).toEqual([]);
  });

  describe('the owner and their link', () => {
    it('shares a plan with one live link, shows it again, and hides the name unless the owner chooses', async () => {
      const { auth } = await student();
      const plan = await newPlan(auth);
      expect((await http().get(`/api/plans/${plan.id}/share`).set(auth).expect(200)).body).toEqual({ share: null });

      const created = await http().put(`/api/plans/${plan.id}/share`).set(auth).send({}).expect(200);
      expect(keys(created.body)).toEqual(['createdAt', 'showName', 'showTranscriptChecks', 'token']);
      expect(created.body).toMatchObject({ token: expect.stringMatching(TOKEN), showName: false, showTranscriptChecks: false });
      expect(created.headers['cache-control']).toBe('no-store');
      expect((await read(created.body.token).expect(200)).body.ownerName).toBeNull();

      expect((await http().put(`/api/plans/${plan.id}/share`).set(auth).expect(200)).body).toEqual(created.body);

      const shown = await http().get(`/api/plans/${plan.id}/share`).set(auth).expect(200);
      expect(shown.body).toEqual({ share: created.body });
      expect(shown.headers['cache-control']).toBe('no-store');
      expect((await http().put(`/api/plans/${plan.id}/share`).set(auth).send({}).expect(200)).body).toEqual(created.body);

      const named = (await http().put(`/api/plans/${plan.id}/share`).set(auth).send({ showName: true }).expect(200)).body;
      expect(named).toEqual({ ...created.body, showName: true });
      expect((await read(created.body.token).expect(200)).body.ownerName).toBe('Test Student');

      expect((await http().put(`/api/plans/${plan.id}/share`).set(auth).send({}).expect(200)).body).toEqual(named);
      expect((await http().put(`/api/plans/${plan.id}/share`).set(auth).expect(200)).body).toEqual(named);
      expect((await read(created.body.token).expect(200)).body.ownerName).toBe('Test Student');
      expect((await http().put(`/api/plans/${plan.id}/share`).set(auth).send({ showName: false }).expect(200)).body).toEqual(created.body);
      expect((await read(created.body.token).expect(200)).body.ownerName).toBeNull();
      expect(await db.query('SELECT 1 FROM plan_shares WHERE plan_id = $1', [plan.id])).toHaveLength(1);
    });

    it('refuses a choice that is not a boolean, and shares nothing', async () => {
      const { auth } = await student();
      const plan = await newPlan(auth);
      await http().put(`/api/plans/${plan.id}/share`).set(auth).send({ showName: 'yes' }).expect(400);
      for (const value of ['true', 1, 'yes', {}]) await http().put(`/api/plans/${plan.id}/share`).set(auth).send({ showTranscriptChecks: value }).expect(400);
      await http().put(`/api/plans/${plan.id}/share`).set(auth).send({ showName: true, showTranscriptChecks: 'yes' }).expect(400);
      for (const body of [{ showName: null }, { showTranscriptChecks: null }, { showName: true, showTranscriptChecks: null }]) await http().put(`/api/plans/${plan.id}/share`).set(auth).send(body).expect(400);
      for (const body of [[], [{ showName: true }], [true]]) await http().put(`/api/plans/${plan.id}/share`).set(auth).send(body).expect(400);
      for (const raw of ['null', 'true', '"showName"', '{"showName":']) await http().put(`/api/plans/${plan.id}/share`).set(auth).set('Content-Type', 'application/json').send(raw).expect(400);
      expect((await http().get(`/api/plans/${plan.id}/share`).set(auth).expect(200)).body).toEqual({ share: null });
    });

    it('shares with no body at all and with an empty object, both with every choice off', async () => {
      const { auth } = await student();
      const noBody = await newPlan(auth);
      const created = (await http().put(`/api/plans/${noBody.id}/share`).set(auth).expect(200)).body;
      expect(created).toMatchObject({ token: expect.stringMatching(TOKEN), showName: false, showTranscriptChecks: false });
      const empty = await newPlan(auth, { name: 'Second plan' });
      expect((await http().put(`/api/plans/${empty.id}/share`).set(auth).send({}).expect(200)).body).toMatchObject({ token: expect.stringMatching(TOKEN), showName: false, showTranscriptChecks: false });
      const chosen = (await http().put(`/api/plans/${noBody.id}/share`).set(auth).send({ showName: true, showTranscriptChecks: true }).expect(200)).body;
      expect(chosen).toEqual({ ...created, showName: true, showTranscriptChecks: true });
      expect((await http().put(`/api/plans/${noBody.id}/share`).set(auth).expect(200)).body).toEqual(chosen);
      expect((await http().put(`/api/plans/${noBody.id}/share`).set(auth).send({}).expect(200)).body).toEqual(chosen);
    });

    it('gives two requests at once the same link', async () => {
      const { auth } = await student();
      const plan = await newPlan(auth);
      const answers = await Promise.all([1, 2, 3, 4].map(() => http().put(`/api/plans/${plan.id}/share`).set(auth).send({})));
      expect(answers.map((a) => a.status)).toEqual([200, 200, 200, 200]);
      expect(new Set(answers.map((a) => a.body.token)).size).toBe(1);
      expect(await db.query('SELECT 1 FROM plan_shares WHERE plan_id = $1', [plan.id])).toHaveLength(1);
    });

    it('keeps one link per plan, owned by the plan’s student, even past the API', async () => {
      const owner = await student();
      const other = await student();
      const plan = await newPlan(owner.auth);
      const token = () => randomBytes(32).toString('base64url');
      const insert = (userId: string, shareToken: string) => db.query('INSERT INTO plan_shares (plan_id, user_id, share_token) VALUES ($1, $2, $3)', [plan.id, userId, shareToken]);
      await expect(insert(other.userId, token())).rejects.toThrow(/plan_shares_plan_fkey/);
      await expect(insert(owner.userId, 'short')).rejects.toThrow(/ck_plan_shares_share_token/);
      await insert(owner.userId, token());
      await expect(insert(owner.userId, token())).rejects.toThrow(/uq_plan_shares_plan_id/);
    });

    it("answers 404 for a share of another student's plan, as for a plan that does not exist, and changes nothing", async () => {
      const owner = await student();
      const plan = await newPlan(owner.auth);
      const token = await share(owner.auth, plan.id);
      const unshared = await newPlan(owner.auth, { name: 'Not shared' });
      const intruder = await student();
      const before = (await read(token).expect(200)).body;

      for (const id of [plan.id, unshared.id, randomUUID(), 'not-a-uuid']) {
        const answers = [
          await http().get(`/api/plans/${id}/share`).set(intruder.auth),
          await http().put(`/api/plans/${id}/share`).set(intruder.auth).send({ showName: true }),
          await http().delete(`/api/plans/${id}/share`).set(intruder.auth),
        ];
        for (const res of answers) {
          expect([res.status, res.body.message]).toEqual([404, 'No plan with this id']);
          expect(JSON.stringify(res.body)).not.toContain(token);
        }
      }
      expect((await http().get(`/api/plans/${plan.id}/share`).set(owner.auth).expect(200)).body.share).toMatchObject({ token, showName: false });
      expect((await read(token).expect(200)).body).toEqual(before);
      expect(await db.query('SELECT 1 FROM plan_shares WHERE plan_id = $1', [unshared.id])).toEqual([]);
      expect(await db.query('SELECT 1 FROM plan_shares WHERE user_id = $1', [intruder.userId])).toEqual([]);
    });

    it('answers 401 to a signed-out request for the owner routes', async () => {
      const { auth } = await student();
      const plan = await newPlan(auth);
      await http().get(`/api/plans/${plan.id}/share`).expect(401);
      await http().put(`/api/plans/${plan.id}/share`).send({}).expect(401);
      await http().delete(`/api/plans/${plan.id}/share`).expect(401);
      expect(await db.query('SELECT 1 FROM plan_shares WHERE plan_id = $1', [plan.id])).toEqual([]);
    });
  });

  describe('what a signed-out reader gets', () => {
    it('shows the plan read-only with exactly the allowed fields, and tells search engines and caches to keep nothing', async () => {
      const owner = await student();
      const plan = await newPlan(owner.auth);
      const other = await newPlan(owner.auth, { name: 'My other secret plan', terms: [] });
      const row = { courseCode: code(5), courseName: 'Transcript wording', credits: 4, result: 'graded', grade: 8.6, term: { year: 2029, number: 1 } };
      await http().put('/api/users/me/transcript').set(owner.auth).send({ rows: [row] }).expect(200);
      const token = await share(owner.auth, plan.id);

      const res = await read(token).expect(200);
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect(res.headers['cache-control']).toBe('no-store');
      const body = res.body;

      expect(keys(body)).toEqual(KEYS.plan);
      expect(keys(body.curriculum)).toEqual(KEYS.curriculum);
      expect(keys(body.curriculum.program)).toEqual(KEYS.program);
      for (const t of body.terms) {
        expect(keys(t)).toEqual(KEYS.term);
        expect(keys(t.term)).toEqual(['number', 'year']);
        for (const p of t.placements) expect(keys(p)).toEqual(KEYS.placement);
      }
      expect(body.issues.length).toBeGreaterThan(0);
      for (const i of body.issues) expect(keys(i)).toEqual(KEYS.issue);

      const saved = (await http().get(`/api/plans/${plan.id}`).set(owner.auth).expect(200)).body;
      expect(body).toMatchObject({
        name: 'Main plan',
        ownerName: null,
        curriculum: { code: `${program}2030`, cohortYear: 2030, nameVi: 'CTĐT thử', nameEn: null, program: { code: program, nameVi: 'Chương trình thử', nameEn: 'Test program' } },
        updatedAt: saved.updatedAt,
        issueCodesNotShown: ['prerequisite_not_met', 'already_passed', 'already_in_progress', 'requirement_not_covered'],
      });
      const tile = (n: number) => ({ kind: 'course', courseCode: code(n), nameVi: `Học phần thử ${n}`, nameEn: n === 1 ? 'Test course 1' : null, credits: 4, requirementGroupName: null });
      expect(body.terms).toEqual([
        { term: { year: 2030, number: 1 }, kind: 'main', credits: 12, caps: { min: 10, max: 22 }, placements: [tile(2), tile(1), tile(3)] },
        {
          term: { year: 2030, number: 2 },
          kind: 'main',
          credits: 11,
          caps: { min: 10, max: 22 },
          placements: [tile(5), { kind: 'slot', courseCode: null, nameVi: null, nameEn: null, credits: 3, requirementGroupName: 'Electives' }, tile(6)],
        },
      ]);

      const textWithoutUpdatedAt = JSON.stringify({ ...body, updatedAt: null });
      const forbidden = [owner.userId, owner.email, 'Test Student', plan.id, other.id, 'My other secret plan', 'Transcript wording', '8.6', curriculumId, electives, 'password', 'email', 'grade', 'transcript'];
      for (const value of forbidden) expect(textWithoutUpdatedAt, value).not.toContain(value);
    });

    it("shows the rule engine's issues of the plan as the owner sees them, without the ones the transcript decides", async () => {
      const owner = await student();
      const plan = await newPlan(owner.auth);
      const token = await share(owner.auth, plan.id);
      const own = (await http().get(`/api/plans/${plan.id}/issues`).set(owner.auth).expect(200)).body;
      const { body } = await read(token).expect(200);

      const hidden = ['prerequisite_not_met', 'already_passed', 'already_in_progress', 'requirement_not_covered'];
      expect(own.issues.map((i: { code: string }) => i.code)).toEqual(expect.arrayContaining(['prerequisite_not_met', 'not_offered', 'not_in_curriculum']));
      const expected = own.issues
        .filter((i: { code: string }) => !hidden.includes(i.code))
        .map(({ requirementGroupId: _g, combinedMinimumId: _m, missingCourseCodes: _c, ...rest }: Record<string, unknown>) => rest);
      expect(body.issues).toEqual(expected);
      expect(body.issues.map((i: { code: string; courseCode: string | null }) => `${i.code} ${i.courseCode}`)).toEqual([
        `not_offered ${code(2)}`,
        `prerequisites_not_recorded ${code(3)}`,
        `prerequisites_not_recorded ${code(5)}`,
        `offering_terms_not_recorded ${code(5)}`,
        `not_in_curriculum ${code(6)}`,
        `prerequisites_not_recorded ${code(6)}`,
        `offering_terms_not_recorded ${code(6)}`,
      ]);
      expect(body.issues[0]).toMatchObject({ kind: 'violation', term: { year: 2030, number: 1 }, position: 0, offeredTermNumbers: [2], citation: 'QĐ 1175/QĐ-KHTN Điều 6.5, 7.1.a' });
      expect(body.terms.map(({ term, kind, credits, caps }: Record<string, unknown>) => ({ term, kind, credits, caps }))).toEqual(own.terms);
    });

    it('gives the same answer whatever the owner’s transcript holds', async () => {
      const owner = await student();
      const plan = await newPlan(owner.auth);
      const token = await share(owner.auth, plan.id);
      const issuesOf = async () => (await http().get(`/api/plans/${plan.id}/issues`).set(owner.auth).expect(200)).body;
      const before = (await read(token).expect(200)).body;
      const ownBefore = await issuesOf();

      const row = (n: number, result: string, grade: number | null, year: number, number: number) => ({ courseCode: code(n), courseName: 'Transcript wording', credits: 4, result, grade, term: { year, number } });
      const rows = [
        row(1, 'graded', 8.6, 2029, 1),
        row(5, 'graded', 9.4, 2029, 1),
        row(3, 'in_progress', null, 2029, 3),
        row(4, 'graded', 2.6, 2029, 1),
        row(4, 'pass', null, 2029, 2),
        row(2, 'graded', 6.4, 2030, 1),
        row(6, 'fail', null, 2030, 2),
        row(4, 'graded', 9.9, 2031, 1),
      ];
      await http().put('/api/users/me/transcript').set(owner.auth).send({ rows }).expect(200);

      const ownAfter = await issuesOf();
      const codes = (r: { issues: { code: string }[] }) => r.issues.map((i) => i.code);
      expect(codes(ownBefore)).toContain('prerequisite_not_met');
      expect(codes(ownAfter)).not.toContain('prerequisite_not_met');
      expect(codes(ownAfter)).toEqual(expect.arrayContaining(['already_passed', 'already_in_progress']));
      expect(ownAfter.coverage).not.toEqual(ownBefore.coverage);

      const after = (await read(token).expect(200)).body;
      expect(after).toEqual(before);
      const textWithoutUpdatedAt = JSON.stringify({ ...after, updatedAt: null });
      for (const value of ['Transcript wording', '8.6', '9.4', '2.6', '6.4', '9.9', '"in_progress"', '"fail"', code(4)]) expect(textWithoutUpdatedAt, value).not.toContain(value);
    });

    it('shows an edit and a rename in the next read', async () => {
      const { auth } = await student();
      const plan = await newPlan(auth);
      const token = await share(auth, plan.id);
      const before = (await read(token).expect(200)).body;

      const next = [{ term: { year: 2031, number: 1 }, placements: [course(code(1)), course(code(4))] }];
      const saved = (await http().put(`/api/plans/${plan.id}/placements`).set(auth).send({ terms: next }).expect(200)).body;
      const edited = (await read(token).expect(200)).body;
      expect(edited.terms).toEqual([
        {
          term: { year: 2031, number: 1 },
          kind: 'main',
          credits: 8,
          caps: { min: 10, max: 22 },
          placements: [
            { kind: 'course', courseCode: code(1), nameVi: 'Học phần thử 1', nameEn: 'Test course 1', credits: 4, requirementGroupName: null },
            { kind: 'course', courseCode: code(4), nameVi: 'Học phần thử 4', nameEn: null, credits: 4, requirementGroupName: null },
          ],
        },
      ]);
      expect(edited.issues[0]).toMatchObject({ code: 'load_below_minimum', credits: 8, limit: 10 });
      expect(before.issues.some((i: { code: string }) => i.code === 'load_below_minimum')).toBe(false);
      expect(edited.updatedAt).toBe(saved.updatedAt);
      expect(new Date(edited.updatedAt).getTime()).toBeGreaterThan(new Date(before.updatedAt).getTime());

      const renamed = (await http().patch(`/api/plans/${plan.id}`).set(auth).send({ name: 'Lighter load' }).expect(200)).body;
      expect((await read(token).expect(200)).body).toMatchObject({ name: 'Lighter load', updatedAt: renamed.updatedAt });
    });

    it('opens whatever Authorization header is sent, and the same for another signed-in student', async () => {
      const owner = await student();
      const plan = await newPlan(owner.auth);
      const token = await share(owner.auth, plan.id);
      const { body } = await read(token).expect(200);
      const other = await student();
      expect((await read(token).set(other.auth).expect(200)).body).toEqual(body);
      expect((await read(token).set('Authorization', 'Bearer not-a-session').expect(200)).body).toEqual(body);
    });

    it('lets a reader change nothing', async () => {
      const { auth } = await student();
      const plan = await newPlan(auth);
      const token = await share(auth, plan.id);
      const before = (await read(token).expect(200)).body;
      const [rowBefore] = await db.query('SELECT * FROM plan_shares WHERE plan_id = $1', [plan.id]);
      for (const method of ['post', 'put', 'patch', 'delete'] as const) {
        const res = await http()[method](`/api/shared-plans/${token}`).send({ showName: true, name: 'Changed', terms: [] });
        expect([401, 404], method).toContain(res.status);
        expect(res.body.message, method).not.toBe(NOT_SHARED.message);
      }
      for (const method of ['get', 'put', 'delete'] as const) await http()[method](`/api/plans/${plan.id}/share`).set('Authorization', `Bearer ${token}`).expect(401);
      await http().put(`/api/plans/${plan.id}/placements`).set('Authorization', `Bearer ${token}`).send({ terms: [] }).expect(401);
      expect((await read(token).expect(200)).body).toEqual(before);
      expect(await db.query('SELECT * FROM plan_shares WHERE plan_id = $1', [plan.id])).toEqual([rowBefore]);
    });

    it('writes nothing when a link is read', async () => {
      const { auth, userId } = await student();
      const plan = await newPlan(auth);
      const token = await share(auth, plan.id);
      const snapshot = async () => ({
        plans: await db.query('SELECT * FROM plans WHERE user_id = $1', [userId]),
        placements: await db.query('SELECT * FROM plan_placements WHERE user_id = $1 ORDER BY id', [userId]),
        shares: await db.query('SELECT * FROM plan_shares WHERE user_id = $1', [userId]),
        user: await db.query('SELECT updated_at FROM users WHERE id = $1', [userId]),
      });
      const before = await snapshot();
      for (let i = 0; i < 3; i++) await read(token).expect(200);
      await expectDead(randomBytes(32).toString('base64url'), 'unknown');
      expect(await snapshot()).toEqual(before);
    });
  });

  describe('when the owner shows the checks that come from their transcript', () => {
    const checksBoard = () => [
      { term: { year: 2030, number: 1 }, placements: [course(code(2)), course(code(3))] },
      { term: { year: 2030, number: 2 }, placements: [course(code(5)), course(code(6))] },
    ];
    const row = (n: number, result: string, grade: number | null, year: number, number: number) => ({ courseCode: code(n), courseName: 'Transcript wording', credits: 4, result, grade, term: { year, number } });
    const transcript = [row(5, 'graded', 8.6, 2029, 1), row(3, 'in_progress', null, 2029, 3), row(4, 'graded', 2.6, 2029, 1)];
    const putShare = (auth: Record<string, string>, planId: string, body: Record<string, unknown>) => http().put(`/api/plans/${planId}/share`).set(auth).send(body).expect(200);

    it('shows a reader the same issues and coverage as the owner, with no grade, transcript row or id, and takes them away again', async () => {
      const owner = await student();
      await http().put('/api/users/me/transcript').set(owner.auth).send({ rows: transcript }).expect(200);
      const plan = await newPlan(owner.auth, { terms: checksBoard() });
      const token = await share(owner.auth, plan.id);
      const off = (await read(token).expect(200)).body;
      expect(keys(off)).toEqual(KEYS.plan);
      expect(off.issueCodesNotShown).toHaveLength(4);
      const ownReport = (await http().get(`/api/plans/${plan.id}/issues`).set(owner.auth).expect(200)).body;
      const planOnly = ownReport.issues
        .filter((i: { code: string }) => !off.issueCodesNotShown.includes(i.code))
        .map(({ requirementGroupId: _g, combinedMinimumId: _m, missingCourseCodes: _c, ...rest }: Record<string, unknown>) => rest);
      expect(planOnly.length).toBeGreaterThan(0);
      expect(off.issues).toEqual(planOnly);
      expect(off.terms.map(({ term, kind, credits, caps }: Record<string, unknown>) => ({ term, kind, credits, caps }))).toEqual(ownReport.terms);

      expect((await putShare(owner.auth, plan.id, { showTranscriptChecks: true })).body).toMatchObject({ token, showName: false, showTranscriptChecks: true });
      const own = (await http().get(`/api/plans/${plan.id}/issues`).set(owner.auth).expect(200)).body;
      const on = (await read(token).expect(200)).body;

      expect([...new Set(own.issues.map((i: { code: string }) => i.code))]).toEqual(expect.arrayContaining(['prerequisite_not_met', 'already_passed', 'already_in_progress', 'requirement_not_covered']));
      const groupNames = new Map<string, string>(own.coverage.groups.map((g: { id: string; name: string }) => [g.id, g.name]));
      const asReader = ({ requirementGroupId, combinedMinimumId, ...rest }: Record<string, unknown>) => {
        expect(combinedMinimumId).toBeNull();
        return { ...rest, requirementGroupName: requirementGroupId === null ? null : groupNames.get(requirementGroupId as string), combinedMinimumName: null };
      };
      expect(on.issues).toEqual(own.issues.map(asReader));
      expect(on.issueCodesNotShown).toEqual([]);
      const brief = (i: Record<string, unknown>) => [i.code, i.courseCode, i.requirementGroupName, i.missingCourseCodes, i.credits, i.limit];
      const transcriptIssues = on.issues.filter((i: { code: string }) => off.issueCodesNotShown.includes(i.code));
      expect(transcriptIssues.map(brief)).toEqual([
        ['prerequisite_not_met', code(2), null, [code(1)], null, null],
        ['already_in_progress', code(3), null, [], null, null],
        ['already_passed', code(5), null, [], null, null],
        ['requirement_not_covered', null, 'Core', [code(1)], 4, 8],
        ['requirement_not_covered', null, null, [], 12, 16],
      ]);
      for (const i of on.issues) if (i.term) expect(i.term.year).toBe(2030);

      const { groups, combinedMinimums, ...totals } = own.coverage;
      expect(on.coverage).toEqual({ ...totals, combinedMinimums, groups: groups.map(({ id: _id, ...rest }: { id: string }) => rest) });
      expect(on.coverage).toMatchObject({ totalRequired: 16, totalCredits: 12, totalRemaining: 4, graduation: 'not_yet', combinedMinimums: [] });
      expect(on.coverage.groups).toEqual([
        { name: 'Core', kind: 'compulsory', requiredCredits: 8, credits: 4, remainingCredits: 4, met: false },
        { name: 'Electives', kind: 'elective', requiredCredits: 8, credits: 8, remainingCredits: 0, met: true },
      ]);

      expect(keys(on)).toEqual([...KEYS.plan, 'coverage'].sort());
      expect(keys(on.curriculum)).toEqual(KEYS.curriculum);
      expect(keys(on.curriculum.program)).toEqual(KEYS.program);
      for (const t of on.terms) {
        expect(keys(t)).toEqual(KEYS.term);
        for (const p of t.placements) expect(keys(p)).toEqual(KEYS.placement);
      }
      for (const i of on.issues) expect(keys(i)).toEqual([...KEYS.issue, 'combinedMinimumName', 'missingCourseCodes', 'requirementGroupName'].sort());
      expect(keys(on.coverage)).toEqual(['combinedMinimums', 'graduation', 'groups', 'totalCredits', 'totalRemaining', 'totalRequired']);
      for (const g of on.coverage.groups) expect(keys(g)).toEqual(['credits', 'kind', 'met', 'name', 'remainingCredits', 'requiredCredits']);
      const { coverage: _c, issues: _i, issueCodesNotShown: _n, ...rest } = on;
      const { issues: _oi, issueCodesNotShown: _on, ...offRest } = off;
      expect(rest).toEqual(offRest);

      const textWithoutUpdatedAt = JSON.stringify({ ...on, updatedAt: null });
      const forbidden = ['8.6', '2.6', code(4), 'Transcript wording', '"grade"', '"result"', '"courseName"', '"graded"', '"in_progress"', owner.userId, owner.email, 'Test Student', plan.id, curriculumId, core, electives, '"id"', 'Id"', 'password', 'email'];
      for (const value of forbidden) expect(textWithoutUpdatedAt, value).not.toContain(value);

      expect((await putShare(owner.auth, plan.id, { showName: true })).body).toMatchObject({ token, showName: true, showTranscriptChecks: true });
      expect((await putShare(owner.auth, plan.id, {})).body).toMatchObject({ token, showName: true, showTranscriptChecks: true });
      expect((await http().get(`/api/plans/${plan.id}/share`).set(owner.auth).expect(200)).body.share).toMatchObject({ token, showName: true, showTranscriptChecks: true });
      const named = (await read(token).expect(200)).body;
      expect(named).toEqual({ ...on, ownerName: 'Test Student' });

      expect((await putShare(owner.auth, plan.id, { showTranscriptChecks: false })).body).toMatchObject({ token, showName: true, showTranscriptChecks: false });
      expect((await read(token).expect(200)).body).toEqual({ ...off, ownerName: 'Test Student' });
      expect((await putShare(owner.auth, plan.id, { showName: false })).body).toMatchObject({ token, showName: false, showTranscriptChecks: false });
      expect((await read(token).expect(200)).body).toEqual(off);
      expect(await db.query('SELECT 1 FROM plan_shares WHERE plan_id = $1', [plan.id])).toHaveLength(1);
    });

    it('follows the transcript while the choice is on, and not while it is off', async () => {
      const owner = await student();
      const plan = await newPlan(owner.auth, { terms: checksBoard() });
      const token = await share(owner.auth, plan.id, { showTranscriptChecks: true });
      const codes = async () => (await read(token).expect(200)).body.issues.map((i: { code: string }) => i.code);
      expect(await codes()).not.toContain('already_passed');
      await http().put('/api/users/me/transcript').set(owner.auth).send({ rows: transcript }).expect(200);
      expect(await codes()).toContain('already_passed');

      await putShare(owner.auth, plan.id, { showTranscriptChecks: false });
      const off = (await read(token).expect(200)).body;
      await http().put('/api/users/me/transcript').set(owner.auth).send({ rows: [] }).expect(200);
      expect((await read(token).expect(200)).body).toEqual(off);
    });

    it('shows a reader, like the owner, that a placed course was failed, and only while the choice is on', async () => {
      const owner = await student();
      const terms = [
        { term: { year: 2030, number: 1 }, placements: [course(code(1)), course(code(3))] },
        { term: { year: 2030, number: 2 }, placements: [course(code(2)), course(code(5))] },
      ];
      const plan = await newPlan(owner.auth, { terms });
      const token = await share(owner.auth, plan.id);
      const offBefore = (await read(token).expect(200)).body;
      const issuesOf = async () => (await http().get(`/api/plans/${plan.id}/issues`).set(owner.auth).expect(200)).body;
      const codesOf = (r: { issues: { code: string }[] }) => r.issues.map((i) => i.code);
      expect(codesOf(await issuesOf())).not.toContain('prerequisite_not_met');

      await http().put('/api/users/me/transcript').set(owner.auth).send({ rows: [row(1, 'graded', 2.6, 2030, 1)] }).expect(200);
      const own = await issuesOf();

      expect((await read(token).expect(200)).body).toEqual(offBefore);

      await putShare(owner.auth, plan.id, { showTranscriptChecks: true });
      const on = (await read(token).expect(200)).body;
      const groupNames = new Map<string, string>(own.coverage.groups.map((g: { id: string; name: string }) => [g.id, g.name]));
      const asReader = ({ requirementGroupId, combinedMinimumId: _m, ...rest }: Record<string, unknown>) => ({
        ...rest,
        requirementGroupName: requirementGroupId === null ? null : groupNames.get(requirementGroupId as string),
        combinedMinimumName: null,
      });
      expect(on.issues).toEqual(own.issues.map(asReader));
      const brief = (i: Record<string, unknown>) => [i.code, i.courseCode, i.requirementGroupName, i.missingCourseCodes];
      const shown = on.issues.filter((i: { code: string }) => offBefore.issueCodesNotShown.includes(i.code)).map(brief);
      expect(shown).toContainEqual(['prerequisite_not_met', code(2), null, [code(1)]]);
      expect(shown).toContainEqual(['requirement_not_covered', null, 'Core', [code(1)]]);
      const textWithoutUpdatedAt = JSON.stringify({ ...on, updatedAt: null });
      for (const value of ['2.6', 'Transcript wording', '"grade"', '"result"', '"graded"', '"fail"', '"courseName"']) expect(textWithoutUpdatedAt, value).not.toContain(value);

      await putShare(owner.auth, plan.id, { showTranscriptChecks: false });
      expect((await read(token).expect(200)).body).toEqual(offBefore);
    });

    it('reads the transcript for a reader only while the choice is on', async () => {
      const owner = await student();
      await http().put('/api/users/me/transcript').set(owner.auth).send({ rows: transcript }).expect(200);
      const plan = await newPlan(owner.auth, { terms: checksBoard() });
      const token = await share(owner.auth, plan.id);
      const rowsFor = vi.spyOn(app.get(TranscriptService, { strict: false }), 'rowsFor');
      try {
        await read(token).expect(200);
        await read(token).expect(200);
        expect(rowsFor).not.toHaveBeenCalled();

        await putShare(owner.auth, plan.id, { showTranscriptChecks: true });
        await read(token).expect(200);
        expect(rowsFor.mock.calls).toEqual([[owner.userId]]);

        rowsFor.mockClear();
        await putShare(owner.auth, plan.id, { showTranscriptChecks: false });
        await read(token).expect(200);
        expect(rowsFor).not.toHaveBeenCalled();
      } finally {
        rowsFor.mockRestore();
      }
    });

    it('starts a new link with the choice off, also after a link with the choice on was stopped', async () => {
      const { auth } = await student();
      const plan = await newPlan(auth);
      const first = await share(auth, plan.id, { showName: true, showTranscriptChecks: true });
      expect(keys((await read(first).expect(200)).body)).toContain('coverage');
      await http().delete(`/api/plans/${plan.id}/share`).set(auth).expect(204);
      const again = (await putShare(auth, plan.id, {})).body;
      expect(again).toMatchObject({ showName: false, showTranscriptChecks: false });
      expect(again.token).not.toBe(first);
      const body = (await read(again.token).expect(200)).body;
      expect(keys(body)).toEqual(KEYS.plan);
      expect(body.ownerName).toBeNull();
    });

    it('gives two requests at once the same link, whatever choices they send', async () => {
      const { auth } = await student();
      const plan = await newPlan(auth);
      const bodies = [{ showTranscriptChecks: true }, { showName: true }, { showTranscriptChecks: true }, {}];
      const answers = await Promise.all(bodies.map((body) => http().put(`/api/plans/${plan.id}/share`).set(auth).send(body)));
      expect(answers.map((a) => a.status)).toEqual([200, 200, 200, 200]);
      expect(new Set(answers.map((a) => a.body.token)).size).toBe(1);
      expect(await db.query('SELECT show_name, show_transcript_checks FROM plan_shares WHERE plan_id = $1', [plan.id])).toEqual([{ show_name: true, show_transcript_checks: true }]);
    });

    it("lets nobody but the owner turn the choice on", async () => {
      const owner = await student();
      const plan = await newPlan(owner.auth);
      const token = await share(owner.auth, plan.id);
      const intruder = await student();
      await http().put(`/api/plans/${plan.id}/share`).set(intruder.auth).send({ showTranscriptChecks: true }).expect(404);
      await http().put(`/api/plans/${plan.id}/share`).send({ showTranscriptChecks: true }).expect(401);
      const write = await http().put(`/api/shared-plans/${token}`).send({ showTranscriptChecks: true }).expect(404);
      expect(write.body.message).toBe(`Cannot PUT /api/shared-plans/${token}`);
      const body = (await read(`${token}?showTranscriptChecks=true`).expect(200)).body;
      expect(keys(body)).toEqual(KEYS.plan);
      expect(await db.query('SELECT show_transcript_checks FROM plan_shares WHERE plan_id = $1', [plan.id])).toEqual([{ show_transcript_checks: false }]);
    });
  });

  describe('answers under /api/shared-plans that are not a plan', () => {
    const expectHeaders = (res: request.Response, why: string) => {
      expect(res.headers['x-robots-tag'], why).toBe('noindex, nofollow');
      expect(res.headers['cache-control'], why).toBe('no-store');
    };

    it('carry noindex and no-store: a longer path, the bare path, a path that cannot be decoded, another method', async () => {
      const { auth } = await student();
      const token = await share(auth, (await newPlan(auth)).id);
      const longer = await http().get(`/api/shared-plans/${token}/more`).expect(404);
      expect(longer.body.message).toBe(`Cannot GET /api/shared-plans/${token}/more`);
      expectHeaders(longer, 'a longer path');
      expectHeaders(await http().get('/api/shared-plans').expect(404), 'the bare path');
      expectHeaders(await http().get('/api/shared-plans/').expect(404), 'the bare path with a slash');
      const undecodable = await http().get('/api/shared-plans/%E0%A4%A');
      expect(undecodable.status).toBe(400);
      expectHeaders(undecodable, 'a path that cannot be decoded');
      expectHeaders(await http().post(`/api/shared-plans/${token}`).send({}).expect(404), 'another method');
      const other = await http().get('/api/shared-plansx');
      expect(other.headers['x-robots-tag']).toBeUndefined();
    });
  });

  describe('links that open nothing', () => {
    it('gives one answer to an unknown, a malformed, a stopped and a deleted-plan link', async () => {
      const { auth } = await student();
      const plan = await newPlan(auth);
      const token = await share(auth, plan.id);
      await read(token).expect(200);

      await expectDead(randomBytes(32).toString('base64url'), 'unknown token');
      const malformed = [token.slice(0, 42), `${token}A`, token.toLowerCase() === token ? token.toUpperCase() : token.toLowerCase(), 'x', '%00', `${token.slice(0, 42)}%2F`, `${token.slice(0, 40)}';--`, plan.id, 'A'.repeat(4000)];
      for (const bad of malformed) await expectDead(bad, `malformed ${bad.slice(0, 50)}`);

      await http().delete(`/api/plans/${plan.id}/share`).set(auth).expect(204);
      await expectDead(token, 'stopped');
      expect((await http().get(`/api/plans/${plan.id}/share`).set(auth).expect(200)).body).toEqual({ share: null });
      expect(await db.query('SELECT 1 FROM plan_shares WHERE plan_id = $1', [plan.id])).toEqual([]);
      await http().delete(`/api/plans/${plan.id}/share`).set(auth).expect(204);

      const second = await share(auth, plan.id);
      expect(second).not.toBe(token);
      await read(second).expect(200);
      await expectDead(token, 'old link after sharing again');

      await http().delete(`/api/plans/${plan.id}`).set(auth).expect(204);
      await expectDead(second, 'deleted plan');
      await expectDead(token, 'old link of a deleted plan');
      expect(await db.query('SELECT 1 FROM plan_shares WHERE plan_id = $1', [plan.id])).toEqual([]);
    });

    it('stops every link when account deletion is requested, keeps them stopped after the account is restored, and purges them', async () => {
      const owner = await student();
      const first = await newPlan(owner.auth);
      const second = await newPlan(owner.auth, { name: 'Second plan' });
      const tokens = [await share(owner.auth, first.id), await share(owner.auth, second.id, { showName: true })];
      for (const token of tokens) await read(token).expect(200);
      const bystander = await student();
      const bystanderToken = await share(bystander.auth, (await newPlan(bystander.auth)).id);

      await http().delete('/api/users/me').set(owner.auth).send({ password }).expect(202);
      for (const token of tokens) await expectDead(token, 'deletion requested');
      expect(await db.query('SELECT 1 FROM plan_shares WHERE user_id = $1', [owner.userId])).toEqual([]);
      await read(bystanderToken).expect(200);

      const signIn = await http().post('/api/auth/sign-in').send({ email: owner.email, password }).expect(200);
      expect(signIn.body.accountRestored).toBe(true);
      const auth = { Authorization: `Bearer ${signIn.body.token}` };
      for (const token of tokens) await expectDead(token, 'account restored');
      expect((await http().get(`/api/plans/${first.id}/share`).set(auth).expect(200)).body).toEqual({ share: null });

      const again = await share(auth, first.id);
      expect(tokens).not.toContain(again);
      await read(again).expect(200);
      await expectDead(tokens[0]!, 'old link after restore and sharing again');

      await http().delete('/api/users/me').set(auth).send({ password }).expect(202);
      await expectDead(again, 'deletion requested again');
      await db.query(`UPDATE users SET purge_after = now() - interval '1 minute' WHERE id = $1`, [owner.userId]);
      await app.get(AccountPurgeService, { strict: false }).purge();
      expect(await db.query('SELECT 1 FROM users WHERE id = $1', [owner.userId])).toEqual([]);
      expect(await db.query('SELECT 1 FROM plan_shares WHERE user_id = $1', [owner.userId])).toEqual([]);
      for (const token of [...tokens, again]) await expectDead(token, 'purged account');
      await read(bystanderToken).expect(200);
    });

    it('deletes the link with the account, whatever deleted the account', async () => {
      const owner = await student();
      const token = await share(owner.auth, (await newPlan(owner.auth)).id);
      await db.query('DELETE FROM users WHERE id = $1', [owner.userId]);
      expect(await db.query('SELECT 1 FROM plan_shares WHERE user_id = $1', [owner.userId])).toEqual([]);
      await expectDead(token, 'deleted account');
    });

    it('opens nothing for an account waiting for deletion, even if a link row is left', async () => {
      const owner = await student();
      const token = await share(owner.auth, (await newPlan(owner.auth)).id);
      await db.query(`UPDATE users SET deletion_requested_at = now(), purge_after = now() + interval '30 days' WHERE id = $1`, [owner.userId]);
      expect(await db.query('SELECT 1 FROM plan_shares WHERE user_id = $1', [owner.userId])).toHaveLength(1);
      await expectDead(token, 'account waiting for deletion');
    });

    it('creates no link for a share request that crosses a deletion request', async () => {
      const owner = await student();
      const plan = await newPlan(owner.auth);
      const deletion = db.createQueryRunner();
      await deletion.startTransaction();
      let pending: Promise<request.Response>;
      try {
        await deletion.query(`UPDATE users SET deletion_requested_at = now(), purge_after = now() + interval '30 days' WHERE id = $1`, [owner.userId]);
        pending = http().put(`/api/plans/${plan.id}/share`).set(owner.auth).send({}).then((res) => res);
        await new Promise((resolve) => setTimeout(resolve, 400));
        await deletion.query('DELETE FROM plan_shares WHERE user_id = $1', [owner.userId]);
        await deletion.commitTransaction();
      } finally {
        if (deletion.isTransactionActive) await deletion.rollbackTransaction();
        await deletion.release();
      }
      const res = await pending;
      expect([res.status, res.body.message]).toEqual([404, 'No plan with this id']);
      expect(await db.query('SELECT 1 FROM plan_shares WHERE user_id = $1', [owner.userId])).toEqual([]);
    });
  });

  describe('account export (ADR 0004)', () => {
    it('exports the share row without its token', async () => {
      const { auth, userId } = await student();
      const plan = await newPlan(auth);
      const token = await share(auth, plan.id, { showName: true });
      const res = await http().get('/api/users/me/export').set(auth).expect(200);
      expect(res.body.tables.plan_shares).toEqual([{ id: expect.any(String), plan_id: plan.id, user_id: userId, show_name: true, show_transcript_checks: false, created_at: expect.any(String) }]);
      await share(auth, plan.id, { showTranscriptChecks: true });
      const again = await http().get('/api/users/me/export').set(auth).expect(200);
      expect(again.body.tables.plan_shares).toEqual([{ id: expect.any(String), plan_id: plan.id, user_id: userId, show_name: true, show_transcript_checks: true, created_at: expect.any(String) }]);
      expect(JSON.stringify(again.body)).not.toContain(token);
      expect(JSON.stringify(res.body)).not.toContain(token);
      expect(await db.query('SELECT share_token FROM plan_shares WHERE plan_id = $1', [plan.id])).toEqual([{ share_token: token }]);
    });
  });
});
