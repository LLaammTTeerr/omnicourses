import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Account, authed, grantGlobal, grantProgram, runSuffix } from './support/admin.js';
import { bootApp } from './support/app.js';
import { offerAlso } from './support/offer.js';
import { signedInUser } from './support/users.js';


function client(app: () => INestApplication) {
  const http = () => request(app().getHttpServer());
  return { http, as: authed(app) };
}

async function removeFixture(db: DataSource, programPrefix: string, users: Account[], coursePrefix?: string): Promise<void> {
  await db.query('DELETE FROM users WHERE id = ANY($1)', [users.map((u) => u.userId)]);
  const programs = 'SELECT id FROM programs WHERE code LIKE $1';
  await db.query(`DELETE FROM program_admin_grants WHERE program_id IN (${programs})`, [`${programPrefix}%`]);
  await db.query(`DELETE FROM curriculums WHERE program_id IN (${programs})`, [`${programPrefix}%`]);
  await db.query('DELETE FROM programs WHERE code LIKE $1', [`${programPrefix}%`]);
  if (coursePrefix) await db.query('DELETE FROM courses WHERE code LIKE $1', [`${coursePrefix}%`]);
}

const programsPath = '/api/admin/programs';
const programPath = (program: string) => `${programsPath}/${program}`;
const cohortsPath = (program: string) => `${programPath(program)}/cohorts`;
const cohortPath = (program: string, curriculum: string) => `${cohortsPath(program)}/${curriculum}`;

describe('Program and cohort administration API (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  const { http, as } = client(() => app);

  const suffix = runSuffix();
  const P = `ZZP-${suffix}`;
  const [codeA, codeB] = [`${P}-A`, `${P}-B`];
  const users: Account[] = [];
  let manager: Account;
  let adminA: Account;
  let adminB: Account;
  let maintainer: Account;
  let stranger: Account;
  let programA: string;
  let programB: string;
  let a2024: string;
  let a2025: string;
  let b2024: string;

  const programRows = () => db.query('SELECT * FROM programs WHERE code LIKE $1 ORDER BY code', [`${P}%`]) as Promise<Record<string, unknown>[]>;
  const cohortRows = () =>
    db.query('SELECT c.* FROM curriculums c JOIN programs p ON p.id = c.program_id WHERE p.code LIKE $1 ORDER BY p.code, c.cohort_year', [`${P}%`]) as Promise<Record<string, unknown>[]>;
  const stored = async () => ({ programs: await programRows(), cohorts: await cohortRows() });
  const grantsOn = (program: string) => db.query('SELECT user_id FROM program_admin_grants WHERE program_id = $1', [program]) as Promise<{ user_id: string }[]>;
  const refusal = (response: request.Response) => [response.status, response.body.code, response.body.permission];

  beforeAll(async () => {
    app = await bootApp();
    db = app.get(DataSource);
    offerAlso(app, codeB, [2024]);
    [manager, adminA, adminB, maintainer, stranger] = await Promise.all([signedInUser(app), signedInUser(app), signedInUser(app), signedInUser(app), signedInUser(app)]);
    users.push(manager, adminA, adminB, maintainer, stranger);
    await grantGlobal(db, manager.userId, 'access_manager');
    await grantGlobal(db, maintainer.userId, 'catalog_maintainer');
  });

  afterAll(async () => {
    if (db?.isInitialized) await removeFixture(db, P, users, `ZZP${suffix}`);
    await app?.close();
  });

  it('lets only an access manager create a program, and gives the creator no grant on it', async () => {
    const body = { code: ` ${codeA.toLowerCase()} `, nameVi: ' Chương trình thử A ' };
    for (const account of [stranger, adminA, maintainer]) {
      expect(refusal(await as(account).post(programsPath, body))).toEqual([403, 'permission_required', 'access_manager']);
    }
    expect(await programRows()).toEqual([]);

    const created = await as(manager).post(programsPath, body).expect(201);
    expect(created.body).toEqual({ id: expect.any(String), code: codeA, nameVi: 'Chương trình thử A', nameEn: null, faculty: null, trainingType: null, updatedAt: expect.any(String) });
    programA = created.body.id;
    expect(await programRows()).toMatchObject([{ id: programA, code: codeA, name_vi: 'Chương trình thử A', name_en: null, faculty: null, training_type: null }]);

    expect(await grantsOn(programA)).toEqual([]);
    expect((await as(manager).get(programsPath).expect(200)).body).toEqual({ programs: [] });
    const before = await stored();
    const refused = [
      await as(manager).patch(programPath(programA), { nameVi: 'Tên khác' }),
      await as(manager).post(cohortsPath(programA), { cohortYear: 2024, code: `${codeA}-2024`, nameVi: 'Khóa thử' }),
      await as(manager).get(cohortsPath(programA)),
    ];
    for (const response of refused) expect(refusal(response)).toEqual([403, 'permission_required', 'program_admin']);
    expect(await stored()).toEqual(before);

    const { body: access } = await as(manager).get('/api/admin/access/programs').expect(200);
    expect(access.programs).toContainEqual({ id: programA, code: codeA, nameVi: 'Chương trình thử A' });
    await as(manager).put(`/api/admin/access/users/${adminA.userId}/programs/${programA}`).expect(200);
    expect(await grantsOn(programA)).toEqual([{ user_id: adminA.userId }]);
    const edited = await as(adminA).patch(programPath(programA), { nameEn: ' Trial Program A ', faculty: 'Khoa thử' }).expect(200);
    expect(edited.body).toEqual({ id: programA, code: codeA, nameVi: 'Chương trình thử A', nameEn: 'Trial Program A', faculty: 'Khoa thử', trainingType: null, updatedAt: expect.any(String) });
    expect(new Date(edited.body.updatedAt).getTime()).toBeGreaterThan(new Date(created.body.updatedAt).getTime());
    expect((await as(adminA).get(programsPath).expect(200)).body).toEqual({ programs: [{ id: programA, code: codeA, nameVi: 'Chương trình thử A', curricula: [] }] });
    expect(refusal(await as(adminA).post(programsPath, { code: codeB, nameVi: 'Chương trình thử B' }))).toEqual([403, 'permission_required', 'access_manager']);
  });

  it('refuses every new route without a token', async () => {
    const cohort = cohortPath(programA, randomUUID());
    const refused = [
      await http().post(programsPath).send({ code: `${P}-X`, nameVi: 'x' }),
      await http().patch(programPath(programA)).send({ nameVi: 'x' }),
      await http().get(cohortsPath(programA)),
      await http().post(cohortsPath(programA)).send({ cohortYear: 2024, code: `${P}-X-2024`, nameVi: 'x' }),
      await http().get(cohort),
      await http().patch(cohort).send({ nameVi: 'x' }),
    ];
    expect(refused.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401]);
  });

  it('refuses a duplicate program code and saves nothing, also when two requests race', async () => {
    const before = await programRows();
    for (const code of [codeA, codeA.toLowerCase(), ` ${codeA} `]) {
      const response = await as(manager).post(programsPath, { code, nameVi: 'Chương trình trùng mã' });
      expect([response.status, response.body.code]).toEqual([409, 'duplicate_code']);
    }
    expect(await programRows()).toEqual(before);

    const racing = await Promise.all([1, 2].map((n) => as(manager).post(programsPath, { code: codeB, nameVi: `Chương trình thử B ${n}` })));
    expect(racing.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(racing.find((response) => response.status === 409)!.body.code).toBe('duplicate_code');
    const rows = await programRows();
    expect(rows.map((r) => r.code)).toEqual([codeA, codeB]);
    programB = rows[1].id as string;
    expect(racing.find((response) => response.status === 201)!.body).toMatchObject({ id: programB, code: codeB, nameVi: rows[1].name_vi });
    await grantProgram(db, adminB.userId, programB);
  });

  it('edits only the details of a program: the code, the training type and unknown fields are refused, not ignored', async () => {
    const before = await programRows();
    const bad = [
      await as(adminA).patch(programPath(programA), { code: `${P}-C` }),
      await as(adminA).patch(programPath(programA), { nameVi: 'Tên khác', code: codeA }),
      await as(adminA).patch(programPath(programA), { id: programB }),
      await as(adminA).patch(programPath(programA), { trainingType: 'standard' }),
      await as(adminA).patch(programPath(programA), { nameVi: '  ' }),
      await as(adminA).patch(programPath(programA), { nameVi: null }),
      await as(adminA).patch(programPath(programA), { faculty: 'x'.repeat(101) }),
      await as(adminA).patch(programPath('not-a-uuid'), { nameVi: 'x' }),
      await as(manager).post(programsPath, { code: `${P}-C`, nameVi: 'x', trainingType: 'standard' }),
      await as(manager).post(programsPath, { code: `${P} C`, nameVi: 'x' }),
      await as(manager).post(programsPath, { code: `${P}_C`, nameVi: 'x' }),
      await as(manager).post(programsPath, { code: `${P}-${'C'.repeat(50)}`, nameVi: 'x' }),
      await as(manager).post(programsPath, { code: `${P}-C` }),
    ];
    for (const response of bad) expect([response.status, response.body.code]).toEqual([400, 'validation_failed']);
    expect(bad[0].body.message).toContain('code: property code should not exist');
    expect(bad[3].body.message).toContain('trainingType: property trainingType should not exist');
    expect(await programRows()).toEqual(before);

    expect((await as(adminA).patch(programPath(programA), {}).expect(200)).body).toMatchObject({ id: programA, nameEn: 'Trial Program A' });
    expect((await as(adminA).patch(programPath(programA), { nameVi: 'Chương trình thử A', faculty: 'Khoa thử' }).expect(200)).body).toMatchObject({ id: programA });
    expect(await programRows()).toEqual(before);
    const cleared = await as(adminA).patch(programPath(programA), { nameVi: 'Chương trình thử A (sửa)', nameEn: ' ', faculty: null }).expect(200);
    expect(cleared.body).toMatchObject({ code: codeA, nameVi: 'Chương trình thử A (sửa)', nameEn: null, faculty: null, trainingType: null });
    expect(await programRows()).toMatchObject([{ code: codeA, name_vi: 'Chương trình thử A (sửa)', name_en: null, faculty: null, training_type: null }, { code: codeB }]);
  });

  it('adds cohorts to a program, each one empty, and lists and reads them', async () => {
    expect((await as(adminA).get(cohortsPath(programA)).expect(200)).body).toEqual({ cohorts: [] });
    const second = await as(adminA).post(cohortsPath(programA), { cohortYear: 2025, code: `${codeA}-2025`, nameVi: 'Khóa thử 2025', nameEn: ' Trial 2025 ', language: 'en' }).expect(201);
    a2025 = second.body.id;
    expect(second.body).toEqual({ id: a2025, programId: programA, cohortYear: 2025, code: `${codeA}-2025`, nameVi: 'Khóa thử 2025', nameEn: 'Trial 2025', language: 'en', totalCreditsMin: null, updatedAt: expect.any(String) });
    const first = await as(adminA).post(cohortsPath(programA), { cohortYear: 2024, code: ` ${codeA.toLowerCase()}-2024`, nameVi: ' Khóa thử 2024 ' }).expect(201);
    a2024 = first.body.id;
    expect(first.body).toEqual({ id: a2024, programId: programA, cohortYear: 2024, code: `${codeA}-2024`, nameVi: 'Khóa thử 2024', nameEn: null, language: null, totalCreditsMin: null, updatedAt: expect.any(String) });

    expect((await as(adminA).get(cohortsPath(programA)).expect(200)).body).toEqual({ cohorts: [first.body, second.body] });
    expect((await as(adminA).get(cohortPath(programA, a2024)).expect(200)).body).toEqual(first.body);
    expect((await as(adminA).get(programsPath).expect(200)).body.programs[0].curricula).toEqual([
      { id: a2024, code: `${codeA}-2024`, cohortYear: 2024 },
      { id: a2025, code: `${codeA}-2025`, cohortYear: 2025 },
    ]);

    expect(await cohortRows()).toMatchObject([
      { id: a2024, program_id: programA, cohort_year: 2024, total_credits_min: null },
      { id: a2025, program_id: programA, cohort_year: 2025, total_credits_min: null },
    ]);
    for (const table of ['requirement_groups', 'course_prerequisite_lists', 'course_prerequisites', 'course_offering_terms', 'combined_minimums']) {
      expect([table, await db.query(`SELECT 1 FROM ${table} WHERE curriculum_id = ANY($1)`, [[a2024, a2025]])]).toEqual([table, []]);
    }
    const { body: read } = await as(stranger).get(`/api/programs/${codeA}/curricula/2024`).expect(200);
    expect(read).toMatchObject({ id: a2024, code: `${codeA}-2024`, cohortYear: 2024, totalCreditsMin: null, requirementGroups: [], program: { code: codeA, trainingType: null } });
  });

  it('refuses a duplicate cohort year and a duplicate curriculum code, and saves nothing', async () => {
    const before = await cohortRows();
    const sameYear = await as(adminA).post(cohortsPath(programA), { cohortYear: 2024, code: `${codeA}-2024-BIS`, nameVi: 'Khóa trùng năm' });
    expect([sameYear.status, sameYear.body.code]).toEqual([409, 'duplicate_cohort']);
    const sameCode = await as(adminA).post(cohortsPath(programA), { cohortYear: 2026, code: `${codeA.toLowerCase()}-2024`, nameVi: 'Khóa trùng mã' });
    expect([sameCode.status, sameCode.body.code]).toEqual([409, 'duplicate_code']);
    const otherProgram = await as(adminB).post(cohortsPath(programB), { cohortYear: 2026, code: `${codeA}-2025`, nameVi: 'Khóa trùng mã' });
    expect([otherProgram.status, otherProgram.body.code]).toEqual([409, 'duplicate_code']);
    expect(await cohortRows()).toEqual(before);

    b2024 = (await as(adminB).post(cohortsPath(programB), { cohortYear: 2024, code: `${codeB}-2024`, nameVi: 'Khóa thử B 2024' }).expect(201)).body.id;
    expect((await cohortRows()).map((c) => [c.program_id, c.cohort_year])).toEqual([[programA, 2024], [programA, 2025], [programB, 2024]]);
  });

  it('refuses a change of a cohort identifier, the gated credit total and a year outside 2000 to 2100', async () => {
    const before = await cohortRows();
    const cohort = { code: `${codeA}-2027`, nameVi: 'Khóa thử' };
    const bad = [
      await as(adminA).patch(cohortPath(programA, a2024), { cohortYear: 2030 }),
      await as(adminA).patch(cohortPath(programA, a2024), { programId: programB }),
      await as(adminA).patch(cohortPath(programA, a2024), { code: `${codeA}-2030` }),
      await as(adminA).patch(cohortPath(programA, a2024), { nameVi: 'Tên khác', cohortYear: 2024 }),
      await as(adminA).patch(cohortPath(programA, a2024), { totalCreditsMin: 120 }),
      await as(adminA).patch(cohortPath(programA, a2024), { totalCreditsMin: null }),
      await as(adminA).patch(cohortPath(programA, a2024), { nameVi: '' }),
      await as(adminA).patch(cohortPath(programA, a2024), { language: 'x'.repeat(11) }),
      await as(adminA).patch(cohortPath(programA, 'not-a-uuid'), { nameVi: 'x' }),
      await as(adminA).post(cohortsPath(programA), { ...cohort, cohortYear: 2027, totalCreditsMin: 120 }),
      await as(adminA).post(cohortsPath(programA), { ...cohort, cohortYear: 2027, programId: programB }),
      await as(adminA).post(cohortsPath(programA), { ...cohort, cohortYear: 1999 }),
      await as(adminA).post(cohortsPath(programA), { ...cohort, cohortYear: 2101 }),
      await as(adminA).post(cohortsPath(programA), { ...cohort, cohortYear: 2027.5 }),
      await as(adminA).post(cohortsPath(programA), { ...cohort, cohortYear: '2027' }),
      await as(adminA).post(cohortsPath(programA), cohort),
      await as(adminA).post(cohortsPath(programA), { cohortYear: 2027, code: `${codeA} 2027`, nameVi: 'Khóa thử' }),
    ];
    for (const response of bad) expect([response.status, response.body.code]).toEqual([400, 'validation_failed']);
    expect(bad[0].body.message).toContain('cohortYear: property cohortYear should not exist');
    expect(bad[4].body.message).toContain('totalCreditsMin: property totalCreditsMin should not exist');
    expect(await cohortRows()).toEqual(before);

    await db.query('UPDATE curriculums SET total_credits_min = 120 WHERE id = $1', [a2024]);
    const edited = await as(adminA).patch(cohortPath(programA, a2024), { nameVi: 'Khóa thử 2024 (sửa)', nameEn: 'Trial 2024', language: ' vi ' }).expect(200);
    expect(edited.body).toEqual({ id: a2024, programId: programA, cohortYear: 2024, code: `${codeA}-2024`, nameVi: 'Khóa thử 2024 (sửa)', nameEn: 'Trial 2024', language: 'vi', totalCreditsMin: 120, updatedAt: expect.any(String) });
    expect(new Date(edited.body.updatedAt).getTime()).toBeGreaterThan((before[0].updated_at as Date).getTime());
    const after = await cohortRows();
    expect(after[0]).toMatchObject({ id: a2024, program_id: programA, cohort_year: 2024, code: `${codeA}-2024`, name_vi: 'Khóa thử 2024 (sửa)', name_en: 'Trial 2024', language: 'vi', total_credits_min: 120 });
    expect(after.slice(1)).toEqual(before.slice(1));
    expect((await as(adminA).patch(cohortPath(programA, a2025), { language: '' }).expect(200)).body).toMatchObject({ id: a2025, nameEn: 'Trial 2025', language: null });
  });

  it("keeps a program's administrator out of another program, also through substituted IDs", async () => {
    const before = await stored();
    const direct = [
      await as(adminA).patch(programPath(programB), { nameVi: 'Chiếm quyền' }),
      await as(adminA).get(cohortsPath(programB)),
      await as(adminA).post(cohortsPath(programB), { cohortYear: 2030, code: `${codeB}-2030`, nameVi: 'Chiếm quyền' }),
      await as(adminA).get(cohortPath(programB, b2024)),
      await as(adminA).patch(cohortPath(programB, b2024), { nameVi: 'Chiếm quyền' }),
      await as(adminA).get(cohortsPath(randomUUID())),
      await as(stranger).get(cohortPath(programA, a2024)),
      await as(maintainer).patch(cohortPath(programA, a2024), { nameVi: 'Chiếm quyền' }),
    ];
    for (const response of direct) expect(refusal(response)).toEqual([403, 'permission_required', 'program_admin']);
    for (const res of direct) expect(JSON.stringify(res.body)).not.toContain(codeB);

    const substituted = [
      await as(adminA).get(cohortPath(programA, b2024)),
      await as(adminA).patch(cohortPath(programA, b2024), { nameVi: 'Chiếm quyền' }),
      await as(adminA).patch(cohortPath(programA, randomUUID()), { nameVi: 'Chiếm quyền' }),
      await as(adminB).patch(cohortPath(programB, a2024), { nameVi: 'Chiếm quyền' }),
    ];
    for (const res of substituted) expect([res.status, res.body.code, res.body.message]).toEqual([404, 'not_found', 'No such cohort in this program']);
    expect((await as(adminA).patch(cohortPath(programA, a2024), { programId: programB }).expect(400)).body.code).toBe('validation_failed');
    expect(await stored()).toEqual(before);
  });

  it('serves a program entered through the API with no credit cap and no credit total, never a guessed one', async () => {
    const course = `ZZP${suffix}1`;
    await as(maintainer).post('/api/admin/catalog/courses', { code: course, nameVi: `Học phần ${course}`, credits: 4 }).expect(201);
    const { id: group } = (await as(adminB).post(`${cohortPath(programB, b2024)}/requirement-groups`, { name: 'zz bắt buộc', kind: 'compulsory' }).expect(201)).body;
    await as(adminB).put(`${cohortPath(programB, b2024)}/requirement-groups/${group}/courses/${course}`).expect(204);
    const student = await signedInUser(app);
    users.push(student);
    await db.query('INSERT INTO onboarding_answers (user_id, program_code, cohort_year, finished_at) VALUES ($1, $2, 2024, now())', [student.userId, codeB]);
    await as(student)
      .put('/api/users/me/transcript', { rows: [{ courseCode: course, courseName: 'Synthetic', credits: 4, result: 'graded', grade: 8, term: { year: 2024, number: 1 } }] })
      .expect(200);
    const plan = await as(student)
      .post('/api/plans', { name: 'zz-e2e', programCode: codeB, cohortYear: 2024, terms: [{ term: { year: 2031, number: 1 }, placements: [{ kind: 'course', courseCode: course }] }] })
      .expect(201);

    const { body: issues } = await as(student).get(`/api/plans/${plan.body.id}/issues`).expect(200);
    expect(issues).toMatchObject({ trainingType: null, terms: [{ term: { year: 2031, number: 1 }, kind: null, credits: 4, caps: null }], coverage: { totalRequired: null, totalRemaining: null } });
    expect((issues.issues as { code: string; kind: string }[]).filter((i) => i.code.startsWith('caps') || i.code.startsWith('load')).map((i) => [i.code, i.kind])).toEqual([['caps_not_checked', 'unknown']]);
    const { body: audit } = await as(student).get('/api/users/me/audit').expect(200);
    expect(audit).toMatchObject({ programCode: codeB, trainingType: null, curriculumCode: `${codeB}-2024`, credits: { towardTotal: 4, totalRequired: null, remaining: null } });
    expect(audit.terms).toMatchObject([{ kind: null, caps: null, capViolations: [] }]);
    expect(audit.groups).toMatchObject([{ id: group, requiredCredits: null, remainingCredits: null }]);
    expect((audit.graduation.notChecked as { id: string }[]).map((c) => c.id)).toContain('total_credits');
  });

  it('blocks the next program or cohort write once the grant is revoked', async () => {
    await as(adminA).patch(cohortPath(programA, a2025), { nameEn: 'Trial 2025 (edited)' }).expect(200);
    const before = await stored();
    await as(manager).delete(`/api/admin/access/users/${adminA.userId}/programs/${programA}`).expect(200);
    const refused = [
      await as(adminA).patch(programPath(programA), { nameVi: 'Sau khi thu hồi' }),
      await as(adminA).post(cohortsPath(programA), { cohortYear: 2028, code: `${codeA}-2028`, nameVi: 'Sau khi thu hồi' }),
      await as(adminA).patch(cohortPath(programA, a2025), { nameVi: 'Sau khi thu hồi' }),
      await as(adminA).get(cohortsPath(programA)),
    ];
    for (const response of refused) expect(refusal(response)).toEqual([403, 'permission_required', 'program_admin']);
    expect(await stored()).toEqual(before);
  });
});

describe('Program and cohort routes: an empty cohort, races, path IDs and stored text (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  const { as } = client(() => app);

  const P = `ZZQ-${runSuffix()}`;
  const [codeA, codeB] = [`${P}-A`, `${P}-B`];
  const users: Account[] = [];
  let manager: Account;
  let adminA: Account;
  let adminB: Account;
  let programA: string;
  let programB: string;

  const programRows = () => db.query('SELECT * FROM programs WHERE code LIKE $1 ORDER BY code', [`${P}%`]) as Promise<Record<string, unknown>[]>;
  const cohortRows = () =>
    db.query('SELECT c.* FROM curriculums c JOIN programs p ON p.id = c.program_id WHERE p.code LIKE $1 ORDER BY p.code, c.cohort_year', [`${P}%`]) as Promise<Record<string, unknown>[]>;
  const grant = (user: Account, program: string) => grantProgram(db, user.userId, program);

  beforeAll(async () => {
    app = await bootApp();
    db = app.get(DataSource);
    [manager, adminA, adminB] = await Promise.all([signedInUser(app), signedInUser(app), signedInUser(app)]);
    users.push(manager, adminA, adminB);
    await grantGlobal(db, manager.userId, 'access_manager');
    programA = (await as(manager).post(programsPath, { code: codeA, nameVi: 'Chương trình thử A' }).expect(201)).body.id;
    programB = (await as(manager).post(programsPath, { code: codeB, nameVi: 'Chương trình thử B' }).expect(201)).body.id;
    await grant(adminA, programA);
    await grant(adminB, programB);
  });

  afterAll(async () => {
    if (db?.isInitialized) await removeFixture(db, P, users);
    await app?.close();
  });

  it('refuses a direct plan for an empty cohort onboarding does not offer (Project Lead, 25 November 2026), and an older plan there still reads graduation done (ADR 0011 open question 2)', async () => {
    const { id: curriculumId } = (await as(adminA).post(cohortsPath(programA), { cohortYear: 2026, code: `${codeA}-2026`, nameVi: 'Khóa thử trống' }).expect(201)).body;
    const student = await signedInUser(app);
    users.push(student);
    const refused = await as(student).post('/api/plans', { name: 'zz-e2e empty cohort', programCode: codeA, cohortYear: 2026 }).expect(400);
    expect(refused.body.message).toBe(`Onboarding does not offer ${codeA} 2026 to students`);
    expect(await db.query('SELECT id FROM plans WHERE user_id = $1', [student.userId])).toEqual([]);

    const [{ id }] = await db.query(`INSERT INTO plans (user_id, curriculum_id, name) VALUES ($1, $2, 'zz-e2e empty cohort') RETURNING id`, [student.userId, curriculumId]);
    const plan = await as(student).get(`/api/plans/${id}`).expect(200);
    expect(plan.body.curriculum).toMatchObject({ code: `${codeA}-2026`, programCode: codeA, cohortYear: 2026 });
    const { body: issues } = await as(student).get(`/api/plans/${id}/issues`).expect(200);
    expect(issues.coverage).toMatchObject({ groups: [], combinedMinimums: [], totalRequired: null, graduation: 'done' });
  });

  it('lets one of 20 concurrent cohort creations with one code, split across two programs, through', async () => {
    const callers = await Promise.all(Array.from({ length: 20 }, () => signedInUser(app)));
    users.push(...callers);
    await Promise.all(callers.map((caller, i) => grant(caller, i % 2 ? programB : programA)));
    const before = await cohortRows();
    const code = `${P}-RACE`;
    const racing = await Promise.all(
      callers.map((caller, i) => as(caller).post(cohortsPath(i % 2 ? programB : programA), { cohortYear: 2040 + i, code, nameVi: `Khóa đua ${i}` })),
    );

    expect(racing.map((response) => response.status).sort()).toEqual([201, ...Array<number>(19).fill(409)]);
    for (const res of racing.filter((r) => r.status === 409)) expect(res.body.code).toBe('duplicate_code');
    const added = (await cohortRows()).filter((row) => !before.some((b) => b.id === row.id));
    expect(added.map((row) => [row.code, row.id])).toEqual([[code, racing.find((response) => response.status === 201)!.body.id]]);
  });

  it('accepts a program or cohort ID in upper case from the holder of the grant, and still refuses others', async () => {
    const cohort = (await as(adminA).post(cohortsPath(programA.toUpperCase()), { cohortYear: 2027, code: `${codeA}-2027`, nameVi: 'Khóa thử 2027' }).expect(201)).body;
    expect(cohort).toMatchObject({ programId: programA, cohortYear: 2027 });
    const [PROGRAM, COHORT] = [programA.toUpperCase(), cohort.id.toUpperCase()];
    expect((await as(adminA).get(cohortsPath(PROGRAM)).expect(200)).body.cohorts).toContainEqual(cohort);
    expect((await as(adminA).get(cohortPath(PROGRAM, COHORT)).expect(200)).body).toEqual(cohort);
    expect((await as(adminA).patch(cohortPath(PROGRAM, COHORT), { nameEn: 'Trial 2027' }).expect(200)).body).toMatchObject({ id: cohort.id, nameEn: 'Trial 2027' });
    expect((await as(adminA).patch(programPath(PROGRAM), { faculty: 'Khoa thử' }).expect(200)).body).toMatchObject({ id: programA, faculty: 'Khoa thử' });
    const refused = await as(adminB).get(cohortPath(PROGRAM, COHORT));
    expect([refused.status, refused.body.code, refused.body.permission]).toEqual([403, 'permission_required', 'program_admin']);
  });

  it('refuses a null character and a value too long in code points with 400, never a 500, and saves nothing', async () => {
    const { id: stored } = (await as(adminA).post(cohortsPath(programA), { cohortYear: 2031, code: `${codeA}-2031`, nameVi: 'Khóa thử 2031' }).expect(201)).body;
    const before = { programs: await programRows(), cohorts: await cohortRows() };
    const tooLong = (max: number) => 'x'.repeat(max - 1) + '\u2764\uFE0F';
    const cohort = { cohortYear: 2030, code: `${codeA}-2030`, nameVi: 'Khóa thử' };
    const sent: [() => request.Test, string][] = [
      [() => as(manager).post(programsPath, { code: `${P}-C`, nameVi: 'a\u0000b' }), 'nameVi must not contain a null character (U+0000)'],
      [() => as(manager).post(programsPath, { code: `${P}-C`, nameVi: 'x', faculty: tooLong(100) }), 'faculty must be shorter than or equal to 100 characters'],
      [() => as(adminA).patch(programPath(programA), { nameEn: '\u0000' }), 'nameEn must not contain a null character (U+0000)'],
      [() => as(adminA).patch(programPath(programA), { nameVi: tooLong(255) }), 'nameVi must be shorter than or equal to 255 characters'],
      [() => as(adminA).post(cohortsPath(programA), { ...cohort, language: 'e\u0000n' }), 'language must not contain a null character (U+0000)'],
      [() => as(adminA).post(cohortsPath(programA), { ...cohort, nameEn: tooLong(255) }), 'nameEn must be shorter than or equal to 255 characters'],
      [() => as(adminA).patch(cohortPath(programA, stored), { language: tooLong(10) }), 'language must be shorter than or equal to 10 characters'],
      [() => as(adminA).patch(cohortPath(programA, stored), { nameVi: 'Khóa\u0000' }), 'nameVi must not contain a null character (U+0000)'],
    ];
    for (const [send, message] of sent) {
      const response = await send();
      expect([response.status, response.body.code, response.body.message]).toEqual([400, 'validation_failed', [message]]);
    }
    expect({ programs: await programRows(), cohorts: await cohortRows() }).toEqual(before);
    const longest = 'x'.repeat(253) + '\u{1F600}\u{1F600}';
    expect((await as(adminA).patch(programPath(programA), { nameEn: longest }).expect(200)).body.nameEn).toBe(longest);
  });
});

describe('Adding a cohort leaves the first cohort as it was (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  const { as } = client(() => app);

  const suffix = runSuffix();
  const P = `ZZQ-${suffix}`;
  const [C1, C2, C3, C4] = [1, 2, 3, 4].map((n) => `ZZQ${suffix}${n}`);
  const users: Account[] = [];
  let manager: Account;
  let admin: Account;
  let maintainer: Account;
  let student: Account;
  let program: string;
  let first: string;
  let second: string;
  let planId: string;
  let before: Awaited<ReturnType<typeof firstCohort>>;

  const cohort = (curriculum: string) => cohortPath(program, curriculum);
  const rows = (sql: string, params: unknown[]) => db.query(sql, params) as Promise<Record<string, unknown>[]>;
  const ofCurriculum = (table: string, order: string) => rows(`SELECT * FROM ${table} WHERE curriculum_id = $1 ORDER BY ${order}`, [first]);

  async function firstCohort() {
    return {
      stored: {
        program: await rows('SELECT * FROM programs WHERE id = $1', [program]),
        curriculum: await rows('SELECT * FROM curriculums WHERE id = $1', [first]),
        groups: await ofCurriculum('requirement_groups', 'name'),
        links: await rows(
          `SELECT g.name, l.* FROM requirement_group_courses l JOIN requirement_groups g ON g.id = l.requirement_group_id
           WHERE g.curriculum_id = $1 ORDER BY g.name, l.course_code`,
          [first],
        ),
        prerequisiteLists: await ofCurriculum('course_prerequisite_lists', 'course_code'),
        prerequisites: await ofCurriculum('course_prerequisites', 'course_code, prerequisite_code'),
        offeringTerms: await ofCurriculum('course_offering_terms', 'course_code, term_number'),
        courses: await rows('SELECT * FROM courses WHERE code = ANY($1) ORDER BY code', [[C1, C2, C3, C4]]),
        plans: await rows('SELECT * FROM plans WHERE user_id = $1', [student.userId]),
        placements: await rows('SELECT * FROM plan_placements WHERE user_id = $1 ORDER BY term_year, term_number, position', [student.userId]),
      },
      read: {
        curriculum: (await as(student).get(`/api/programs/${P}/curricula/2024`).expect(200)).body,
        plan: (await as(student).get(`/api/plans/${planId}`).expect(200)).body,
        issues: (await as(student).get(`/api/plans/${planId}/issues`).expect(200)).body,
        audit: (await as(student).get('/api/users/me/audit').expect(200)).body,
      },
    };
  }

  beforeAll(async () => {
    app = await bootApp();
    db = app.get(DataSource);
    offerAlso(app, P, [2024]);
    [manager, admin, maintainer, student] = await Promise.all([signedInUser(app), signedInUser(app), signedInUser(app), signedInUser(app)]);
    users.push(manager, admin, maintainer, student);
    await grantGlobal(db, manager.userId, 'access_manager');
    await grantGlobal(db, maintainer.userId, 'catalog_maintainer');

    program = (await as(manager).post(programsPath, { code: P, nameVi: 'Chương trình thử' }).expect(201)).body.id;
    await as(manager).put(`/api/admin/access/users/${admin.userId}/programs/${program}`).expect(200);
    first = (await as(admin).post(cohortsPath(program), { cohortYear: 2024, code: `${P}-2024`, nameVi: 'Khóa thử 2024', language: 'vi' }).expect(201)).body.id;
    for (const code of [C1, C2, C3, C4]) await as(maintainer).post('/api/admin/catalog/courses', { code, nameVi: `Học phần ${code}`, credits: 4 }).expect(201);
    const group = async (name: string, kind: string, codes: string[]) => {
      const { id } = (await as(admin).post(`${cohort(first)}/requirement-groups`, { name, kind }).expect(201)).body;
      for (const code of codes) await as(admin).put(`${cohort(first)}/requirement-groups/${id}/courses/${code}`).expect(204);
      return id as string;
    };
    const core = await group('zz bắt buộc', 'compulsory', [C1, C2]);
    const elective = await group('zz tự chọn', 'elective', [C3, C4]);
    await as(admin).put(`${cohort(first)}/courses/${C2}/prerequisites`, { prerequisites: [C1] }).expect(200);
    await as(admin).put(`${cohort(first)}/courses/${C3}/prerequisites`, { prerequisites: [] }).expect(200);
    await as(admin).put(`${cohort(first)}/courses/${C1}/offering-terms`, { terms: [1] }).expect(200);
    await as(admin).put(`${cohort(first)}/courses/${C2}/offering-terms`, { terms: [2] }).expect(200);
    await db.query(`UPDATE programs SET training_type = 'standard' WHERE id = $1`, [program]);
    await db.query('UPDATE curriculums SET total_credits_min = 12 WHERE id = $1', [first]);
    await db.query('UPDATE requirement_groups SET credits_total = 8 WHERE id = $1', [core]);
    await db.query('UPDATE requirement_groups SET credits_total_min = 4 WHERE id = $1', [elective]);

    await db.query('INSERT INTO onboarding_answers (user_id, program_code, cohort_year, finished_at) VALUES ($1, $2, 2024, now())', [student.userId, P]);
    const row = (courseCode: string, result: string, grade: number | null, year: number, number: number) => ({ courseCode, courseName: `Synthetic ${courseCode}`, credits: 4, result, grade, term: { year, number } });
    await as(student).put('/api/users/me/transcript', { rows: [row(C1, 'graded', 8, 2024, 1), row(C3, 'in_progress', null, 2024, 2)] }).expect(200);
    const plan = await as(student)
      .post('/api/plans', {
        name: 'zz-e2e',
        programCode: P,
        cohortYear: 2024,
        terms: [
          { term: { year: 2031, number: 1 }, placements: [{ kind: 'course', courseCode: C2 }] },
          { term: { year: 2031, number: 2 }, placements: [{ kind: 'course', courseCode: C4 }] },
        ],
      })
      .expect(201);
    planId = plan.body.id;
  });

  afterAll(async () => {
    if (db?.isInitialized) await removeFixture(db, P, users, `ZZQ${suffix}`);
    await app?.close();
  });

  it('starts from a first cohort with groups, links, rules, a saved plan and an audit', async () => {
    before = await firstCohort();
    const { stored, read } = before;
    expect([stored.groups.length, stored.links.length, stored.prerequisiteLists.length, stored.prerequisites.length, stored.offeringTerms.length]).toEqual([2, 4, 2, 1, 2]);
    expect([stored.plans.length, stored.placements.length]).toEqual([1, 2]);
    expect(stored.plans[0].curriculum_id).toBe(first);
    const courses = (read.curriculum.requirementGroups as { courses: { code: string; prerequisites: string[] | null; offeringTerms: number[] | null }[] }[]).flatMap((g) => g.courses);
    expect(Object.fromEntries(courses.map((c) => [c.code, [c.prerequisites, c.offeringTerms]]))).toEqual({ [C1]: [null, [1]], [C2]: [[C1], [2]], [C3]: [[], null], [C4]: [null, null] });
    expect(read.plan.curriculum).toEqual({ id: first, code: `${P}-2024`, programCode: P, cohortYear: 2024 });
    expect(read.audit).toMatchObject({ curriculumCode: `${P}-2024` });
    expect(JSON.stringify(read.audit)).toContain(C1);
    expect(JSON.stringify(read.issues)).toContain(C4);
  });

  it('adds a second cohort, empty, without changing one stored row or one answer of the first', async () => {
    const created = await as(admin).post(cohortsPath(program), { cohortYear: 2025, code: `${P}-2025`, nameVi: 'Khóa thử 2025' }).expect(201);
    second = created.body.id;
    expect(created.body).toMatchObject({ programId: program, cohortYear: 2025, totalCreditsMin: null });
    expect(await firstCohort()).toEqual(before);

    for (const table of ['requirement_groups', 'course_prerequisite_lists', 'course_prerequisites', 'course_offering_terms', 'combined_minimums']) {
      expect([table, await rows(`SELECT 1 FROM ${table} WHERE curriculum_id = $1`, [second])]).toEqual([table, []]);
    }
    const { body: read } = await as(student).get(`/api/programs/${P}/curricula/2025`).expect(200);
    expect(read).toMatchObject({ id: second, cohortYear: 2025, totalCreditsMin: null, requirementGroups: [] });
    const { body: list } = await as(student).get('/api/programs').expect(200);
    expect((list.programs as { code: string; cohortYears: number[] }[]).find((p) => p.code === P)!.cohortYears).toEqual([2024, 2025]);
  });

  it("enters the second cohort's own curriculum from the shared catalog, and the first still reads the same", async () => {
    const { id: group } = (await as(admin).post(`${cohort(second)}/requirement-groups`, { name: 'zz bắt buộc', kind: 'compulsory' }).expect(201)).body;
    for (const code of [C1, C4]) await as(admin).put(`${cohort(second)}/requirement-groups/${group}/courses/${code}`).expect(204);
    await as(admin).put(`${cohort(second)}/courses/${C1}/prerequisites`, { prerequisites: [C4] }).expect(200);
    await as(admin).put(`${cohort(second)}/courses/${C1}/offering-terms`, { terms: [3] }).expect(200);
    await as(admin).patch(cohort(second), { nameEn: 'Trial 2025', language: 'en' }).expect(200);
    expect(await firstCohort()).toEqual(before);

    expect(await rows('SELECT count(*)::int AS n FROM courses WHERE code = $1', [C1])).toEqual([{ n: 1 }]);
    const { body: course } = await as(student).get(`/api/courses/${C1}`).expect(200);
    expect((course.memberships as { cohortYear: number; requirementGroupName: string }[]).map((m) => [m.cohortYear, m.requirementGroupName])).toEqual([
      [2024, 'zz bắt buộc'],
      [2025, 'zz bắt buộc'],
    ]);
    const { body: read } = await as(student).get(`/api/programs/${P}/curricula/2025`).expect(200);
    expect(read.requirementGroups).toMatchObject([{ id: group, name: 'zz bắt buộc', courses: [{ code: C1, prerequisites: [C4], offeringTerms: [3] }, { code: C4, prerequisites: null, offeringTerms: null }] }]);
  });
});
