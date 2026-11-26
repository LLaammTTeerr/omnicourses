import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApp } from './support/app.js';
import { offerAlso } from './support/offer.js';
import { signedInUser } from './support/users.js';

type Account = { token: string; userId: string };

const NUL = (field: string) => `${field} must not contain a null character (U+0000)`;
const LONG = (field: string, max: number) => `${field} must be shorter than or equal to ${max} characters`;
const tooLong = (max: number) => 'x'.repeat(max - 1) + '❤️';

describe('Text fields refuse a null character and a value too long in code points (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  const http = () => request(app.getHttpServer());
  const as = ({ token }: Account) => {
    const auth = (test: request.Test) => test.set('Authorization', `Bearer ${token}`);
    return {
      get: (path: string) => auth(http().get(path)),
      post: (path: string, body: object) => auth(http().post(path)).send(body),
      put: (path: string, body: object) => auth(http().put(path)).send(body),
      patch: (path: string, body: object) => auth(http().patch(path)).send(body),
    };
  };

  const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  const PROGRAM = `ZZT-${suffix}`;
  const COURSE = `ZZT${suffix}`;
  let student: Account;
  let admin: Account;
  let programId: string;
  let curriculumId: string;
  let planId: string;
  let groupId: string;
  let eventId: string;

  const cohortPath = () => `/api/admin/programs/${programId}/cohorts/${curriculumId}`;
  const eventsPath = () => `/api/admin/programs/${programId}/calendar-events`;

  beforeAll(async () => {
    app = await bootApp();
    db = app.get(DataSource);
    [student, admin] = await Promise.all([signedInUser(app), signedInUser(app)]);
    offerAlso(app, PROGRAM, [2030]);
    const id = async (sql: string, params: unknown[]) => ((await db.query(sql, params)) as { id: string }[])[0].id;
    programId = await id(`INSERT INTO programs (code, name_vi) VALUES ($1, 'Chương trình thử') RETURNING id`, [PROGRAM]);
    curriculumId = await id(`INSERT INTO curriculums (program_id, cohort_year, code, name_vi) VALUES ($1, 2030, $2, 'Khóa thử') RETURNING id`, [programId, `${PROGRAM}-2030`]);
    await db.query('INSERT INTO program_admin_grants (user_id, program_id) VALUES ($1, $2)', [admin.userId, programId]);
    await db.query(`INSERT INTO global_admin_grants (user_id, permission) VALUES ($1, 'catalog_maintainer')`, [admin.userId]);

    await as(admin).post('/api/admin/catalog/courses', { code: COURSE, nameVi: 'Học phần thử', credits: 3 }).expect(201);
    groupId = (await as(admin).post(`${cohortPath()}/requirement-groups`, { name: 'Nhóm thử', kind: 'elective' }).expect(201)).body.id;
    eventId = (await as(admin).post(eventsPath(), { academicYear: 2030, kind: 'other', startsOn: '2030-09-07', title: 'Ngày thử' }).expect(201)).body.id;
    planId = (await as(student).post('/api/plans', { name: 'Main plan', programCode: PROGRAM, cohortYear: 2030 }).expect(201)).body.id;
  });

  afterAll(async () => {
    if (db?.isInitialized) {
      await db.query('DELETE FROM users WHERE id = ANY($1)', [[student, admin].filter(Boolean).map((u) => u.userId)]);
      await db.query('DELETE FROM academic_calendar WHERE program_id = $1', [programId]);
      await db.query('DELETE FROM curriculums WHERE program_id = $1', [programId]);
      await db.query('DELETE FROM programs WHERE id = $1', [programId]);
      await db.query('DELETE FROM courses WHERE code = $1', [COURSE]);
    }
    await app?.close();
  });

  const PLAN = { name: 'Main plan', programCode: PROGRAM, cohortYear: 2030 };
  const ROW = { courseCode: 'CSC10001', courseName: 'Introduction to Programming', credits: 4, result: 'graded', grade: 8, term: { year: 2025, number: 1 } };
  const NEW_COURSE = { code: `${COURSE}X`, nameVi: 'Học phần', credits: 3 };
  const GROUP = { name: 'Nhóm khác', kind: 'elective' };
  const EVENT = { academicYear: 2030, kind: 'other', startsOn: '2030-09-08', title: 'Ngày khác' };
  const URL = 'https://example.edu.vn/thong-bao';
  const signUp = (displayName: string) => http().post('/api/auth/sign-up').send({ email: `e2e-${randomUUID()}@example.com`, password: 'correct horse battery', displayName, acceptedTerms: true });
  const groups = () => `${cohortPath()}/requirement-groups`;
  const event = () => `${eventsPath()}/${eventId}`;

  const CASES: [string, () => request.Test, string][] = [
    ['POST /plans name (null)', () => as(student).post('/api/plans', { ...PLAN, name: 'My plan\u0000' }), NUL('name')],
    ['POST /plans name (length)', () => as(student).post('/api/plans', { ...PLAN, name: tooLong(100) }), LONG('name', 100)],
    ['POST /plans programCode (null)', () => as(student).post('/api/plans', { ...PLAN, programCode: `${PROGRAM}\u0000` }), NUL('programCode')],
    ['PATCH /plans/{id} name (null)', () => as(student).patch(`/api/plans/${planId}`, { name: 'a\u0000b' }), NUL('name')],
    ['PATCH /plans/{id} name (length)', () => as(student).patch(`/api/plans/${planId}`, { name: tooLong(100) }), LONG('name', 100)],
    ['POST /plans/{id}/duplicate name (null)', () => as(student).post(`/api/plans/${planId}/duplicate`, { name: '\u0000' }), NUL('name')],
    ['POST /plans/{id}/duplicate name (length)', () => as(student).post(`/api/plans/${planId}/duplicate`, { name: tooLong(100) }), LONG('name', 100)],
    ['PUT /users/me/transcript courseName (null)', () => as(student).put('/api/users/me/transcript', { rows: [{ ...ROW, courseName: 'Intro\u0000' }] }), NUL('rows.0.courseName')],
    ['PUT /users/me/transcript courseName (length)', () => as(student).put('/api/users/me/transcript', { rows: [{ ...ROW, courseName: tooLong(255) }] }), LONG('rows.0.courseName', 255)],
    ['POST /auth/sign-up displayName (null)', () => signUp('Test\u0000Student'), NUL('displayName')],
    ['POST /auth/sign-up displayName (length)', () => signUp(tooLong(100)), LONG('displayName', 100)],
    ['GET /academic-calendar?program= (null)', () => as(student).get(`/api/academic-calendar?program=${PROGRAM}%00`), NUL('program')],
    ['POST /admin/catalog/courses nameVi (null)', () => as(admin).post('/api/admin/catalog/courses', { ...NEW_COURSE, nameVi: 'Học\u0000phần' }), NUL('nameVi')],
    ['POST /admin/catalog/courses nameEn (length)', () => as(admin).post('/api/admin/catalog/courses', { ...NEW_COURSE, nameEn: tooLong(255) }), LONG('nameEn', 255)],
    ['PATCH /admin/catalog/courses/{code} nameVi (null)', () => as(admin).patch(`/api/admin/catalog/courses/${COURSE}`, { nameVi: '\u0000' }), NUL('nameVi')],
    ['PATCH /admin/catalog/courses/{code} nameEn (length)', () => as(admin).patch(`/api/admin/catalog/courses/${COURSE}`, { nameEn: tooLong(255) }), LONG('nameEn', 255)],
    ['POST requirement-groups name (null)', () => as(admin).post(groups(), { ...GROUP, name: 'Nhóm\u0000' }), NUL('name')],
    ['POST requirement-groups name (length)', () => as(admin).post(groups(), { ...GROUP, name: tooLong(255) }), LONG('name', 255)],
    ['POST requirement-groups officialNotes (null)', () => as(admin).post(groups(), { ...GROUP, officialNotes: 'a\u0000b' }), NUL('officialNotes')],
    ['PATCH requirement-groups/{id} name (null)', () => as(admin).patch(`${groups()}/${groupId}`, { name: '\u0000' }), NUL('name')],
    ['PATCH requirement-groups/{id} name (length)', () => as(admin).patch(`${groups()}/${groupId}`, { name: tooLong(255) }), LONG('name', 255)],
    ['PATCH requirement-groups/{id} officialNotes (null)', () => as(admin).patch(`${groups()}/${groupId}`, { officialNotes: '\u0000' }), NUL('officialNotes')],
    ['POST calendar-events title (null)', () => as(admin).post(eventsPath(), { ...EVENT, title: 'Ngày\u0000' }), NUL('title')],
    ['POST calendar-events title (length)', () => as(admin).post(eventsPath(), { ...EVENT, title: tooLong(255) }), LONG('title', 255)],
    ['POST calendar-events titleEn (null)', () => as(admin).post(eventsPath(), { ...EVENT, titleEn: 'Day\u0000' }), NUL('titleEn')],
    ['POST calendar-events titleEn (length)', () => as(admin).post(eventsPath(), { ...EVENT, titleEn: tooLong(255) }), LONG('titleEn', 255)],
    ['POST calendar-events notes (null)', () => as(admin).post(eventsPath(), { ...EVENT, notes: 'a\u0000b' }), NUL('notes')],
    ['POST calendar-events sourceUrl (null)', () => as(admin).post(eventsPath(), { ...EVENT, sourceUrl: `${URL}\u0000` }), NUL('sourceUrl')],
    ['PATCH calendar-events/{id} title (null)', () => as(admin).patch(event(), { title: '\u0000' }), NUL('title')],
    ['PATCH calendar-events/{id} title (length)', () => as(admin).patch(event(), { title: tooLong(255) }), LONG('title', 255)],
    ['PATCH calendar-events/{id} titleEn (null)', () => as(admin).patch(event(), { titleEn: 'Day\u0000' }), NUL('titleEn')],
    ['PATCH calendar-events/{id} titleEn (length)', () => as(admin).patch(event(), { titleEn: tooLong(255) }), LONG('titleEn', 255)],
    ['PATCH calendar-events/{id} notes (null)', () => as(admin).patch(event(), { notes: '\u0000' }), NUL('notes')],
    ['PATCH calendar-events/{id} sourceUrl (null)', () => as(admin).patch(event(), { sourceUrl: `${URL}\u0000` }), NUL('sourceUrl')],
  ];

  it.each(CASES)('%s: 400, not 500', async (_route, send, message) => {
    const response = await send();
    expect([response.status, response.body.message]).toEqual([400, [message]]);
  });

  it('GET /programs/{program}/curricula/{cohort} with a null character in the program: 404, as for any unknown code', async () => {
    await as(student).get(`/api/programs/${PROGRAM}%00/curricula/2030`).expect(404);
  });

  it('and still store the longest value that fits', async () => {
    const longest = (max: number) => 'x'.repeat(max - 2) + '\u{1F600}\u{1F600}';
    expect((await as(student).patch(`/api/plans/${planId}`, { name: longest(100) }).expect(200)).body.name).toBe(longest(100));
    expect((await as(admin).patch(`${eventsPath()}/${eventId}`, { title: longest(255) }).expect(200)).body.title).toBe(longest(255));
  });
});
