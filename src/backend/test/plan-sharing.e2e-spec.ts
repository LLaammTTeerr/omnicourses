import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountPurgeService } from '../src/account/account-purge.service.js';
import { bootApp } from './support/app.js';
import { PASSWORD as password, signedInUser } from './support/users.js';

// F9 shared plans against PostgreSQL (UC-09, ADR 0010; test plan row TC-B2-SHARE-01). A synthetic
// Tiên tiến curriculum and synthetic students (AGENTS.md hard rule 3), unique per run so reruns
// never collide. Expected values are worked out by hand in the comments.
const tag = randomBytes(3).toString('hex').toUpperCase();
const program = `ZZS${tag}`;
const code = (n: number) => `ZZS${tag}${n}`;

const course = (courseCode: string) => ({ kind: 'course', courseCode, requirementGroupId: null, credits: null });
const slot = (requirementGroupId: string, credits: number) => ({ kind: 'slot', courseCode: null, requirementGroupId, credits });

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const NOT_SHARED = { statusCode: 404, message: 'This plan is not shared', error: 'Not Found' };
/** Every field a reader gets, at every level (UC-09 step 2). Anything else in the answer fails the test. */
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
  let electives: string;
  const http = () => request(app.getHttpServer());

  async function student() {
    const { token, userId, email } = await signedInUser(app);
    return { userId, email, auth: { Authorization: `Bearer ${token}` } };
  }

  // 2030-1: 2 needs 1, placed in the same term; 2 is taught in term 2 only. 2030-2: a slot and course 6, which is in no group.
  const board = () => [
    { term: { year: 2030, number: 1 }, placements: [course(code(2)), course(code(1)), course(code(3))] },
    { term: { year: 2030, number: 2 }, placements: [course(code(5)), slot(electives, 3), course(code(6))] },
  ];

  async function newPlan(auth: Record<string, string>, body: Record<string, unknown> = {}) {
    return (await http().post('/api/plans').set(auth).send({ name: 'Main plan', programCode: program, cohortYear: 2030, terms: board(), ...body }).expect(201)).body;
  }

  /** Shares the plan and returns the link's token. */
  async function share(auth: Record<string, string>, planId: string, body: Record<string, unknown> = {}): Promise<string> {
    const res = await http().put(`/api/plans/${planId}/share`).set(auth).send(body).expect(200);
    expect(res.body.token).toMatch(TOKEN);
    return res.body.token;
  }

  /** What a signed-out reader gets for a token: no Authorization header is ever sent. */
  const read = (token: string) => http().get(`/api/shared-plans/${token}`);

  /** The one answer to a link that opens nothing, with the headers that keep it out of search engines and caches. */
  async function expectDead(token: string, why: string) {
    const res = await read(token);
    expect([res.status, res.body], why).toEqual([404, NOT_SHARED]);
    expect(res.headers['x-robots-tag'], why).toBe('noindex, nofollow');
    expect(res.headers['cache-control'], why).toBe('no-store');
  }

  beforeAll(async () => {
    app = await bootApp();
    db = app.get(DataSource);
    // Tiên tiến: 10–22 credits in every term (ADR 0012). Core 8 (1, 2) + Electives ≥ 8 (3, 4, 5); course 6 is in no group.
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
      expect(keys(created.body)).toEqual(['createdAt', 'showName', 'token']);
      expect(created.body).toMatchObject({ token: expect.stringMatching(TOKEN), showName: false });
      expect(created.headers['cache-control']).toBe('no-store');
      expect((await read(created.body.token).expect(200)).body.ownerName).toBeNull();

      // UC-09 A4: the plan already has a live link; it is shown again, not replaced.
      const shown = await http().get(`/api/plans/${plan.id}/share`).set(auth).expect(200);
      expect(shown.body).toEqual({ share: created.body });
      expect(shown.headers['cache-control']).toBe('no-store');
      expect((await http().put(`/api/plans/${plan.id}/share`).set(auth).send({}).expect(200)).body).toEqual(created.body);

      // Show my name: the same link, now with the display name and nothing else about the owner.
      const named = (await http().put(`/api/plans/${plan.id}/share`).set(auth).send({ showName: true }).expect(200)).body;
      expect(named).toEqual({ ...created.body, showName: true });
      expect((await read(created.body.token).expect(200)).body.ownerName).toBe('Test Student');

      // Left out again: hidden again.
      expect((await http().put(`/api/plans/${plan.id}/share`).set(auth).send({}).expect(200)).body.showName).toBe(false);
      expect((await read(created.body.token).expect(200)).body.ownerName).toBeNull();
      expect(await db.query('SELECT 1 FROM plan_shares WHERE plan_id = $1', [plan.id])).toHaveLength(1);
    });

    it('refuses a showName that is not a boolean, and shares nothing', async () => {
      const { auth } = await student();
      const plan = await newPlan(auth);
      await http().put(`/api/plans/${plan.id}/share`).set(auth).send({ showName: 'yes' }).expect(400);
      expect((await http().get(`/api/plans/${plan.id}/share`).set(auth).expect(200)).body).toEqual({ share: null });
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
      // The owner's link is untouched: same token, name still hidden, still open; the other plan is still not shared.
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
      // The owner's transcript: course 5 passed with a grade, under a name the catalog does not use.
      const row = { courseCode: code(5), courseName: 'Transcript wording', credits: 4, result: 'graded', grade: 8.6, term: { year: 2029, number: 1 } };
      await http().put('/api/users/me/transcript').set(owner.auth).send({ rows: [row] }).expect(200);
      const token = await share(owner.auth, plan.id);

      const res = await read(token).expect(200);
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect(res.headers['cache-control']).toBe('no-store');
      const body = res.body;

      // The full key set at every level: a field added later fails here until someone allows it.
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
        // 3 courses of 4 credits.
        { term: { year: 2030, number: 1 }, kind: 'main', credits: 12, caps: { min: 10, max: 22 }, placements: [tile(2), tile(1), tile(3)] },
        // 4 + the slot's 3 + 4.
        {
          term: { year: 2030, number: 2 },
          kind: 'main',
          credits: 11,
          caps: { min: 10, max: 22 },
          placements: [tile(5), { kind: 'slot', courseCode: null, nameVi: null, nameEn: null, credits: 3, requirementGroupName: 'Electives' }, tile(6)],
        },
      ]);

      // Nothing that identifies the owner or comes from their record, anywhere in the answer.
      // (updatedAt is left out of the search: its digits could match the grade by chance.)
      const text = JSON.stringify({ ...body, updatedAt: null });
      const forbidden = [owner.userId, owner.email, 'Test Student', plan.id, other.id, 'My other secret plan', 'Transcript wording', '8.6', curriculumId, electives, 'password', 'email', 'grade', 'transcript'];
      for (const value of forbidden) expect(text, value).not.toContain(value);
    });

    // UC-09 A9, hard rule 1: the issues are the rule engine's own, the ones the owner sees, minus
    // those the transcript decides. Nothing is computed a second time.
    it("shows the rule engine's issues of the plan as the owner sees them, without the ones the transcript decides", async () => {
      const owner = await student();
      const plan = await newPlan(owner.auth);
      const token = await share(owner.auth, plan.id);
      const own = (await http().get(`/api/plans/${plan.id}/issues`).set(owner.auth).expect(200)).body;
      const { body } = await read(token).expect(200);

      const hidden = ['prerequisite_not_met', 'already_passed', 'already_in_progress', 'requirement_not_covered'];
      // The owner's report has violations of both sorts, so the comparison is not of two empty lists.
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
      // The loads are the engine's too.
      expect(body.terms.map(({ term, kind, credits, caps }: Record<string, unknown>) => ({ term, kind, credits, caps }))).toEqual(own.terms);
    });

    // UC-09 §7: the transcript never appears. Saving a transcript that changes the owner's own
    // report in every way leaves the reader's answer exactly as it was.
    it('gives the same answer whatever the owner’s transcript holds', async () => {
      const owner = await student();
      const plan = await newPlan(owner.auth);
      const token = await share(owner.auth, plan.id);
      const issuesOf = async () => (await http().get(`/api/plans/${plan.id}/issues`).set(owner.auth).expect(200)).body;
      const before = (await read(token).expect(200)).body;
      const ownBefore = await issuesOf();

      const row = (n: number, result: string, grade: number | null, year: number, number: number) => ({ courseCode: code(n), courseName: 'Transcript wording', credits: 4, result, grade, term: { year, number } });
      const rows = [
        row(1, 'graded', 8.6, 2029, 1), // the prerequisite of 2, passed: the owner's prerequisite violation goes
        row(5, 'graded', 9.4, 2029, 1), // placed again: a grade improvement
        row(3, 'in_progress', null, 2029, 3), // placed again while in progress
        row(4, 'graded', 2.6, 2029, 1), // failed
        row(4, 'pass', null, 2029, 2), // retaken and passed
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
      const text = JSON.stringify({ ...after, updatedAt: null });
      for (const value of ['Transcript wording', '8.6', '9.4', '2.6', '"in_progress"', code(4)]) expect(text, value).not.toContain(value);
    });

    // UC-09 A5: the link shows the plan as it is now, with the new last-changed date.
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
      // 8 credits is below the minimum of 10: a new issue the first read did not have.
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

    // Default-deny writes (ADR 0010): the public route only reads. No method on its path changes anything.
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
      // The owner routes need a session: the link's token is not one.
      for (const method of ['get', 'put', 'delete'] as const) await http()[method](`/api/plans/${plan.id}/share`).set('Authorization', `Bearer ${token}`).expect(401);
      await http().put(`/api/plans/${plan.id}/placements`).set('Authorization', `Bearer ${token}`).send({ terms: [] }).expect(401);
      expect((await read(token).expect(200)).body).toEqual(before);
      expect(await db.query('SELECT * FROM plan_shares WHERE plan_id = $1', [plan.id])).toEqual([rowBefore]);
    });

    // The read route writes nothing: the plan, its link and the owner's rows are the same after many reads.
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

  describe('links that open nothing', () => {
    it('gives one answer to an unknown, a malformed, a stopped and a deleted-plan link', async () => {
      const { auth } = await student();
      const plan = await newPlan(auth);
      const token = await share(auth, plan.id);
      await read(token).expect(200);

      // UC-09 A8: never created, or mistyped.
      await expectDead(randomBytes(32).toString('base64url'), 'unknown token');
      const malformed = [token.slice(0, 42), `${token}A`, token.toLowerCase() === token ? token.toUpperCase() : token.toLowerCase(), 'x', '%00', `${token.slice(0, 42)}%2F`, `${token.slice(0, 40)}';--`, plan.id, 'A'.repeat(4000)];
      for (const bad of malformed) await expectDead(bad, `malformed ${bad.slice(0, 50)}`);

      // A2: stopped. The link is dead at once.
      await http().delete(`/api/plans/${plan.id}/share`).set(auth).expect(204);
      await expectDead(token, 'stopped');
      expect((await http().get(`/api/plans/${plan.id}/share`).set(auth).expect(200)).body).toEqual({ share: null });
      expect(await db.query('SELECT 1 FROM plan_shares WHERE plan_id = $1', [plan.id])).toEqual([]);
      // Stopping again is the same answer.
      await http().delete(`/api/plans/${plan.id}/share`).set(auth).expect(204);

      // A3: shared again. A new link; the old one stays dead.
      const second = await share(auth, plan.id);
      expect(second).not.toBe(token);
      await read(second).expect(200);
      await expectDead(token, 'old link after sharing again');

      // A6: the plan is deleted.
      await http().delete(`/api/plans/${plan.id}`).set(auth).expect(204);
      await expectDead(second, 'deleted plan');
      await expectDead(token, 'old link of a deleted plan');
      expect(await db.query('SELECT 1 FROM plan_shares WHERE plan_id = $1', [plan.id])).toEqual([]);
    });

    // UC-09 A7, ADR 0004: a deletion request stops every link at once, like the sessions; a restored
    // account's links stay stopped until the student shares again; the purge leaves nothing.
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
      // Another student's link is untouched.
      await read(bystanderToken).expect(200);

      // Signing in within the grace period restores the account. The plans are back; the links are not.
      const signIn = await http().post('/api/auth/sign-in').send({ email: owner.email, password }).expect(200);
      expect(signIn.body.accountRestored).toBe(true);
      const auth = { Authorization: `Bearer ${signIn.body.token}` };
      for (const token of tokens) await expectDead(token, 'account restored');
      expect((await http().get(`/api/plans/${first.id}/share`).set(auth).expect(200)).body).toEqual({ share: null });

      // A3: the student shares again and gets a new link.
      const again = await share(auth, first.id);
      expect(tokens).not.toContain(again);
      await read(again).expect(200);
      await expectDead(tokens[0]!, 'old link after restore and sharing again');

      // Requested again and past the deadline: the purge deletes the account and its rows.
      await http().delete('/api/users/me').set(auth).send({ password }).expect(202);
      await expectDead(again, 'deletion requested again');
      await db.query(`UPDATE users SET purge_after = now() - interval '1 minute' WHERE id = $1`, [owner.userId]);
      await app.get(AccountPurgeService, { strict: false }).purge();
      expect(await db.query('SELECT 1 FROM users WHERE id = $1', [owner.userId])).toEqual([]);
      expect(await db.query('SELECT 1 FROM plan_shares WHERE user_id = $1', [owner.userId])).toEqual([]);
      for (const token of [...tokens, again]) await expectDead(token, 'purged account');
      await read(bystanderToken).expect(200);
    });

    // The purge alone (no request through the API) cascades to the link too.
    it('deletes the link with the account, whatever deleted the account', async () => {
      const owner = await student();
      const token = await share(owner.auth, (await newPlan(owner.auth)).id);
      await db.query('DELETE FROM users WHERE id = $1', [owner.userId]);
      expect(await db.query('SELECT 1 FROM plan_shares WHERE user_id = $1', [owner.userId])).toEqual([]);
      await expectDead(token, 'deleted account');
    });

    // A link row that outlived a deletion request must still open nothing: the read checks the account itself.
    it('opens nothing for an account waiting for deletion, even if a link row is left', async () => {
      const owner = await student();
      const token = await share(owner.auth, (await newPlan(owner.auth)).id);
      await db.query(`UPDATE users SET deletion_requested_at = now(), purge_after = now() + interval '30 days' WHERE id = $1`, [owner.userId]);
      expect(await db.query('SELECT 1 FROM plan_shares WHERE user_id = $1', [owner.userId])).toHaveLength(1);
      await expectDead(token, 'account waiting for deletion');
    });

    // A share request that is in flight while the deletion request commits must leave no link:
    // otherwise restoring the account would bring a link back, which UC-09 A7 forbids.
    it('creates no link for a share request that crosses a deletion request', async () => {
      const owner = await student();
      const plan = await newPlan(owner.auth);
      const deletion = db.createQueryRunner();
      await deletion.startTransaction();
      let pending: Promise<request.Response>;
      try {
        // The deletion request's first statement, not yet committed.
        await deletion.query(`UPDATE users SET deletion_requested_at = now(), purge_after = now() + interval '30 days' WHERE id = $1`, [owner.userId]);
        pending = http().put(`/api/plans/${plan.id}/share`).set(owner.auth).send({}).then((res) => res);
        // The share request is now waiting on the account's row.
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
      expect(res.body.tables.plan_shares).toEqual([{ id: expect.any(String), plan_id: plan.id, user_id: userId, show_name: true, created_at: expect.any(String) }]);
      expect(JSON.stringify(res.body)).not.toContain(token);
      // The token is stored, so the check above is not passing on an empty column.
      expect(await db.query('SELECT share_token FROM plan_shares WHERE plan_id = $1', [plan.id])).toEqual([{ share_token: token }]);
    });
  });
});
