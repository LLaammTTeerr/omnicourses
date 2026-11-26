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
  let core: string;
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
    offerAlso(app, program, [2030]);
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
    core = await group('Core', 'compulsory', 8, null, [1, 2]);
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
      expect(keys(created.body)).toEqual(['createdAt', 'showName', 'showTranscriptChecks', 'token']);
      expect(created.body).toMatchObject({ token: expect.stringMatching(TOKEN), showName: false, showTranscriptChecks: false });
      expect(created.headers['cache-control']).toBe('no-store');
      expect((await read(created.body.token).expect(200)).body.ownerName).toBeNull();

      // A request with no body at all is the same as an empty one: the same link, name hidden.
      expect((await http().put(`/api/plans/${plan.id}/share`).set(auth).expect(200)).body).toEqual(created.body);

      // UC-09 A4: the plan already has a live link; it is shown again, not replaced.
      const shown = await http().get(`/api/plans/${plan.id}/share`).set(auth).expect(200);
      expect(shown.body).toEqual({ share: created.body });
      expect(shown.headers['cache-control']).toBe('no-store');
      expect((await http().put(`/api/plans/${plan.id}/share`).set(auth).send({}).expect(200)).body).toEqual(created.body);

      // Show my name: the same link, now with the display name and nothing else about the owner.
      const named = (await http().put(`/api/plans/${plan.id}/share`).set(auth).send({ showName: true }).expect(200)).body;
      expect(named).toEqual({ ...created.body, showName: true });
      expect((await read(created.body.token).expect(200)).body.ownerName).toBe('Test Student');

      // Left out: the choice stays as it is. Only an explicit false hides the name again.
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
      // One bad choice refuses the whole request, the good one with it.
      await http().put(`/api/plans/${plan.id}/share`).set(auth).send({ showName: true, showTranscriptChecks: 'yes' }).expect(400);
      // null is not "left out": a choice that is sent is a boolean.
      for (const body of [{ showName: null }, { showTranscriptChecks: null }, { showName: true, showTranscriptChecks: null }]) await http().put(`/api/plans/${plan.id}/share`).set(auth).send(body).expect(400);
      // The body is an object or nothing: an array is not read as "no choice".
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
      // On a live link both change nothing, whatever the link's choices are.
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
        row(2, 'graded', 6.4, 2030, 1), // an attempt in the very term the plan places the course
        row(6, 'fail', null, 2030, 2), // failed in one of the plan's terms
        row(4, 'graded', 9.9, 2031, 1), // after the plan's last term
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
      for (const value of ['Transcript wording', '8.6', '9.4', '2.6', '6.4', '9.9', '"in_progress"', '"fail"', code(4)]) expect(text, value).not.toContain(value);
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

  // ADR 0010, amended 25 November 2026: the owner chooses, for each link, whether a reader sees the
  // checks that come from the owner's transcript. Off unless the owner turns it on.
  describe('when the owner shows the checks that come from their transcript', () => {
    // 2030-1: 2 needs 1, which is nowhere; 3 is in progress in the transcript. 2030-2: 5 is already passed; 6 is in no group.
    // Core (1, 2): only 2 is placed, 4 of 8 credits, 1 missing. Electives: 3 + 5 = 8 of 8. Total: 4 + 8 = 12 of 16.
    const checksBoard = () => [
      { term: { year: 2030, number: 1 }, placements: [course(code(2)), course(code(3))] },
      { term: { year: 2030, number: 2 }, placements: [course(code(5)), course(code(6))] },
    ];
    const row = (n: number, result: string, grade: number | null, year: number, number: number) => ({ courseCode: code(n), courseName: 'Transcript wording', credits: 4, result, grade, term: { year, number } });
    // Distinctive grades: none of these digits can appear in the answer by chance once updatedAt is left out.
    // 5 is passed, 3 is in progress, 4 is failed (so it adds nothing to Electives).
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
      // With the choice off the engine is not given the transcript. What a reader gets is still what
      // the owner's own report says, transcript and all, once the four transcript codes are taken out.
      const ownReport = (await http().get(`/api/plans/${plan.id}/issues`).set(owner.auth).expect(200)).body;
      const planOnly = ownReport.issues
        .filter((i: { code: string }) => !off.issueCodesNotShown.includes(i.code))
        .map(({ requirementGroupId: _g, combinedMinimumId: _m, missingCourseCodes: _c, ...rest }: Record<string, unknown>) => rest);
      expect(planOnly.length).toBeGreaterThan(0);
      expect(off.issues).toEqual(planOnly);
      expect(off.terms.map(({ term, kind, credits, caps }: Record<string, unknown>) => ({ term, kind, credits, caps }))).toEqual(ownReport.terms);

      // Turned on, on the live link: the same token.
      expect((await putShare(owner.auth, plan.id, { showTranscriptChecks: true })).body).toMatchObject({ token, showName: false, showTranscriptChecks: true });
      const own = (await http().get(`/api/plans/${plan.id}/issues`).set(owner.auth).expect(200)).body;
      const on = (await read(token).expect(200)).body;

      // The owner's own report has all four transcript codes, so the comparison below covers each.
      expect([...new Set(own.issues.map((i: { code: string }) => i.code))]).toEqual(expect.arrayContaining(['prerequisite_not_met', 'already_passed', 'already_in_progress', 'requirement_not_covered']));
      // The reader's issues are the owner's own, one for one and in order, with a requirement group by name instead of by id.
      const groupNames = new Map<string, string>(own.coverage.groups.map((g: { id: string; name: string }) => [g.id, g.name]));
      const asReader = ({ requirementGroupId, combinedMinimumId, ...rest }: Record<string, unknown>) => {
        expect(combinedMinimumId).toBeNull(); // this curriculum has no combined minimum
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
      // Every term in an issue is a term of the plan, never the term of a transcript row (2029).
      for (const i of on.issues) if (i.term) expect(i.term.year).toBe(2030);

      // The coverage and the graduation status are the owner's own, without the ids.
      const { groups, combinedMinimums, ...totals } = own.coverage;
      expect(on.coverage).toEqual({ ...totals, combinedMinimums, groups: groups.map(({ id: _id, ...rest }: { id: string }) => rest) });
      expect(on.coverage).toMatchObject({ totalRequired: 16, totalCredits: 12, totalRemaining: 4, graduation: 'not_yet', combinedMinimums: [] });
      expect(on.coverage.groups).toEqual([
        { name: 'Core', kind: 'compulsory', requiredCredits: 8, credits: 4, remainingCredits: 4, met: false },
        { name: 'Electives', kind: 'elective', requiredCredits: 8, credits: 8, remainingCredits: 0, met: true },
      ]);

      // The full key set with the choice on: the fields without it, the coverage, and three more fields on each issue.
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
      // Everything else in the answer is what it was.
      const { coverage: _c, issues: _i, issueCodesNotShown: _n, ...rest } = on;
      const { issues: _oi, issueCodesNotShown: _on, ...offRest } = off;
      expect(rest).toEqual(offRest);

      // No grade, no transcript row, no email, no id of the plan, the owner, the curriculum or a group. (updatedAt is
      // left out of the search: its digits could match a grade by chance. The word "grade" alone is in the engine's
      // "grade improvement" sentence, so the search is for the key and the values.)
      const text = JSON.stringify({ ...on, updatedAt: null });
      const forbidden = ['8.6', '2.6', code(4), 'Transcript wording', '"grade"', '"result"', '"courseName"', '"graded"', '"in_progress"', owner.userId, owner.email, 'Test Student', plan.id, curriculumId, core, electives, '"id"', 'Id"', 'password', 'email'];
      for (const value of forbidden) expect(text, value).not.toContain(value);

      // The name choice sent alone does not touch this one, and the other way round: still the same link.
      expect((await putShare(owner.auth, plan.id, { showName: true })).body).toMatchObject({ token, showName: true, showTranscriptChecks: true });
      expect((await putShare(owner.auth, plan.id, {})).body).toMatchObject({ token, showName: true, showTranscriptChecks: true });
      expect((await http().get(`/api/plans/${plan.id}/share`).set(owner.auth).expect(200)).body.share).toMatchObject({ token, showName: true, showTranscriptChecks: true });
      const named = (await read(token).expect(200)).body;
      expect(named).toEqual({ ...on, ownerName: 'Test Student' });

      // Turned off again: the earlier answer, exactly, on the same link.
      expect((await putShare(owner.auth, plan.id, { showTranscriptChecks: false })).body).toMatchObject({ token, showName: true, showTranscriptChecks: false });
      expect((await read(token).expect(200)).body).toEqual({ ...off, ownerName: 'Test Student' });
      expect((await putShare(owner.auth, plan.id, { showName: false })).body).toMatchObject({ token, showName: false, showTranscriptChecks: false });
      expect((await read(token).expect(200)).body).toEqual(off);
      expect(await db.query('SELECT 1 FROM plan_shares WHERE plan_id = $1', [plan.id])).toHaveLength(1);
    });

    // The transcript changes what a reader sees only while the choice is on.
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

    // The review of the pull request found this: a failed attempt shows too. Course 1 is on the board, and
    // course 2 needs it. The transcript then holds course 1 failed in the very term the plan places it.
    it('shows a reader, like the owner, that a placed course was failed, and only while the choice is on', async () => {
      const owner = await student();
      // 2030-1: 1 and 3. 2030-2: 2 (taught in term 2, needs 1) and 5.
      const terms = [
        { term: { year: 2030, number: 1 }, placements: [course(code(1)), course(code(3))] },
        { term: { year: 2030, number: 2 }, placements: [course(code(2)), course(code(5))] },
      ];
      const plan = await newPlan(owner.auth, { terms });
      const token = await share(owner.auth, plan.id);
      const offBefore = (await read(token).expect(200)).body;
      const issuesOf = async () => (await http().get(`/api/plans/${plan.id}/issues`).set(owner.auth).expect(200)).body;
      // Before the transcript, nothing is wrong with course 1 or its place before course 2.
      const codesOf = (r: { issues: { code: string }[] }) => r.issues.map((i) => i.code);
      expect(codesOf(await issuesOf())).not.toContain('prerequisite_not_met');

      // Course 1 failed with 2.6 in 2030 term 1, where the plan places it.
      await http().put('/api/users/me/transcript').set(owner.auth).send({ rows: [row(1, 'graded', 2.6, 2030, 1)] }).expect(200);
      const own = await issuesOf();

      // Off: the answer is exactly what it was before the transcript.
      expect((await read(token).expect(200)).body).toEqual(offBefore);

      // On: the reader's issues are the owner's own. They say that course 2's prerequisite, course 1, is not
      // met and that Core still needs course 1, although course 1 is on the board: so it was failed.
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
      // The grade itself, the result and the transcript's wording are nowhere.
      const text = JSON.stringify({ ...on, updatedAt: null });
      for (const value of ['2.6', 'Transcript wording', '"grade"', '"result"', '"graded"', '"fail"', '"courseName"']) expect(text, value).not.toContain(value);

      // Off again: unchanged, still.
      await putShare(owner.auth, plan.id, { showTranscriptChecks: false });
      expect((await read(token).expect(200)).body).toEqual(offBefore);
    });

    // With the choice off the transcript is not read at all, so the time an answer takes cannot depend on it either.
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
      // Nobody sent false, so both choices end on, whatever the order the requests ran in.
      expect(await db.query('SELECT show_name, show_transcript_checks FROM plan_shares WHERE plan_id = $1', [plan.id])).toEqual([{ show_name: true, show_transcript_checks: true }]);
    });

    it("lets nobody but the owner turn the choice on", async () => {
      const owner = await student();
      const plan = await newPlan(owner.auth);
      const token = await share(owner.auth, plan.id);
      const intruder = await student();
      await http().put(`/api/plans/${plan.id}/share`).set(intruder.auth).send({ showTranscriptChecks: true }).expect(404);
      await http().put(`/api/plans/${plan.id}/share`).send({ showTranscriptChecks: true }).expect(401);
      // The public path has no write: the framework answers that there is no such route.
      const write = await http().put(`/api/shared-plans/${token}`).send({ showTranscriptChecks: true }).expect(404);
      expect(write.body.message).toBe(`Cannot PUT /api/shared-plans/${token}`);
      const body = (await read(`${token}?showTranscriptChecks=true`).expect(200)).body;
      expect(keys(body)).toEqual(KEYS.plan);
      expect(await db.query('SELECT show_transcript_checks FROM plan_shares WHERE plan_id = $1', [plan.id])).toEqual([{ show_transcript_checks: false }]);
    });
  });

  // ADR 0010: every answer under the public route's path carries the two headers, also the answers
  // that the route's own code never makes.
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
      // A path that only starts with the same letters is another route, and none of this module's.
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
      expect(res.body.tables.plan_shares).toEqual([{ id: expect.any(String), plan_id: plan.id, user_id: userId, show_name: true, show_transcript_checks: false, created_at: expect.any(String) }]);
      // The other choice is exported like the first.
      await share(auth, plan.id, { showTranscriptChecks: true });
      const again = await http().get('/api/users/me/export').set(auth).expect(200);
      expect(again.body.tables.plan_shares).toEqual([{ id: expect.any(String), plan_id: plan.id, user_id: userId, show_name: true, show_transcript_checks: true, created_at: expect.any(String) }]);
      expect(JSON.stringify(again.body)).not.toContain(token);
      expect(JSON.stringify(res.body)).not.toContain(token);
      // The token is stored, so the check above is not passing on an empty column.
      expect(await db.query('SELECT share_token FROM plan_shares WHERE plan_id = $1', [plan.id])).toEqual([{ share_token: token }]);
    });
  });
});
