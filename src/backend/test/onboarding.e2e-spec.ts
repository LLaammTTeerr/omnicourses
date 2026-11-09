import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findUserTables } from '../src/account/account-export.js';
import { AccountPurgeService } from '../src/account/account-purge.service.js';
import { vietnamDate } from '../src/config/time.js';
import { currentTerm } from '../src/terms/current-term.js';
import { bootApp } from './support/app.js';
import { PASSWORD as password, signedInUser } from './support/users.js';

// Synthetic accounts only (AGENTS.md hard rule 3). Terms are counted from today's current term,
// so the cases keep their meaning whatever day they run.
const now = currentTerm(vietnamDate(new Date()));
const ahead = (years: number, number: 1 | 2 | 3) => ({ year: now.year + years, number });
const lastTerm = ahead(8, 3);
const past = now.number === 1 ? { year: now.year - 1, number: 3 } : { year: now.year, number: now.number - 1 };

const UNSET = { program: null, cohort: null, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: false };
const FULL = {
  program: 'APCS',
  cohort: 2024,
  targetGraduationTerm: ahead(1, 2),
  creditsPerTerm: 18,
  internshipTerm: ahead(1, 1),
  finished: true,
};

describe('Onboarding against PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  const http = () => request(app.getHttpServer());

  async function student() {
    const { token, userId, email } = await signedInUser(app);
    return { userId, email, auth: { Authorization: `Bearer ${token}` } };
  }

  beforeAll(async () => {
    app = await bootApp();
    db = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('USER-01m: both routes answer 401 without a token', async () => {
    await http().get('/api/users/me/onboarding').expect(401);
    await http().put('/api/users/me/onboarding').send(FULL).expect(401);
  });

  it('USER-01c: before any save every answer is null and onboarding is unfinished', async () => {
    const { auth } = await student();
    expect((await http().get('/api/users/me/onboarding').set(auth).expect(200)).body).toEqual(UNSET);
  });

  it('USER-01c: Finish with every goal left empty stores null for each, with no default', async () => {
    const { auth } = await student();
    const body = { ...UNSET, program: 'APCS', cohort: 2024, finished: true };
    expect((await http().put('/api/users/me/onboarding').set(auth).send(body).expect(200)).body).toEqual(body);
    expect((await http().get('/api/users/me/onboarding').set(auth).expect(200)).body).toEqual(body);
  });

  it('USER-01d: a PUT then GET returns every answer unchanged, terms as { year, number }', async () => {
    const { auth } = await student();
    expect((await http().put('/api/users/me/onboarding').set(auth).send(FULL).expect(200)).body).toEqual(FULL);
    expect((await http().get('/api/users/me/onboarding').set(auth).expect(200)).body).toEqual(FULL);
  });

  it('USER-01l: program and cohort saved before the goal step stay, unfinished', async () => {
    const { auth } = await student();
    const body = { ...UNSET, program: 'APCS', cohort: 2025 };
    await http().put('/api/users/me/onboarding').set(auth).send(body).expect(200);
    expect((await http().get('/api/users/me/onboarding').set(auth).expect(200)).body).toEqual(body);
  });

  it('USER-01e, USER-01g: 26, 13 and 40 credits are stored as asked; 0 is refused and the earlier value stays', async () => {
    const { auth } = await student();
    for (const creditsPerTerm of [26, 13, 40]) {
      await http().put('/api/users/me/onboarding').set(auth).send({ ...FULL, creditsPerTerm }).expect(200);
      expect((await http().get('/api/users/me/onboarding').set(auth).expect(200)).body.creditsPerTerm).toBe(creditsPerTerm);
    }
    const refused = await http().put('/api/users/me/onboarding').set(auth).send({ ...FULL, creditsPerTerm: 0 }).expect(400);
    expect(refused.body.message).toEqual(['creditsPerTerm must be a whole number of 1 or more']);
    expect((await http().get('/api/users/me/onboarding').set(auth).expect(200)).body.creditsPerTerm).toBe(40);
  });

  it('USER-01f: -1, 2.5 and "abc" are refused with what a valid value is; clearing stores null', async () => {
    const { auth } = await student();
    await http().put('/api/users/me/onboarding').set(auth).send(FULL).expect(200);
    for (const creditsPerTerm of [-1, 2.5, 'abc']) {
      const res = await http().put('/api/users/me/onboarding').set(auth).send({ ...FULL, creditsPerTerm }).expect(400);
      expect(res.body.message).toEqual(['creditsPerTerm must be a whole number of 1 or more']);
      expect(JSON.stringify(res.body)).not.toMatch(/cap/i);
    }
    expect((await http().get('/api/users/me/onboarding').set(auth).expect(200)).body.creditsPerTerm).toBe(18);
    await http().put('/api/users/me/onboarding').set(auth).send({ ...FULL, creditsPerTerm: null }).expect(200);
    expect((await http().get('/api/users/me/onboarding').set(auth).expect(200)).body.creditsPerTerm).toBeNull();
  });

  it('USER-01h: "none" planned is kept apart from unset, and clearing it stores null', async () => {
    const { auth } = await student();
    await http().put('/api/users/me/onboarding').set(auth).send({ ...FULL, internshipTerm: 'none' }).expect(200);
    expect((await http().get('/api/users/me/onboarding').set(auth).expect(200)).body.internshipTerm).toBe('none');
    await http().put('/api/users/me/onboarding').set(auth).send({ ...FULL, internshipTerm: null }).expect(200);
    expect((await http().get('/api/users/me/onboarding').set(auth).expect(200)).body.internshipTerm).toBeNull();
  });

  it('USER-01i: changing the cohort keeps the goals and onboarding finished', async () => {
    const { auth } = await student();
    await http().put('/api/users/me/onboarding').set(auth).send(FULL).expect(200);
    const changed = { ...FULL, cohort: 2025 };
    expect((await http().put('/api/users/me/onboarding').set(auth).send(changed).expect(200)).body).toEqual(changed);
  });

  it('keeps the time of the first Finish across later saves', async () => {
    const { auth, userId } = await student();
    await http().put('/api/users/me/onboarding').set(auth).send(FULL).expect(200);
    const [first] = await db.query('SELECT finished_at FROM onboarding_answers WHERE user_id = $1', [userId]);
    await http().put('/api/users/me/onboarding').set(auth).send({ ...FULL, creditsPerTerm: 20 }).expect(200);
    const [second] = await db.query('SELECT finished_at FROM onboarding_answers WHERE user_id = $1', [userId]);
    expect(second.finished_at).toEqual(first.finished_at);
  });

  it('B1 §6 item 4: the current term and the last term eight academic years ahead are accepted', async () => {
    const { auth } = await student();
    for (const term of [now, lastTerm]) {
      const body = { ...FULL, targetGraduationTerm: term, internshipTerm: term };
      expect((await http().put('/api/users/me/onboarding').set(auth).send(body).expect(200)).body).toEqual(body);
    }
  });

  it.each([
    ['a past target graduation term', { targetGraduationTerm: past }, /^targetGraduationTerm must be from /],
    ['a target term more than eight years ahead', { targetGraduationTerm: ahead(9, 1) }, /^targetGraduationTerm must be from /],
    ['a past internship term', { internshipTerm: past }, /^internshipTerm must be from /],
    ['an internship term more than eight years ahead', { internshipTerm: ahead(9, 1) }, /^internshipTerm must be from /],
    ['term number 4', { targetGraduationTerm: { year: now.year + 1, number: 4 } }, /^targetGraduationTerm\.number must be one of/],
    ['USER-01b: a program not offered (CLC)', { program: 'CLC', cohort: 2025 }, /^program must be one of: APCS/],
    ['USER-01b: a cohort the curriculum data lacks (APCS 2023)', { cohort: 2023 }, /^cohort must be one of 2024, 2025 for APCS$/],
    ['finished without a program', { program: null, cohort: null }, /^finished needs a program and cohort$/],
  ])('refuses %s and keeps the saved answers', async (_, overrides, message) => {
    const { auth } = await student();
    await http().put('/api/users/me/onboarding').set(auth).send(FULL).expect(200);
    const res = await http().put('/api/users/me/onboarding').set(auth).send({ ...FULL, ...overrides }).expect(400);
    expect(res.body.message).toEqual([expect.stringMatching(message)]);
    expect((await http().get('/api/users/me/onboarding').set(auth).expect(200)).body).toEqual(FULL);
  });

  it('refuses a body with an answer left out instead of clearing it', async () => {
    const { auth } = await student();
    await http().put('/api/users/me/onboarding').set(auth).send(FULL).expect(200);
    const { creditsPerTerm: _left, ...partial } = FULL;
    await http().put('/api/users/me/onboarding').set(auth).send(partial).expect(400);
    expect((await http().get('/api/users/me/onboarding').set(auth).expect(200)).body).toEqual(FULL);
  });

  it("USER-01m: each student reads and writes only their own answers; another student's id in the body is ignored", async () => {
    const s1 = await student();
    const s2 = await student();
    await http().put('/api/users/me/onboarding').set(s1.auth).send(FULL).expect(200);
    const s2Answers = { ...FULL, cohort: 2025, creditsPerTerm: 15 };
    await http().put('/api/users/me/onboarding').set(s2.auth).send({ ...s2Answers, userId: s1.userId }).expect(200);
    expect((await http().get('/api/users/me/onboarding').set(s2.auth).expect(200)).body).toEqual(s2Answers);
    expect((await http().get('/api/users/me/onboarding').set(s1.auth).expect(200)).body).toEqual(FULL);
  });

  it('USER-01r, USER-01z: the answers are in the account export and go with the purge', async () => {
    const { auth, userId } = await student();
    await http().put('/api/users/me/onboarding').set(auth).send({ ...FULL, internshipTerm: 'none' }).expect(200);
    expect((await findUserTables(db)).map((t) => t.table)).toContain('onboarding_answers');

    const exported = await http().get('/api/users/me/export').set(auth).expect(200);
    expect(exported.body.tables.onboarding_answers).toEqual([
      expect.objectContaining({
        user_id: userId,
        program_code: 'APCS',
        cohort_year: 2024,
        target_graduation_term_year: FULL.targetGraduationTerm.year,
        target_graduation_term_number: FULL.targetGraduationTerm.number,
        credits_per_term: 18,
        internship_term_year: null,
        internship_term_number: null,
        no_internship_planned: true,
      }),
    ]);

    await http().delete('/api/users/me').set(auth).send({ password }).expect(202);
    await db.query(`UPDATE users SET purge_after = now() - interval '1 minute' WHERE id = $1`, [userId]);
    await app.get(AccountPurgeService, { strict: false }).purge();
    expect(await db.query('SELECT 1 FROM onboarding_answers WHERE user_id = $1', [userId])).toEqual([]);
  });

  it('the table refuses half a term, a cohort without a program and 0 credits, whatever the caller', async () => {
    const { userId } = await student();
    const insert = (columns: string, values: string) => db.query(`INSERT INTO onboarding_answers (user_id, ${columns}) VALUES ($1, ${values})`, [userId]);
    await expect(insert('target_graduation_term_year', '2027')).rejects.toThrow(/ck_onboarding_answers_target_term/);
    await expect(insert('cohort_year', '2024')).rejects.toThrow(/ck_onboarding_answers_program_cohort/);
    await expect(insert('credits_per_term', '0')).rejects.toThrow(/ck_onboarding_answers_credits_per_term/);
    await expect(insert('no_internship_planned, internship_term_year, internship_term_number', 'true, 2027, 1')).rejects.toThrow(/ck_onboarding_answers_no_internship/);
    await expect(insert('finished_at', 'now()')).rejects.toThrow(/ck_onboarding_answers_finished/);
  });
});
