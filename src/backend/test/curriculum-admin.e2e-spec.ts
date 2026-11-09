import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccessAdminService, bootstrapAccessManager } from '../src/curriculum-admin/access-admin.service.js';
import { AdminWriteService } from '../src/curriculum-admin/admin-write.service.js';
import { CATALOG_DECISIONS, CURRICULUM_SEEDS } from '../src/database/seeds/index.js';
import { seedCurricula } from '../src/database/seeds/seed-curricula.js';
import { bootApp } from './support/app.js';
import { privateSchema } from './support/schema.js';
import { signedInUser } from './support/users.js';

const NEW_TABLES = ['program_admin_grants', 'global_admin_grants', 'course_prerequisite_lists', 'course_prerequisites', 'course_offering_terms'];

interface ReadCourse {
  code: string;
  credits: number;
  prerequisites: string[] | null;
  offeringTerms: number[] | null;
}
interface ReadGroup {
  id: string;
  name: string;
  courses: ReadCourse[];
}

// Synthetic courses and groups only (AGENTS.md hard rule 3), unique per run and removed in
// afterAll, because e2e files share one database with the seeded curricula.
describe('Curriculum administration API (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (path: string) => http().get(path).set('Authorization', `Bearer ${token}`),
    post: (path: string, body: object = {}) => http().post(path).set('Authorization', `Bearer ${token}`).send(body),
    put: (path: string, body: object = {}) => http().put(path).set('Authorization', `Bearer ${token}`).send(body),
    patch: (path: string, body: object = {}) => http().patch(path).set('Authorization', `Bearer ${token}`).send(body),
    delete: (path: string) => http().delete(path).set('Authorization', `Bearer ${token}`),
  });

  const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  const [A, B, C, D, E] = ['A', 'B', 'C', 'D', 'E'].map((x) => `ZZ${suffix}${x}`);
  const groupName = `zz-e2e ${suffix}`;

  let admin: { token: string; userId: string };
  let stranger: { token: string; userId: string };
  let manager: { token: string; userId: string };
  let maintainer: { token: string; userId: string };
  let apcs: string;
  let clc: string;
  let apcs2024: string;
  let apcs2025: string;
  let clcCurriculum: string;
  let clcCode: string;
  let group2024: string;
  let group2025: string;
  const cohort = (program: string, curriculum: string) => `/api/admin/programs/${program}/cohorts/${curriculum}`;
  const groupPath = () => `${cohort(apcs, apcs2024)}/requirement-groups/${group2024}`;
  const prereqs = (code: string) => `${cohort(apcs, apcs2024)}/courses/${code}/prerequisites`;
  const offerings = (code: string) => `${cohort(apcs, apcs2024)}/courses/${code}/offering-terms`;
  const readGroup = async (program: string, year: number, name: string): Promise<ReadGroup> => {
    const { body } = await as(admin.token).get(`/api/programs/${program}/curricula/${year}`).expect(200);
    return (body.requirementGroups as ReadGroup[]).find((g) => g.name === name)!;
  };

  beforeAll(async () => {
    app = await bootApp();
    db = app.get(DataSource);
    await seedCurricula(db, CURRICULUM_SEEDS, CATALOG_DECISIONS);
    [admin, stranger, manager, maintainer] = await Promise.all([signedInUser(app), signedInUser(app), signedInUser(app), signedInUser(app)]);

    const id = async (sql: string, params: unknown[]) => ((await db.query(sql, params)) as { id: string }[])[0].id;
    apcs = await id(`SELECT id FROM programs WHERE code = 'APCS'`, []);
    apcs2024 = await id('SELECT id FROM curriculums WHERE program_id = $1 AND cohort_year = 2024', [apcs]);
    apcs2025 = await id('SELECT id FROM curriculums WHERE program_id = $1 AND cohort_year = 2025', [apcs]);
    [{ id: clc, code: clcCode }] = await db.query(`SELECT id, code FROM programs WHERE code LIKE 'CNTT-TCTA-%' ORDER BY code LIMIT 1`);
    clcCurriculum = await id('SELECT id FROM curriculums WHERE program_id = $1', [clc]);

    // The fixture's access manager; the bootstrap command is tested on its own schema below.
    await db.query(`INSERT INTO global_admin_grants (user_id, permission) VALUES ($1, 'access_manager')`, [manager.userId]);
    await as(manager.token).put(`/api/admin/access/users/${admin.userId}/programs/${apcs}`).expect(200);
    await as(manager.token).put(`/api/admin/access/users/${maintainer.userId}/global/catalog_maintainer`).expect(200);

    for (const code of [A, B, C, D, E]) await as(maintainer.token).post('/api/admin/catalog/courses', { code: code.toLowerCase(), nameVi: `Học phần ${code}`, credits: 4 }).expect(201);
    group2024 = (await as(admin.token).post(`${cohort(apcs, apcs2024)}/requirement-groups`, { name: groupName, kind: 'elective' }).expect(201)).body.id;
    group2025 = (await as(admin.token).post(`${cohort(apcs, apcs2025)}/requirement-groups`, { name: groupName, kind: 'elective' }).expect(201)).body.id;
    for (const code of [A, B, C, D]) await as(admin.token).put(`${groupPath()}/courses/${code}`).expect(204);
  });

  afterAll(async () => {
    if (db?.isInitialized) {
      const codes = [A, B, C, D, E];
      await db.query('DELETE FROM course_prerequisite_lists WHERE course_code = ANY($1)', [codes]);
      await db.query('DELETE FROM course_offering_terms WHERE course_code = ANY($1)', [codes]);
      await db.query('DELETE FROM requirement_groups WHERE name = $1', [groupName]);
      await db.query('DELETE FROM courses WHERE code = ANY($1)', [codes]);
      await db.query('DELETE FROM program_admin_grants WHERE user_id = ANY($1)', [[admin, stranger, manager, maintainer].map((u) => u.userId)]);
      await db.query('DELETE FROM global_admin_grants WHERE user_id = ANY($1)', [[admin, stranger, manager, maintainer].map((u) => u.userId)]);
    }
    await app?.close();
  });

  it('maps the new tables exactly as migration 1794230000000 creates them', async () => {
    const { upQueries } = await db.driver.createSchemaBuilder().log();
    expect(upQueries.map((q) => q.query).filter((q) => NEW_TABLES.some((t) => q.includes(`"${t}"`)))).toEqual([]);
  });

  it('refuses the admin routes without a token', async () => {
    await http().get('/api/admin/programs').expect(401);
    await http().put(prereqs(A)).send({ prerequisites: [] }).expect(401);
    await http().post('/api/admin/catalog/courses').send({}).expect(401);
  });

  it('gives a signed-in user without a grant 403 on every kind of write, and no program to edit', async () => {
    const s = as(stranger.token);
    expect((await s.get('/api/admin/programs').expect(200)).body).toEqual({ programs: [] });
    const refused = [
      await s.post(`${cohort(apcs, apcs2024)}/requirement-groups`, { name: `${groupName} x`, kind: 'elective' }),
      await s.put(prereqs(B), { prerequisites: [] }),
      await s.put(offerings(B), { terms: [1] }),
      await s.put(`${groupPath()}/courses/${E}`),
      await s.delete(groupPath()),
    ];
    for (const res of refused) expect([res.status, res.body.code, res.body.permission]).toEqual([403, 'permission_required', 'program_admin']);
    const catalog = await s.patch(`/api/admin/catalog/courses/${E}`, { credits: 2 });
    expect([catalog.status, catalog.body.permission]).toEqual([403, 'catalog_maintainer']);
    const access = await s.put(`/api/admin/access/users/${stranger.userId}/programs/${apcs}`);
    expect([access.status, access.body.permission]).toEqual([403, 'access_manager']);
  });

  it('lets the APCS administrator list APCS with its cohorts, and not write CLC, even through nested IDs', async () => {
    const { body } = await as(admin.token).get('/api/admin/programs').expect(200);
    expect(body.programs).toEqual([
      {
        id: apcs,
        code: 'APCS',
        nameVi: expect.any(String),
        curricula: [
          { id: apcs2024, code: 'APCS2024', cohortYear: 2024 },
          { id: apcs2025, code: 'APCS2025', cohortYear: 2025 },
        ],
      },
    ]);
    const before = await db.query('SELECT count(*)::int AS n FROM requirement_groups WHERE curriculum_id = $1', [clcCurriculum]);
    const direct = await as(admin.token).post(`${cohort(clc, clcCurriculum)}/requirement-groups`, { name: groupName, kind: 'elective' });
    expect([direct.status, direct.body.code]).toEqual([403, 'permission_required']);
    // APCS in the path, a CLC cohort in the ID: not found, never written.
    await as(admin.token).post(`${cohort(apcs, clcCurriculum)}/requirement-groups`, { name: groupName, kind: 'elective' }).expect(404);
    await as(admin.token).put(`${cohort(apcs, clcCurriculum)}/courses/${A}/offering-terms`, { terms: [1] }).expect(404);
    expect(await db.query('SELECT count(*)::int AS n FROM requirement_groups WHERE curriculum_id = $1', [clcCurriculum])).toEqual(before);
    // A program grant gives no catalog right.
    expect((await as(admin.token).post('/api/admin/catalog/courses', { code: `${A}X`, nameVi: 'x', credits: 1 })).body.permission).toBe('catalog_maintainer');
  });

  it('rejects malformed codes, unknown fields and a gated credit total with 400 validation_failed', async () => {
    const bad = [
      await as(admin.token).put(prereqs('cs.101'), { prerequisites: [] }),
      await as(admin.token).put(prereqs(B), { prerequisites: ['not a code'] }),
      await as(admin.token).put(prereqs(B), { prerequisites: [], curriculumId: clcCurriculum }),
      await as(admin.token).patch(groupPath(), { creditsTotalMin: 4 }),
      await as(admin.token).patch(groupPath(), { curriculumId: clcCurriculum }),
      await as(maintainer.token).patch(`/api/admin/catalog/courses/${E}`, { code: 'ZZ0' }),
      await as(maintainer.token).post('/api/admin/catalog/courses', { code: 'Z', nameVi: 'x', credits: 1 }),
      await as(admin.token).post(`/api/admin/programs/not-a-uuid/cohorts/${apcs2024}/requirement-groups`, { name: 'x', kind: 'elective' }),
    ];
    for (const res of bad) expect([res.status, res.body.code]).toEqual([400, 'validation_failed']);
    expect((await readGroup('APCS', 2024, groupName)).courses.find((c) => c.code === B)!.prerequisites).toBeNull();
  });

  it('sets prerequisites, then rejects a cycle and names it, saving nothing', async () => {
    expect((await as(admin.token).put(prereqs(B.toLowerCase()), { prerequisites: [` ${A.toLowerCase()} `] }).expect(200)).body).toEqual({ courseCode: B, prerequisites: [A] });
    await as(admin.token).put(prereqs(C), { prerequisites: [B] }).expect(200);
    await as(admin.token).put(prereqs(D), { prerequisites: [] }).expect(200);

    const cycle = await as(admin.token).put(prereqs(A), { prerequisites: [C] }).expect(400);
    expect(cycle.body).toMatchObject({ code: 'prerequisite_cycle', cycle: [A, C, B, A] });
    const self = await as(admin.token).put(prereqs(A), { prerequisites: [A] }).expect(400);
    expect(self.body).toMatchObject({ code: 'prerequisite_cycle', cycle: [A, A] });
    // E is in the catalog but not in this curriculum.
    expect((await as(admin.token).put(prereqs(A), { prerequisites: [E] }).expect(400)).body.code).toBe('validation_failed');
    await as(admin.token).put(prereqs(E), { prerequisites: [] }).expect(404);
    await as(admin.token).put(prereqs(A), { prerequisites: [D, D] }).expect(400);
    const rows = await db.query('SELECT 1 FROM course_prerequisite_lists WHERE curriculum_id = $1 AND course_code = $2', [apcs2024, A]);
    expect(rows).toEqual([]);
  });

  it('serves the prerequisites on the read API, with null for a course nothing was recorded for', async () => {
    const group = await readGroup('APCS', 2024, groupName);
    const byCode = Object.fromEntries(group.courses.map((c) => [c.code, c.prerequisites]));
    expect(byCode).toEqual({ [A]: null, [B]: [A], [C]: [B], [D]: [] });
    const { body } = await as(admin.token).get('/api/programs/APCS/curricula/2024').expect(200);
    const seeded = (body.requirementGroups as ReadGroup[]).filter((g) => g.name !== groupName).flatMap((g) => g.courses);
    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.every((c) => c.prerequisites === null && c.offeringTerms === null)).toBe(true);
  });

  it('round-trips offering terms, and clears both kinds back to not recorded', async () => {
    expect((await as(admin.token).put(offerings(A), { terms: [3, 1] }).expect(200)).body).toEqual({ courseCode: A, terms: [1, 3] });
    expect((await readGroup('APCS', 2024, groupName)).courses.find((c) => c.code === A)!.offeringTerms).toEqual([1, 3]);
    await as(admin.token).put(offerings(A), { terms: [2] }).expect(200);
    expect((await readGroup('APCS', 2024, groupName)).courses.find((c) => c.code === A)!.offeringTerms).toEqual([2]);
    for (const terms of [[], [4], [0], [1, 1], ['1']]) expect((await as(admin.token).put(offerings(A), { terms }).expect(400)).body.code).toBe('validation_failed');

    await as(admin.token).put(offerings(D), { terms: [1] }).expect(200);
    expect((await as(admin.token).delete(offerings(D)).expect(200)).body).toEqual({ courseCode: D, terms: null });
    expect((await as(admin.token).delete(prereqs(D)).expect(200)).body).toEqual({ courseCode: D, prerequisites: null });
    const d = (await readGroup('APCS', 2024, groupName)).courses.find((c) => c.code === D)!;
    expect([d.prerequisites, d.offeringTerms]).toEqual([null, null]);
  });

  it('keeps an untouched curriculum, and another cohort of the same program, at not recorded', async () => {
    for (const [program, year] of [[clcCode, 2025], ['APCS', 2025]] as const) {
      const { body } = await as(stranger.token).get(`/api/programs/${program}/curricula/${year}`).expect(200);
      const courses = (body.requirementGroups as ReadGroup[]).flatMap((g) => g.courses);
      expect(courses.length).toBeGreaterThan(0);
      expect(courses.every((c) => c.prerequisites === null && c.offeringTerms === null)).toBe(true);
    }
  });

  it('warns before changing a shared course, lists the curricula, and applies only the confirmed impact', async () => {
    await as(admin.token).put(`${cohort(apcs, apcs2025)}/requirement-groups/${group2025}/courses/${A}`).expect(204);
    const m = as(maintainer.token);
    const warn = await m.patch(`/api/admin/catalog/courses/${A}`, { credits: 3 }).expect(409);
    expect(warn.body).toMatchObject({ code: 'impact_confirmation_required', reviewVersion: expect.any(String) });
    expect(warn.body.affectedCurricula).toEqual([
      { curriculumId: apcs2024, curriculumCode: 'APCS2024', programCode: 'APCS', cohortYear: 2024 },
      { curriculumId: apcs2025, curriculumCode: 'APCS2025', programCode: 'APCS', cohortYear: 2025 },
    ]);
    expect((await m.patch(`/api/admin/catalog/courses/${A}`, { credits: 3, confirmImpact: 'stale' }).expect(409)).body.code).toBe('impact_changed');
    // A confirmation for different values does not apply either.
    expect((await m.patch(`/api/admin/catalog/courses/${A}`, { credits: 2, confirmImpact: warn.body.reviewVersion }).expect(409)).body.code).toBe('impact_changed');

    // The links change during the review: the old confirmation no longer applies.
    await as(admin.token).delete(`${cohort(apcs, apcs2025)}/requirement-groups/${group2025}/courses/${A}`).expect(204);
    const changed = await m.patch(`/api/admin/catalog/courses/${A}`, { credits: 3, confirmImpact: warn.body.reviewVersion }).expect(409);
    expect(changed.body.code).toBe('impact_changed');
    expect(changed.body.affectedCurricula.map((c: { curriculumCode: string }) => c.curriculumCode)).toEqual(['APCS2024']);
    expect((await readGroup('APCS', 2024, groupName)).courses.find((c) => c.code === A)!.credits).toBe(4);

    const saved = await m.patch(`/api/admin/catalog/courses/${A}`, { credits: 3, confirmImpact: changed.body.reviewVersion }).expect(200);
    expect(saved.body).toMatchObject({ code: A, credits: 3 });
    expect((await readGroup('APCS', 2024, groupName)).courses.find((c) => c.code === A)!.credits).toBe(3);
    // A course no curriculum links needs no confirmation; the code itself never changes.
    expect((await m.patch(`/api/admin/catalog/courses/${E}`, { nameEn: 'Course E' }).expect(200)).body).toMatchObject({ code: E, nameEn: 'Course E' });
    expect((await m.post('/api/admin/catalog/courses', { code: E, nameVi: 'x', credits: 1 }).expect(409)).body.code).toBe('duplicate_code');
  });

  it('refuses to strand a rule: no unlinking a required course, no deleting a linked group or course', async () => {
    const unlink = await as(admin.token).delete(`${groupPath()}/courses/${A}`).expect(409);
    expect(unlink.body).toMatchObject({ code: 'referenced_item', references: expect.arrayContaining([`${B} requires ${A}`, `offering terms of ${A} are recorded`]) });
    expect((await as(admin.token).delete(groupPath()).expect(409)).body.code).toBe('referenced_item');
    expect((await as(maintainer.token).delete(`/api/admin/catalog/courses/${A}`).expect(409)).body.code).toBe('referenced_item');
    // D has no rule left: it can leave the group, then the unreferenced E can leave the catalog.
    await as(admin.token).delete(`${groupPath()}/courses/${D}`).expect(204);
    await as(maintainer.token).delete(`/api/admin/catalog/courses/${E}`).expect(204);
    await as(maintainer.token).delete(`/api/admin/catalog/courses/${E}`).expect(404);
  });

  it('renames a group, refuses a duplicate name, and deletes an empty group', async () => {
    const renamed = await as(admin.token).patch(`${cohort(apcs, apcs2025)}/requirement-groups/${group2025}`, { name: `${groupName} 2`, officialNotes: 'synthetic' }).expect(200);
    expect(renamed.body).toMatchObject({ id: group2025, name: `${groupName} 2`, kind: 'elective', officialNotes: 'synthetic', creditsTotalMin: null });
    await as(admin.token).patch(`${cohort(apcs, apcs2025)}/requirement-groups/${group2025}`, { name: groupName }).expect(200);
    expect((await as(admin.token).post(`${cohort(apcs, apcs2025)}/requirement-groups`, { name: groupName, kind: 'compulsory' }).expect(409)).body.code).toBe('duplicate_name');
    await as(admin.token).delete(`${cohort(apcs, apcs2025)}/requirement-groups/${group2025}`).expect(204);
    await as(admin.token).delete(`${cohort(apcs, apcs2025)}/requirement-groups/${group2025}`).expect(404);
  });

  it('blocks the next write once a grant is revoked', async () => {
    const helper = await signedInUser(app);
    try {
      await as(manager.token).put(`/api/admin/access/users/${helper.userId}/programs/${apcs}`).expect(200);
      await as(helper.token).put(offerings(C), { terms: [1, 2] }).expect(200);
      const grants = await as(manager.token).delete(`/api/admin/access/users/${helper.userId}/programs/${apcs}`).expect(200);
      expect(grants.body).toEqual({ userId: helper.userId, programs: [], permissions: [] });
      expect((await as(helper.token).put(offerings(C), { terms: [1] }).expect(403)).body.permission).toBe('program_admin');
    } finally {
      await db.query('DELETE FROM users WHERE id = $1', [helper.userId]);
    }
  });

  it("shows a user's grants to an access manager, with who granted them, and exports them to their recipient", async () => {
    const { body } = await as(manager.token).get(`/api/admin/access/users/${admin.userId}/grants`).expect(200);
    expect(body).toEqual({
      userId: admin.userId,
      programs: [{ programId: apcs, programCode: 'APCS', grantedAt: expect.any(String), grantedBy: manager.userId }],
      permissions: [],
    });
    await as(manager.token).get(`/api/admin/access/users/${randomUUID()}/grants`).expect(404);
    const exported = await as(admin.token).get('/api/users/me/export').expect(200);
    expect(exported.body.tables.program_admin_grants).toEqual([{ user_id: admin.userId, program_id: apcs, granted_at: expect.any(String), granted_by: manager.userId }]);
    expect(exported.body.tables.global_admin_grants).toEqual([]);
  });
});

// The bootstrap and the grant lifecycle on a schema of their own: the shared database may hold
// access managers from other runs, and these cases depend on there being none.
describe('Access-manager bootstrap and grant lifecycle (e2e)', () => {
  let schema: Awaited<ReturnType<typeof privateSchema>>;
  let access: AccessAdminService;
  const newUser = async (): Promise<string> =>
    (await schema.dataSource.query(`INSERT INTO users (email, password_hash, display_name, consent_at) VALUES ($1, 'x', 'Test Student', now()) RETURNING id`, [`e2e-${randomUUID()}@example.com`]))[0].id;
  const requestDeletion = (id: string) => schema.dataSource.query(`UPDATE users SET deletion_requested_at = now(), purge_after = now() + interval '30 days' WHERE id = $1`, [id]);
  const globalGrants = (id: string) => schema.dataSource.query('SELECT permission, granted_by FROM global_admin_grants WHERE user_id = $1 ORDER BY permission', [id]);

  beforeAll(async () => {
    schema = await privateSchema('admin_e2e');
    access = new AccessAdminService(new AdminWriteService(schema.dataSource));
  });

  afterAll(async () => {
    await schema?.drop();
  });

  it('refuses an unknown account and one waiting for deletion, then makes the first access manager once', async () => {
    await expect(bootstrapAccessManager(schema.dataSource, randomUUID())).rejects.toThrow(/No account/);
    const leaving = await newUser();
    await requestDeletion(leaving);
    await expect(bootstrapAccessManager(schema.dataSource, leaving)).rejects.toThrow(/waiting for deletion/);

    const first = await newUser();
    const second = await newUser();
    await bootstrapAccessManager(schema.dataSource, first);
    expect(await globalGrants(first)).toEqual([{ permission: 'access_manager', granted_by: null }]);
    await expect(bootstrapAccessManager(schema.dataSource, second)).rejects.toThrow(/already exists/);
    expect(await globalGrants(second)).toEqual([]);
  });

  it('lets only one of two concurrent bootstraps succeed', async () => {
    await schema.dataSource.query(`DELETE FROM global_admin_grants`);
    const [x, y] = [await newUser(), await newUser()];
    const results = await Promise.allSettled([bootstrapAccessManager(schema.dataSource, x), bootstrapAccessManager(schema.dataSource, y)]);
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    const [{ n }] = await schema.dataSource.query(`SELECT count(*)::int AS n FROM global_admin_grants WHERE permission = 'access_manager'`);
    expect(n).toBe(1);
  });

  it('delegates, protects the last active access manager, and recovers when the last one is deleted', async () => {
    await schema.dataSource.query(`DELETE FROM global_admin_grants`);
    const lead = await newUser();
    const deputy = await newUser();
    await bootstrapAccessManager(schema.dataSource, lead);
    await expect(access.revokeGlobal(lead, lead, 'access_manager')).rejects.toMatchObject({ response: { code: 'last_access_manager' } });

    await access.grantGlobal(lead, deputy, 'access_manager');
    await access.grantGlobal(lead, deputy, 'catalog_maintainer');
    // Repeating a grant keeps its original attribution.
    await access.grantGlobal(deputy, deputy, 'catalog_maintainer');
    expect(await globalGrants(deputy)).toEqual([
      { permission: 'access_manager', granted_by: lead },
      { permission: 'catalog_maintainer', granted_by: lead },
    ]);
    await access.revokeGlobal(deputy, lead, 'access_manager');
    await expect(access.revokeGlobal(deputy, deputy, 'access_manager')).rejects.toMatchObject({ response: { code: 'last_access_manager' } });
    await expect(access.grantGlobal(lead, lead, 'access_manager')).rejects.toMatchObject({ response: { code: 'permission_required' } });

    // The last manager asks for deletion: no active one is left, so the bootstrap may recover.
    await requestDeletion(deputy);
    await expect(access.grantGlobal(deputy, lead, 'access_manager')).rejects.toMatchObject({ response: { code: 'account_deletion_pending' } });
    await bootstrapAccessManager(schema.dataSource, lead);
    expect(await globalGrants(lead)).toEqual([{ permission: 'access_manager', granted_by: null }]);
  });

  it("keeps a grant when its granter is purged, and deletes it with its recipient's account", async () => {
    await schema.dataSource.query(`DELETE FROM global_admin_grants`);
    const granter = await newUser();
    const recipient = await newUser();
    await bootstrapAccessManager(schema.dataSource, granter);
    await access.grantGlobal(granter, recipient, 'catalog_maintainer');
    await schema.dataSource.query('DELETE FROM users WHERE id = $1', [granter]);
    expect(await globalGrants(recipient)).toEqual([{ permission: 'catalog_maintainer', granted_by: null }]);
    await schema.dataSource.query('DELETE FROM users WHERE id = $1', [recipient]);
    expect(await globalGrants(recipient)).toEqual([]);
  });
});
