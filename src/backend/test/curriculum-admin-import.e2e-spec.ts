import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CatalogAdminService } from '../src/curriculum-admin/catalog-admin.service.js';
import { CsvImportService } from '../src/curriculum-admin/csv-import.service.js';
import { CurriculumAdminService } from '../src/curriculum-admin/curriculum-admin.service.js';
import { CATALOG_DECISIONS, CURRICULUM_SEEDS } from '../src/database/seeds/index.js';
import { seedCurricula } from '../src/database/seeds/seed-curricula.js';
import { bootApp } from './support/app.js';
import { signedInUser } from './support/users.js';

// TC-B2-ADM-07 (ADR 0011, "Verification required with implementation"; UC-11 A9): the CSV
// import of catalog courses and of group links. Synthetic courses, groups and accounts only
// (AGENTS.md hard rule 3), unique per run and removed in afterAll, because e2e files share one
// database with the seeded curricula. Each describe boots its own app: the rate limit counts
// 120 requests a minute per app.

const COURSES_HEADER = 'code,name_vi,name_en,credits,theory_periods,lab_periods,exercise_periods,project_periods';
const LINKS_HEADER = 'requirement_group_name,course_code';
const CATALOG = '/api/admin/catalog/imports';
const MIB = 1024 * 1024;

type Account = { token: string; userId: string };
interface Fixture {
  app: INestApplication;
  db: DataSource;
  apcs: string;
  apcs2024: string;
  apcs2025: string;
  clc: string;
  clcCurriculum: string;
  users: Account[];
  as: (account: Account) => { post: (path: string, body: object | string) => request.Test; put: (path: string, body?: object) => request.Test; patch: (path: string, body: object) => request.Test; delete: (path: string) => request.Test; get: (path: string) => request.Test };
  account: (grant?: 'catalog_maintainer' | { program: string }) => Promise<Account>;
  group: (curriculumId: string, name: string) => Promise<string>;
  close: () => Promise<void>;
}

/** The app on the seeded curricula, with helpers that set a fixture up in SQL, off the request budget. */
async function fixture(groupPrefix: string, coursePrefix: string): Promise<Fixture> {
  const app = await bootApp();
  const db = app.get(DataSource);
  await seedCurricula(db, CURRICULUM_SEEDS, CATALOG_DECISIONS);
  const id = async (sql: string, params: unknown[] = []) => ((await db.query(sql, params)) as { id: string }[])[0].id;
  const apcs = await id(`SELECT id FROM programs WHERE code = 'APCS'`);
  const clc = await id(`SELECT id FROM programs WHERE code LIKE 'CNTT-TCTA-%' ORDER BY code LIMIT 1`);
  const users: Account[] = [];
  const http = () => request(app.getHttpServer());
  return {
    app,
    db,
    apcs,
    clc,
    apcs2024: await id('SELECT id FROM curriculums WHERE program_id = $1 AND cohort_year = 2024', [apcs]),
    apcs2025: await id('SELECT id FROM curriculums WHERE program_id = $1 AND cohort_year = 2025', [apcs]),
    clcCurriculum: await id('SELECT id FROM curriculums WHERE program_id = $1', [clc]),
    users,
    as: ({ token }) => {
      const auth = (test: request.Test) => test.set('Authorization', `Bearer ${token}`);
      return {
        // A string is sent as it is, so a test controls the exact JSON bytes.
        post: (path, body) => auth(http().post(path)).set('Content-Type', 'application/json').send(body),
        put: (path, body = {}) => auth(http().put(path)).send(body),
        patch: (path, body) => auth(http().patch(path)).send(body),
        delete: (path) => auth(http().delete(path)),
        get: (path) => auth(http().get(path)),
      };
    },
    account: async (grant) => {
      const account = await signedInUser(app);
      users.push(account);
      if (grant === 'catalog_maintainer') await db.query(`INSERT INTO global_admin_grants (user_id, permission) VALUES ($1, 'catalog_maintainer')`, [account.userId]);
      else if (grant) await db.query('INSERT INTO program_admin_grants (user_id, program_id) VALUES ($1, $2)', [account.userId, grant.program]);
      return account;
    },
    group: (curriculumId, name) => id(`INSERT INTO requirement_groups (curriculum_id, name, kind) VALUES ($1, $2, 'elective') RETURNING id`, [curriculumId, name]),
    close: async () => {
      if (db.isInitialized) {
        await db.query('DELETE FROM requirement_groups WHERE name LIKE $1', [`${groupPrefix}%`]);
        await db.query('DELETE FROM courses WHERE code LIKE $1', [`${coursePrefix}%`]);
        await db.query('DELETE FROM users WHERE id = ANY($1)', [users.map((u) => u.userId)]);
      }
      await app.close();
    },
  };
}

const run = () => randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
const cohortImports = (program: string, curriculum: string) => `/api/admin/programs/${program}/cohorts/${curriculum}/imports`;

describe('CSV import of catalog courses (e2e)', () => {
  const suffix = run();
  const P = `ZC${suffix}`;
  const groupName = `zz-import ${suffix}`;
  let f: Fixture;
  let maintainer: Account;
  let admin: Account;
  let stranger: Account;
  let group2025: string;

  /** Everything the catalog stores for this run's courses, with the time of the last write. */
  const savedCourses = () =>
    f.db.query(
      'SELECT code, name_vi, name_en, credits, theory_periods, lab_periods, exercise_periods, project_periods, updated_at FROM courses WHERE code LIKE $1 ORDER BY code',
      [`${P}%`],
    ) as Promise<{ code: string; name_vi: string; name_en: string | null; credits: number; theory_periods: number | null; updated_at: Date }[]>;
  const course = async (code: string) => (await savedCourses()).find((c) => c.code === code);
  const preview = (csv: string, account = maintainer) => f.as(account).post(`${CATALOG}/preview`, { csv });
  const confirm = (csv: string, reviewVersion: string, account = maintainer) => f.as(account).post(`${CATALOG}/confirm`, { csv, reviewVersion });

  // Quoted commas, a quoted line break, doubled quotes, a BOM, CRLF and LF, a code to canonicalize,
  // a blank line and an empty record: two new courses, two changed ones, one unchanged.
  const FILE = [
    `\uFEFF${COURSES_HEADER}\r\n`,
    ` ${P.toLowerCase()}n1 ,"Giải tích, phần 1","Calculus ""A""\nsecond line",4,45,,,\r\n`,
    `${P}N2,Học phần mới,,3,,,,\n`,
    `${P}S,Shared course renamed,,3,,,,\n`,
    `${P}U,Unlinked course,,4,10,,,\n`,
    `${P}K,Kept course,Kept,2,30,0,,\n`,
    '\n',
    ',,,,,,,\n',
  ].join('');

  beforeAll(async () => {
    f = await fixture('zz-import', P);
    [maintainer, admin, stranger] = [await f.account('catalog_maintainer'), await f.account({ program: f.apcs }), await f.account()];
    await f.db.query(
      // A blank period is NULL, as an empty cell of FILE saves it (#164).
      `INSERT INTO courses (code, name_vi, name_en, credits, theory_periods, lab_periods, exercise_periods, project_periods) VALUES
       ($1, 'Shared course', NULL, 4, NULL, NULL, NULL, NULL), ($2, 'Unlinked course', NULL, 4, NULL, NULL, NULL, NULL),
       ($3, 'Kept course', 'Kept', 2, 30, 0, NULL, NULL), ($4, 'Omitted course', NULL, 1, 0, 0, 0, 0)`,
      [`${P}S`, `${P}U`, `${P}K`, `${P}O`],
    );
    const group2024 = await f.group(f.apcs2024, groupName);
    group2025 = await f.group(f.apcs2025, groupName);
    await f.db.query('INSERT INTO requirement_group_courses (requirement_group_id, course_code) VALUES ($1, $3), ($2, $3)', [group2024, group2025, `${P}S`]);
  });

  afterAll(async () => {
    await f?.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses the four import routes without a token', async () => {
    const http = request(f.app.getHttpServer());
    for (const base of [CATALOG, cohortImports(f.apcs, f.apcs2024)]) {
      await http.post(`${base}/preview`).send({ csv: COURSES_HEADER }).expect(401);
      await http.post(`${base}/confirm`).send({ csv: COURSES_HEADER, reviewVersion: 'x' }).expect(401);
    }
  });

  it('needs the catalog grant: a program administrator and a user without a grant get 403 on preview and confirm', async () => {
    // The grant is checked before the file is read: without it, a file that is malformed, has
    // another header or too many records gets the same 403 as a valid one, not a 400 or a 413.
    const files = [FILE, `${COURSES_HEADER}\n${P}N2,"Tên" x,,3,,,,`, 'not,the,header\n1,2,3', `${COURSES_HEADER}\n${'x\n'.repeat(1001)}`];
    for (const account of [admin, stranger]) {
      for (const csv of files) {
        for (const res of [await preview(csv, account), await confirm(csv, 'x', account)]) expect([res.status, res.body.code, res.body.permission]).toEqual([403, 'permission_required', 'catalog_maintainer']);
      }
    }
    expect(await course(`${P}N2`)).toBeUndefined();
  });

  let reviewed: string;

  it('previews the normalized rows, what each would do and who a shared change reaches, and writes nothing (cancel saves nothing)', async () => {
    const before = await savedCourses();
    const { body } = await preview(FILE).expect(200);
    const affected = [
      { curriculumId: f.apcs2024, curriculumCode: 'APCS2024', programCode: 'APCS', cohortYear: 2024 },
      { curriculumId: f.apcs2025, curriculumCode: 'APCS2025', programCode: 'APCS', cohortYear: 2025 },
    ];
    const periods = { theoryPeriods: null, labPeriods: null, exercisePeriods: null, projectPeriods: null };
    expect(body).toEqual({
      fileType: 'catalog_courses',
      rows: [
        // Record 2 takes two lines of the file: its English name holds a line break.
        { record: 2, action: 'insert', code: `${P}N1`, nameVi: 'Giải tích, phần 1', nameEn: 'Calculus "A"\nsecond line', credits: 4, ...periods, theoryPeriods: 45, changedFields: [], current: null, affectedCurricula: [] },
        { record: 3, action: 'insert', code: `${P}N2`, nameVi: 'Học phần mới', nameEn: null, credits: 3, ...periods, changedFields: [], current: null, affectedCurricula: [] },
        {
          record: 4,
          action: 'update',
          code: `${P}S`,
          nameVi: 'Shared course renamed',
          nameEn: null,
          credits: 3,
          ...periods,
          changedFields: ['nameVi', 'credits'],
          current: { code: `${P}S`, nameVi: 'Shared course', nameEn: null, credits: 4, ...periods },
          affectedCurricula: affected,
        },
        {
          record: 5,
          action: 'update',
          code: `${P}U`,
          nameVi: 'Unlinked course',
          nameEn: null,
          credits: 4,
          ...periods,
          theoryPeriods: 10,
          changedFields: ['theoryPeriods'],
          current: { code: `${P}U`, nameVi: 'Unlinked course', nameEn: null, credits: 4, ...periods },
          affectedCurricula: [],
        },
        { record: 6, action: 'no_op', code: `${P}K`, nameVi: 'Kept course', nameEn: 'Kept', credits: 2, ...periods, theoryPeriods: 30, labPeriods: 0, changedFields: [], current: null, affectedCurricula: [] },
      ],
      errors: [],
      summary: { inserts: 2, updates: 2, noOps: 1 },
      affectedCurricula: affected,
      reviewVersion: expect.any(String),
    });
    reviewed = body.reviewVersion;
    // The same file on the same data is the same review.
    expect((await preview(FILE).expect(200)).body.reviewVersion).toBe(reviewed);
    expect(await savedCourses()).toEqual(before);
  });

  it('lists every bad row by record and column, gives no review version, and saves nothing on confirm', async () => {
    const bad = [
      COURSES_HEADER,
      `${P}E1,,,3,,,,`,
      'zz.bad,Tên,,3,,,,',
      `${P}E3,Tên,,3.0,,,,`,
      `${P}E4,Tên,,1e2,-1,,,`,
      `${P}E5,Tên,,3,,,,`,
      `${P.toLowerCase()}e5,Tên,,3,,,,`,
      `${P}E7,Tên,,3,,,`,
      `${P}E8,Tên,,,,,,`,
    ].join('\n');
    const { body } = await preview(bad).expect(200);
    expect(body.errors).toEqual([
      { record: 2, field: 'name_vi', message: 'should not be empty' },
      { record: 3, field: 'code', message: '"zz.bad" is not a course code (letters A-Z and digits, 2 to 20)' },
      // A value that is not a whole number: the two messages of manual entry.
      { record: 4, field: 'credits', message: 'must not be less than 1; must be an integer number' },
      { record: 5, field: 'credits', message: 'must not be less than 1; must be an integer number' },
      { record: 5, field: 'theory_periods', message: 'must not be less than 0; must be an integer number' },
      // Identical to record 6 once the code is canonical: still an error.
      { record: 7, field: 'code', message: `${P}E5 is in record 6 already; a file names a course once` },
      { record: 8, field: null, message: 'has 7 fields; the template has 8' },
      { record: 9, field: 'credits', message: 'must not be less than 1; must be an integer number' },
    ]);
    expect(body.reviewVersion).toBeNull();
    expect(body.rows.map((r: { code: string; action: string }) => [r.code, r.action])).toEqual([[`${P}E5`, 'insert']]);

    const refused = await confirm(bad, reviewed).expect(400);
    expect(refused.body).toMatchObject({ code: 'validation_failed', errors: body.errors });

    // One bad row blocks the three good ones.
    const oneBad = [COURSES_HEADER, `${P}G1,Tên,,3,,,,`, `${P}G2,Tên,,3,,,,`, `${P}G3,Tên,,0,,,,`, `${P}G4,Tên,,3,,,,`].join('\n');
    const one = await preview(oneBad).expect(200);
    expect([one.body.errors, one.body.reviewVersion, one.body.summary]).toEqual([[{ record: 4, field: 'credits', message: 'must not be less than 1' }], null, { inserts: 3, updates: 0, noOps: 0 }]);
    expect((await confirm(oneBad, reviewed).expect(400)).body.code).toBe('validation_failed');
    expect((await savedCourses()).map((c) => c.code)).toEqual([`${P}K`, `${P}O`, `${P}S`, `${P}U`]);
  });

  it('refuses another header, malformed quoting and unknown body fields with 400, on preview and on confirm', async () => {
    const row = `${P}H1,Tên,,3,,,,`;
    const files = [
      `${COURSES_HEADER},program_id\n${row},${f.clc}`, // a scope column
      `${COURSES_HEADER.replace('name_vi', 'name')}\n${row}`,
      `${LINKS_HEADER}\n${groupName},${P}S`, // the other template
      `${COURSES_HEADER}\n${P}H1,"Tên" x,,3,,,,`, // text after a closing quote
    ];
    for (const csv of files) {
      for (const res of [await preview(csv), await confirm(csv, reviewed)]) {
        expect([res.status, res.body.code, res.body.errors]).toEqual([400, 'validation_failed', [expect.objectContaining({ field: null })]]);
      }
    }
    const m = f.as(maintainer);
    const bodies = [
      await m.post(`${CATALOG}/preview`, { csv: `${COURSES_HEADER}\n${row}`, programId: f.apcs }),
      await m.post(`${CATALOG}/preview`, {}),
      await m.post(`${CATALOG}/preview`, { csv: 5 }),
      await m.post(`${CATALOG}/confirm`, { csv: `${COURSES_HEADER}\n${row}` }),
      await m.post(`${CATALOG}/confirm`, { csv: `${COURSES_HEADER}\n${row}`, reviewVersion: 'x'.repeat(129) }),
    ];
    for (const res of bodies) expect([res.status, res.body.code]).toEqual([400, 'validation_failed']);
    expect(await course(`${P}H1`)).toBeUndefined();
  });

  it('saves the whole previewed file in one confirmation and leaves an omitted course alone', async () => {
    const before = await savedCourses();
    expect((await confirm(FILE, reviewed).expect(200)).body).toEqual({ fileType: 'catalog_courses', summary: { inserts: 2, updates: 2, noOps: 1 } });
    const after = await savedCourses();
    expect(after.map((c) => [c.code, c.name_vi, c.name_en, c.credits, c.theory_periods])).toEqual([
      [`${P}K`, 'Kept course', 'Kept', 2, 30],
      [`${P}N1`, 'Giải tích, phần 1', 'Calculus "A"\nsecond line', 4, 45],
      [`${P}N2`, 'Học phần mới', null, 3, null],
      [`${P}O`, 'Omitted course', null, 1, 0],
      [`${P}S`, 'Shared course renamed', null, 3, null],
      [`${P}U`, 'Unlinked course', null, 4, 10],
    ]);
    // The unchanged and the omitted course were not written at all.
    for (const code of [`${P}K`, `${P}O`]) expect(after.find((c) => c.code === code)).toEqual(before.find((c) => c.code === code));
    // Both cohorts that link the shared course read its new values.
    for (const year of [2024, 2025]) {
      const { body } = await f.as(stranger).get(`/api/programs/APCS/curricula/${year}`).expect(200);
      const group = (body.requirementGroups as { name: string; courses: { code: string; credits: number }[] }[]).find((g) => g.name === groupName)!;
      expect(group.courses).toMatchObject([{ code: `${P}S`, credits: 3 }]);
    }
  });

  it('imports the same file again as no-ops only: no duplicate, no write, and the old review no longer applies', async () => {
    const before = await savedCourses();
    expect((await confirm(FILE, reviewed).expect(409)).body.code).toBe('impact_changed');
    const again = await preview(FILE).expect(200);
    expect([again.body.summary, again.body.errors, again.body.affectedCurricula]).toEqual([{ inserts: 0, updates: 0, noOps: 5 }, [], []]);
    expect(again.body.reviewVersion).not.toBe(reviewed);
    expect((await confirm(FILE, again.body.reviewVersion).expect(200)).body.summary).toEqual({ inserts: 0, updates: 0, noOps: 5 });
    expect(await savedCourses()).toEqual(before);
  });

  it('answers 409 and writes nothing when the file, a saved value, the impact or the catalog changed since the preview', async () => {
    const file = (rows: string[]) => [COURSES_HEADER, ...rows].join('\n');
    const stale = async (csv: string, version: string) => {
      const res = await confirm(csv, version);
      expect([res.status, res.body.code]).toEqual([409, 'impact_changed']);
    };

    // The input changed: one credit value differs from the reviewed file.
    const first = await preview(file([`${P}T1,Tên,,3,,,,`])).expect(200);
    await stale(file([`${P}T1,Tên,,4,,,,`]), first.body.reviewVersion);
    await stale(file([`${P}T1,Tên,,3,,,,`]), 'not-a-review-version');
    expect(await course(`${P}T1`)).toBeUndefined();

    // A saved value changed: another maintainer edited the course by hand in between.
    const edit = file([`${P}U,Unlinked course,,5,10,,,`]);
    const beforeEdit = await preview(edit).expect(200);
    await f.as(maintainer).patch(`/api/admin/catalog/courses/${P}U`, { nameEn: 'Edited by hand' }).expect(200);
    await stale(edit, beforeEdit.body.reviewVersion);
    expect(await course(`${P}U`)).toMatchObject({ credits: 4, name_en: 'Edited by hand' });

    // The impact changed: a cohort unlinked the shared course in between.
    const shared = file([`${P}S,Shared course renamed,,5,,,,`]);
    const beforeUnlink = await preview(shared).expect(200);
    expect(beforeUnlink.body.affectedCurricula.map((c: { curriculumCode: string }) => c.curriculumCode)).toEqual(['APCS2024', 'APCS2025']);
    await f.as(admin).delete(`/api/admin/programs/${f.apcs}/cohorts/${f.apcs2025}/requirement-groups/${group2025}/courses/${P}S`).expect(204);
    await stale(shared, beforeUnlink.body.reviewVersion);
    expect(await course(`${P}S`)).toMatchObject({ credits: 3 });
    const afterUnlink = await preview(shared).expect(200);
    expect(afterUnlink.body.affectedCurricula.map((c: { curriculumCode: string }) => c.curriculumCode)).toEqual(['APCS2024']);
    await confirm(shared, afterUnlink.body.reviewVersion).expect(200);
    expect(await course(`${P}S`)).toMatchObject({ credits: 5 });

    // The catalog changed: the course a row would insert was created by hand in between.
    const created = file([`${P}T2,Tên,,3,,,,`]);
    const beforeCreate = await preview(created).expect(200);
    await f.as(maintainer).post('/api/admin/catalog/courses', { code: `${P}T2`, nameVi: 'Tên', credits: 3 }).expect(201);
    await stale(created, beforeCreate.body.reviewVersion);
  });

  it('answers 409 and writes nothing when the revision of the checks changed since the preview', async () => {
    const csv = `${COURSES_HEADER}\n${P}V1,Tên,,3,,,,`;
    const { body } = await preview(csv).expect(200);
    // A deploy between the preview and the confirmation changed what the checks mean.
    vi.spyOn(f.app.get(CsvImportService), 'validationRevision').mockReturnValue('f12-structural-2');
    expect((await confirm(csv, body.reviewVersion).expect(409)).body.code).toBe('impact_changed');
    expect(await course(`${P}V1`)).toBeUndefined();
    expect((await preview(csv).expect(200)).body.reviewVersion).not.toBe(body.reviewVersion);
    vi.restoreAllMocks();
    expect((await preview(csv).expect(200)).body.reviewVersion).toBe(body.reviewVersion);
  });

  it('refuses the confirmation of a maintainer whose grant was revoked after the preview, and any import while the account waits for deletion', async () => {
    const helper = await f.account('catalog_maintainer');
    const csv = `${COURSES_HEADER}\n${P}R1,Tên,,3,,,,`;
    const { body } = await preview(csv, helper).expect(200);
    await f.db.query('DELETE FROM global_admin_grants WHERE user_id = $1', [helper.userId]);
    const refused = await confirm(csv, body.reviewVersion, helper).expect(403);
    expect([refused.body.code, refused.body.permission]).toEqual(['permission_required', 'catalog_maintainer']);

    // A deletion request signs the account out (401), so the services are called directly:
    // they refuse it themselves, on the read path of a preview as on the write path.
    await f.db.query(`INSERT INTO global_admin_grants (user_id, permission) VALUES ($1, 'catalog_maintainer')`, [helper.userId]);
    await f.db.query(`UPDATE users SET deletion_requested_at = now(), purge_after = now() + interval '30 days' WHERE id = $1`, [helper.userId]);
    await preview(csv, helper).expect(401);
    const imports = f.app.get(CsvImportService);
    await expect(imports.previewCatalog(helper.userId, { csv })).rejects.toMatchObject({ response: { code: 'account_deletion_pending' } });
    await expect(imports.confirmCatalog(helper.userId, { csv, reviewVersion: body.reviewVersion })).rejects.toMatchObject({ response: { code: 'account_deletion_pending' } });
    expect(await course(`${P}R1`)).toBeUndefined();
  });

  it('rolls back every row when a save fails part-way, and logs nothing of the file', async () => {
    const MARK = `UNLOGGED${suffix}`;
    const csv = [COURSES_HEADER, `${P}U,${MARK} changed,,7,,,,`, ...[1, 2, 3, 4].map((n) => `${P}F${n},${MARK} ${n},,3,,,,`)].join('\n');
    const before = await savedCourses();
    const { body } = await preview(csv).expect(200);
    expect(body.summary).toEqual({ inserts: 4, updates: 1, noOps: 0 });

    // The update and two inserts reach the database; the third insert fails in PostgreSQL itself, on a
    // statement whose parameter and whose error message both hold a row's text.
    const catalog = f.app.get(CatalogAdminService);
    const insert = catalog.insertCourse.bind(catalog);
    let inserts = 0;
    vi.spyOn(catalog, 'insertCourse').mockImplementation(async (em, code, values) => {
      if (++inserts === 3) await em.query('SELECT $1::integer', [values.nameVi]);
      return insert(em, code, values);
    });
    const logged: string[] = [];
    for (const stream of [process.stdout, process.stderr]) {
      vi.spyOn(stream, 'write').mockImplementation((chunk: string | Uint8Array) => {
        logged.push(chunk.toString());
        return true;
      });
    }
    const failed = await confirm(csv, body.reviewVersion);
    vi.restoreAllMocks();

    expect([failed.status, failed.body]).toEqual([500, { statusCode: 500, message: 'Internal server error' }]);
    expect(inserts).toBe(3);
    expect(await savedCourses()).toEqual(before);
    // 22P02: invalid text representation, the failed cast.
    expect(logged.join('')).toContain('A CSV import failed and saved nothing: QueryFailedError, SQLSTATE 22P02');
    expect(logged.join('')).not.toContain(MARK);
    // Nothing was left half-done: the same review still confirms.
    expect((await confirm(csv, body.reviewVersion).expect(200)).body.summary).toEqual({ inserts: 4, updates: 1, noOps: 0 });
  });

  // #164: an empty period cell means blank (NULL), as an emptied box of the course form does.
  it('keeps a stored NULL period for an empty cell: the row is a no-op, not a change to 0', async () => {
    const code = `${P}NUL`;
    await f.db.query(`INSERT INTO courses (code, name_vi, credits, theory_periods, lab_periods, exercise_periods, project_periods) VALUES ($1, 'Null periods', 3, NULL, NULL, 15, NULL)`, [code]);
    const csv = `${COURSES_HEADER}\n${code},Null periods,,3,,,15,`;
    const { body } = await preview(csv).expect(200);
    expect(body.rows).toEqual([
      {
        record: 2,
        action: 'no_op',
        code,
        nameVi: 'Null periods',
        nameEn: null,
        credits: 3,
        theoryPeriods: null,
        labPeriods: null,
        exercisePeriods: 15,
        projectPeriods: null,
        changedFields: [],
        current: null,
        affectedCurricula: [],
      },
    ]);
    expect(body.summary).toEqual({ inserts: 0, updates: 0, noOps: 1 });
    expect((await confirm(csv, body.reviewVersion).expect(200)).body.summary).toEqual({ inserts: 0, updates: 0, noOps: 1 });
    const periods = 'SELECT theory_periods, lab_periods, exercise_periods, project_periods FROM courses WHERE code = $1';
    expect(await f.db.query(periods, [code])).toEqual([{ theory_periods: null, lab_periods: null, exercise_periods: 15, project_periods: null }]);
  });

  it('saves an empty period cell of a new course as NULL, and a later file with a number shows blank → number', async () => {
    const code = `${P}BT`;
    const periods = 'SELECT theory_periods, lab_periods, exercise_periods, project_periods FROM courses WHERE code = $1';
    const first = `${COURSES_HEADER}\n${code},Exercise periods,,4,45,,,`;
    const inserted = await preview(first).expect(200);
    expect(inserted.body.rows[0]).toMatchObject({ action: 'insert', theoryPeriods: 45, labPeriods: null, exercisePeriods: null, projectPeriods: null });
    await confirm(first, inserted.body.reviewVersion).expect(200);
    expect(await f.db.query(periods, [code])).toEqual([{ theory_periods: 45, lab_periods: null, exercise_periods: null, project_periods: null }]);
    // The same file again changes nothing.
    expect((await preview(first).expect(200)).body.summary).toEqual({ inserts: 0, updates: 0, noOps: 1 });

    const second = `${COURSES_HEADER}\n${code},Exercise periods,,4,45,,15,`;
    const { body } = await preview(second).expect(200);
    expect(body.rows[0]).toMatchObject({ action: 'update', exercisePeriods: 15, changedFields: ['exercisePeriods'], current: { exercisePeriods: null, labPeriods: null, projectPeriods: null } });
  });

  it('clears a stored 0 for an empty period cell, as a change the preview shows', async () => {
    const code = `${P}ZER`;
    await f.db.query(`INSERT INTO courses (code, name_vi, credits, theory_periods, lab_periods, exercise_periods, project_periods) VALUES ($1, 'Zero periods', 3, 30, 0, 0, 0)`, [code]);
    const csv = `${COURSES_HEADER}\n${code},Zero periods,,3,30,0,,`;
    const { body } = await preview(csv).expect(200);
    expect(body.rows[0]).toMatchObject({
      action: 'update',
      theoryPeriods: 30,
      labPeriods: 0,
      exercisePeriods: null,
      projectPeriods: null,
      changedFields: ['exercisePeriods', 'projectPeriods'],
      current: { theoryPeriods: 30, labPeriods: 0, exercisePeriods: 0, projectPeriods: 0 },
    });
    await confirm(csv, body.reviewVersion).expect(200);
    const periods = 'SELECT theory_periods, lab_periods, exercise_periods, project_periods FROM courses WHERE code = $1';
    expect(await f.db.query(periods, [code])).toEqual([{ theory_periods: 30, lab_periods: 0, exercise_periods: null, project_periods: null }]);
  });

  it('answers a non-numeric credit count in manual entry as before, and keeps the new 400 for a whole number above the bound', async () => {
    const m = f.as(maintainer);
    const text = await m.post('/api/admin/catalog/courses', { code: `${P}X1`, nameVi: 'Tên', credits: 'abc', theoryPeriods: '10' }).expect(400);
    expect(text.body).toEqual({
      statusCode: 400,
      code: 'validation_failed',
      message: ['credits must not be less than 1', 'credits must be an integer number', 'theoryPeriods must not be less than 0', 'theoryPeriods must be an integer number'],
    });
    expect((await m.patch(`/api/admin/catalog/courses/${P}K`, { credits: 'abc' }).expect(400)).body.message).toEqual(['credits must not be less than 1', 'credits must be an integer number']);
    expect((await m.post('/api/admin/catalog/courses', { code: `${P}X1`, nameVi: 'Tên', credits: 2_147_483_648 }).expect(400)).body.message).toEqual(['credits must not be greater than 2147483647']);
  });

  it('refuses a credit or period count above what the database stores, in manual entry as in a file', async () => {
    const m = f.as(maintainer);
    const tooLarge = 2_147_483_648;
    for (const res of [
      await m.post('/api/admin/catalog/courses', { code: `${P}X1`, nameVi: 'Tên', credits: tooLarge }),
      await m.patch(`/api/admin/catalog/courses/${P}K`, { theoryPeriods: tooLarge }),
    ]) {
      expect([res.status, res.body.code]).toEqual([400, 'validation_failed']);
    }
    const { body } = await preview(`${COURSES_HEADER}\n${P}X1,Tên,,${tooLarge},,,,`).expect(200);
    expect(body.errors).toEqual([{ record: 2, field: 'credits', message: 'must not be greater than 2147483647' }]);
  });
});

describe('CSV import of group links (e2e)', () => {
  const suffix = run();
  const L = `ZL${suffix}`;
  const one = `zz-links ${suffix} one`;
  const two = `zz-links ${suffix}, "two"`;
  const clcOnly = `zz-links ${suffix} clc`;
  let f: Fixture;
  let admin: Account;
  let maintainer: Account;
  let stranger: Account;
  let g1: string;
  let g2: string;
  let g2025: string;
  let gClc: string;
  let base: string;

  const links = async (groupId: string): Promise<string[]> =>
    ((await f.db.query('SELECT course_code FROM requirement_group_courses WHERE requirement_group_id = $1 ORDER BY course_code', [groupId])) as { course_code: string }[]).map((l) => l.course_code);
  const allLinks = async () => ({ g1: await links(g1), g2: await links(g2), g2025: await links(g2025), gClc: await links(gClc) });
  const preview = (csv: string, account = admin) => f.as(account).post(`${base}/preview`, { csv });
  const confirm = (csv: string, reviewVersion: string, account = admin) => f.as(account).post(`${base}/confirm`, { csv, reviewVersion });
  const file = (rows: string[]) => [LINKS_HEADER, ...rows].join('\n');
  // A group name with a comma and quotes must be quoted, with its quotes doubled.
  const TWO = `"${two.replace(/"/g, '""')}"`;

  beforeAll(async () => {
    f = await fixture('zz-links', L);
    [admin, maintainer, stranger] = [await f.account({ program: f.apcs }), await f.account('catalog_maintainer'), await f.account()];
    base = cohortImports(f.apcs, f.apcs2024);
    await f.db.query(`INSERT INTO courses (code, name_vi, credits) SELECT $1 || x, 'Học phần ' || x, 3 FROM unnest(ARRAY['A', 'B', 'C', 'D', 'E', 'F']) AS x`, [L]);
    [g1, g2, g2025, gClc] = [await f.group(f.apcs2024, one), await f.group(f.apcs2024, two), await f.group(f.apcs2025, one), await f.group(f.clcCurriculum, clcOnly)];
    await f.db.query('INSERT INTO requirement_group_courses (requirement_group_id, course_code) VALUES ($1, $2), ($1, $3)', [g1, `${L}B`, `${L}F`]);
  });

  afterAll(async () => {
    await f?.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // BOM, CRLF, padded fields, a code to canonicalize, a quoted name: two new links and one that exists.
  const FILE = () => `\uFEFF${LINKS_HEADER}\r\n ${one} , ${L.toLowerCase()}a \r\n${one},${L}B\r\n${TWO},${L}A\r\n`;

  it('needs the grant of the program in the route: 403 without it, 404 for a cohort of another program', async () => {
    // The grant is checked before the file is read: 403 for a valid file, a malformed one and one with too many records.
    for (const account of [maintainer, stranger]) {
      for (const csv of [file([`${one},${L}A`]), 'not,the,header\n1,2,3', file([`${one},"${L}"A`]), file(Array.from({ length: 1001 }, (_, n) => `${one},ZZ${n}`))]) {
        for (const res of [await preview(csv, account), await confirm(csv, 'x', account)]) expect([res.status, res.body.code, res.body.permission]).toEqual([403, 'permission_required', 'program_admin']);
      }
    }
    const a = f.as(admin);
    // The APCS administrator on CLC: no grant. APCS in the path with a CLC cohort: not found.
    for (const step of ['preview', 'confirm']) {
      const body = { csv: file([`${clcOnly},${L}A`]), ...(step === 'confirm' && { reviewVersion: 'x' }) };
      expect((await a.post(`${cohortImports(f.clc, f.clcCurriculum)}/${step}`, body)).body).toMatchObject({ statusCode: 403, code: 'permission_required' });
      expect((await a.post(`${cohortImports(f.apcs, f.clcCurriculum)}/${step}`, body)).body).toMatchObject({ statusCode: 404, code: 'not_found' });
      // The cohort is resolved before the file is read too.
      expect((await a.post(`${cohortImports(f.apcs, f.clcCurriculum)}/${step}`, { ...body, csv: 'not,the,header' })).body).toMatchObject({ statusCode: 404, code: 'not_found' });
      expect((await a.post(`${cohortImports('not-a-uuid', f.apcs2024)}/${step}`, body)).body).toMatchObject({ statusCode: 400, code: 'validation_failed' });
    }
    expect(await links(gClc)).toEqual([]);
  });

  let reviewed: string;

  it('previews the normalized links and what each would do, and writes nothing (cancel saves nothing)', async () => {
    const before = await allLinks();
    const { body } = await preview(FILE()).expect(200);
    expect(body).toEqual({
      fileType: 'group_links',
      programId: f.apcs,
      curriculumId: f.apcs2024,
      rows: [
        { record: 2, action: 'insert', requirementGroupName: one, requirementGroupId: g1, courseCode: `${L}A` },
        { record: 3, action: 'no_op', requirementGroupName: one, requirementGroupId: g1, courseCode: `${L}B` },
        { record: 4, action: 'insert', requirementGroupName: two, requirementGroupId: g2, courseCode: `${L}A` },
      ],
      errors: [],
      summary: { inserts: 2, updates: 0, noOps: 1 },
      reviewVersion: expect.any(String),
    });
    reviewed = body.reviewVersion;
    expect((await preview(FILE()).expect(200)).body.reviewVersion).toBe(reviewed);
    expect(await allLinks()).toEqual(before);
  });

  it('lists a group of another cohort or program, an unknown course, a duplicate pair and a missing value as row errors', async () => {
    const bad = file([
      `${clcOnly},${L}A`, // a CLC group: not in this cohort
      `${one},${L}ZZ`, // not in the catalog
      `${one},${L}C`,
      `${one},${L.toLowerCase()}c`, // record 4 again
      `,${L}D`,
      `${one},`,
      `${one},zl-1`,
      `zz-links ${suffix} missing,${L}ZY`,
      `${one},${L}D,${f.apcs2025}`, // a third field
    ]);
    const { body } = await preview(bad).expect(200);
    const noGroup = 'no requirement group of this cohort has this name; a file does not create groups';
    expect(body.errors).toEqual([
      { record: 2, field: 'requirement_group_name', message: noGroup },
      { record: 3, field: 'course_code', message: `No catalog course has the code ${L}ZZ; a catalog maintainer adds it first` },
      { record: 5, field: 'course_code', message: `this group and ${L}C are in record 4 already; a file names a link once` },
      { record: 6, field: 'requirement_group_name', message: 'a value is required' },
      { record: 7, field: 'course_code', message: '"" is not a course code (letters A-Z and digits, 2 to 20)' },
      { record: 8, field: 'course_code', message: '"zl-1" is not a course code (letters A-Z and digits, 2 to 20)' },
      { record: 9, field: 'requirement_group_name', message: noGroup },
      { record: 9, field: 'course_code', message: `No catalog course has the code ${L}ZY; a catalog maintainer adds it first` },
      { record: 10, field: null, message: 'has 3 fields; the template has 2' },
    ]);
    expect([body.reviewVersion, body.summary]).toEqual([null, { inserts: 1, updates: 0, noOps: 0 }]);
    // The file is wrong whatever the database holds: 400, and the one good row is not saved.
    expect((await confirm(bad, reviewed).expect(400)).body).toMatchObject({ code: 'validation_failed', errors: body.errors });
    expect(await links(g1)).toEqual([`${L}B`, `${L}F`]);
  });

  it('takes the program and the cohort from the route only: no column and no body field can change them', async () => {
    const scoped = `${LINKS_HEADER},curriculum_id\n${one},${L}A,${f.apcs2025}`;
    for (const res of [await preview(scoped), await confirm(scoped, reviewed)]) expect([res.status, res.body.code]).toEqual([400, 'validation_failed']);
    const a = f.as(admin);
    for (const res of [
      await a.post(`${base}/preview`, { csv: file([`${one},${L}A`]), curriculumId: f.apcs2025 }),
      await a.post(`${base}/confirm`, { csv: file([`${one},${L}A`]), reviewVersion: reviewed, programId: f.clc }),
    ]) {
      expect([res.status, res.body.code]).toEqual([400, 'validation_failed']);
    }
    expect(await links(g2025)).toEqual([]);
  });

  it('saves the whole previewed file, only in the cohort of the route, and leaves links the file does not name', async () => {
    expect((await confirm(FILE(), reviewed).expect(200)).body).toEqual({ fileType: 'group_links', summary: { inserts: 2, updates: 0, noOps: 1 } });
    // The 2025 cohort has a group of the same name: it got nothing. F was linked before and is in no file.
    expect(await allLinks()).toEqual({ g1: [`${L}A`, `${L}B`, `${L}F`], g2: [`${L}A`], g2025: [], gClc: [] });
  });

  it('imports the same file again as no-ops only: no duplicate link, and the old review no longer applies', async () => {
    const before = await allLinks();
    expect((await confirm(FILE(), reviewed).expect(409)).body.code).toBe('impact_changed');
    const again = await preview(FILE()).expect(200);
    expect([again.body.summary, again.body.errors]).toEqual([{ inserts: 0, updates: 0, noOps: 3 }, []]);
    expect((await confirm(FILE(), again.body.reviewVersion).expect(200)).body.summary).toEqual({ inserts: 0, updates: 0, noOps: 3 });
    expect(await allLinks()).toEqual(before);
  });

  it('answers 409 and writes nothing when the file, a link, a group or a catalog course changed since the preview', async () => {
    const stale = async (csv: string, version: string) => {
      const res = await confirm(csv, version);
      expect([res.status, res.body.code]).toEqual([409, 'impact_changed']);
    };
    const groups = `/api/admin/programs/${f.apcs}/cohorts/${f.apcs2024}/requirement-groups`;

    // The input changed.
    const first = await preview(file([`${one},${L}D`, `${TWO},${L}B`])).expect(200);
    await stale(file([`${one},${L}D`, `${TWO},${L}C`]), first.body.reviewVersion);

    // A link changed: one of the two rows was linked by hand in between. The other row is not saved either.
    const linked = file([`${one},${L}C`, `${TWO},${L}B`]);
    const beforeLink = await preview(linked).expect(200);
    await f.as(admin).put(`${groups}/${g1}/courses/${L}C`).expect(204);
    await stale(linked, beforeLink.body.reviewVersion);
    expect(await links(g2)).toEqual([`${L}A`]);

    // A reference changed: the group was renamed in between, so its name resolves nothing now.
    const renamed = file([`${TWO},${L}D`]);
    const beforeRename = await preview(renamed).expect(200);
    await f.as(admin).patch(`${groups}/${g2}`, { name: `${two} renamed` }).expect(200);
    await stale(renamed, beforeRename.body.reviewVersion);
    expect((await preview(renamed).expect(200)).body).toMatchObject({ reviewVersion: null, errors: [{ record: 2, field: 'requirement_group_name' }] });
    await f.as(admin).patch(`${groups}/${g2}`, { name: two }).expect(200);

    // The revision of the checks changed: a deploy in between.
    const checked = file([`${one},${L}D`]);
    const beforeDeploy = await preview(checked).expect(200);
    vi.spyOn(f.app.get(CsvImportService), 'validationRevision').mockReturnValue('f12-structural-2');
    await stale(checked, beforeDeploy.body.reviewVersion);
    vi.restoreAllMocks();

    // A reference changed: the catalog course was deleted in between.
    const deleted = file([`${one},${L}E`]);
    const beforeDelete = await preview(deleted).expect(200);
    await f.as(maintainer).delete(`/api/admin/catalog/courses/${L}E`).expect(204);
    await stale(deleted, beforeDelete.body.reviewVersion);

    expect(await allLinks()).toEqual({ g1: [`${L}A`, `${L}B`, `${L}C`, `${L}F`], g2: [`${L}A`], g2025: [], gClc: [] });
  });

  it('refuses the confirmation of an administrator whose program grant was revoked after the preview', async () => {
    const helper = await f.account({ program: f.apcs });
    const csv = file([`${one},${L}D`]);
    const { body } = await preview(csv, helper).expect(200);
    await f.db.query('DELETE FROM program_admin_grants WHERE user_id = $1', [helper.userId]);
    const refused = await confirm(csv, body.reviewVersion, helper).expect(403);
    expect([refused.body.code, refused.body.permission]).toEqual(['permission_required', 'program_admin']);
    expect(await links(g1)).not.toContain(`${L}D`);
  });

  it('rolls back every link when a save fails part-way', async () => {
    const csv = file([`${one},${L}D`, `${TWO},${L}B`, `${TWO},${L}C`]);
    const before = await allLinks();
    const { body } = await preview(csv).expect(200);
    expect(body.summary).toEqual({ inserts: 3, updates: 0, noOps: 0 });

    const curricula = f.app.get(CurriculumAdminService);
    const insert = curricula.insertLink.bind(curricula);
    let inserts = 0;
    vi.spyOn(curricula, 'insertLink').mockImplementation(async (em, groupId, code) => {
      if (++inserts === 3) throw new Error('injected');
      return insert(em, groupId, code);
    });
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const failed = await confirm(csv, body.reviewVersion);
    vi.restoreAllMocks();

    expect([failed.status, failed.body]).toEqual([500, { statusCode: 500, message: 'Internal server error' }]);
    expect(inserts).toBe(3);
    expect(await allLinks()).toEqual(before);
    expect((await confirm(csv, body.reviewVersion).expect(200)).body.summary).toEqual({ inserts: 3, updates: 0, noOps: 0 });
  });
});

describe('CSV import limits (e2e)', () => {
  const suffix = run();
  const M = `ZM${suffix}`;
  const groupName = `zz-limits ${suffix}`;
  let f: Fixture;
  let maintainer: Account;
  let admin: Account;
  let groupId: string;
  let links: string;

  // ASCII only, so that every character can be escaped to six bytes of JSON. Each record is
  // padded with spaces, which are trimmed: 100 records of about 1.3 KiB are over 100 KiB.
  const PAD = ' '.repeat(1250);
  const code = (n: number) => `${M}${String(n).padStart(4, '0')}`;
  const courseRows = (count: number, pad = PAD) => Array.from({ length: count }, (_, n) => `${code(n)},Synthetic course ${n},${pad},3,,,,`);
  const linkRows = (count: number, pad = PAD) => Array.from({ length: count }, (_, n) => `${groupName},${code(n)}${pad}`);
  const csvOf = (header: string, rows: string[]) => `${header}\n${rows.join('\n')}\n`;
  /** The file padded with blank lines, which are ignored, to exactly `bytes` bytes. */
  const paddedTo = (csv: string, bytes: number) => csv + '\n'.repeat(bytes - Buffer.byteLength(csv));
  /** A JSON body whose csv has every character written as a six-byte \uXXXX escape. */
  const escapedBody = (csv: string, reviewVersion?: string) => {
    const escaped = Array.from(csv, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
    return `{"csv":"${escaped}"${reviewVersion === undefined ? '' : `,"reviewVersion":${JSON.stringify(reviewVersion)}`}}`;
  };
  const routes = () => [
    { path: `${CATALOG}/preview`, account: maintainer, header: COURSES_HEADER, rows: courseRows, confirm: false },
    { path: `${CATALOG}/confirm`, account: maintainer, header: COURSES_HEADER, rows: courseRows, confirm: true },
    { path: `${links}/preview`, account: admin, header: LINKS_HEADER, rows: linkRows, confirm: false },
    { path: `${links}/confirm`, account: admin, header: LINKS_HEADER, rows: linkRows, confirm: true },
  ];
  const bodyFor = (route: ReturnType<typeof routes>[number], csv: string) => (route.confirm ? { csv, reviewVersion: 'x' } : { csv });

  beforeAll(async () => {
    f = await fixture('zz-limits', M);
    [maintainer, admin] = [await f.account('catalog_maintainer'), await f.account({ program: f.apcs })];
    groupId = await f.group(f.apcs2024, groupName);
    links = cohortImports(f.apcs, f.apcs2024);
  });

  afterAll(async () => {
    await f?.close();
  });

  const count = async (sql: string, params: unknown[]) => ((await f.db.query(sql, params)) as { n: number }[])[0].n;
  const savedCourses = () => count('SELECT count(*)::int AS n FROM courses WHERE code LIKE $1', [`${M}%`]);
  const savedLinks = () => count('SELECT count(*)::int AS n FROM requirement_group_courses WHERE requirement_group_id = $1', [groupId]);

  it('previews and confirms a valid file larger than 100 KiB on both pairs of routes', async () => {
    const courses = csvOf(COURSES_HEADER, courseRows(100));
    const groupLinks = csvOf(LINKS_HEADER, linkRows(100));
    for (const csv of [courses, groupLinks]) expect(Buffer.byteLength(JSON.stringify({ csv }))).toBeGreaterThan(100 * 1024);

    const m = f.as(maintainer);
    const coursePreview = await m.post(`${CATALOG}/preview`, { csv: courses }).expect(200);
    expect(coursePreview.body.summary).toEqual({ inserts: 100, updates: 0, noOps: 0 });
    await m.post(`${CATALOG}/confirm`, { csv: courses, reviewVersion: coursePreview.body.reviewVersion }).expect(200);
    expect(await savedCourses()).toBe(100);

    const a = f.as(admin);
    const linkPreview = await a.post(`${links}/preview`, { csv: groupLinks }).expect(200);
    expect(linkPreview.body.summary).toEqual({ inserts: 100, updates: 0, noOps: 0 });
    await a.post(`${links}/confirm`, { csv: groupLinks, reviewVersion: linkPreview.body.reviewVersion }).expect(200);
    expect(await savedLinks()).toBe(100);
  });

  it('takes a CSV of exactly 1 MiB with every character escaped: more than 6 MiB of JSON, on preview and on confirm', async () => {
    for (const [route, confirmRoute] of [routes().slice(0, 2), routes().slice(2)]) {
      const csv = paddedTo(csvOf(route.header, route.rows(100)), MIB);
      expect(Buffer.byteLength(csv)).toBe(MIB);
      const previewBody = escapedBody(csv);
      expect(Buffer.byteLength(previewBody)).toBeGreaterThan(6 * MIB);
      const preview = await f.as(route.account).post(route.path, previewBody).expect(200);
      // The rows are those the test above saved.
      expect(preview.body.summary).toEqual({ inserts: 0, updates: 0, noOps: 100 });
      const confirmed = await f.as(route.account).post(confirmRoute.path, escapedBody(csv, preview.body.reviewVersion)).expect(200);
      expect(confirmed.body.summary).toEqual({ inserts: 0, updates: 0, noOps: 100 });
    }
    expect([await savedCourses(), await savedLinks()]).toEqual([100, 100]);
  });

  it('refuses a CSV one byte over 1 MiB with 413 on each of the four routes', async () => {
    for (const route of routes()) {
      const csv = paddedTo(csvOf(route.header, route.rows(100)), MIB + 1);
      const refused = await f.as(route.account).post(route.path, bodyFor(route, csv)).expect(413);
      expect(refused.body).toEqual({ statusCode: 413, code: 'payload_too_large', message: 'The CSV is larger than 1 MiB of UTF-8 text' });
    }
  });

  it('takes 1,000 data records and refuses 1,001 with 413 on each of the four routes', async () => {
    for (const route of routes()) {
      const atLimit = await f.as(route.account).post(route.path, bodyFor(route, csvOf(route.header, route.rows(1000, ''))));
      // The preview reads all 1,000 rows (the links name 900 courses the catalog lacks: row
      // errors, not a refusal); the confirmation gets as far as the review version.
      const read = atLimit.body.code ?? atLimit.body.rows.length + atLimit.body.errors.length;
      expect([route.path, atLimit.status, read]).toEqual([route.path, route.confirm ? 409 : 200, route.confirm ? 'impact_changed' : 1000]);
      const refused = await f.as(route.account).post(route.path, bodyFor(route, csvOf(route.header, route.rows(1001, '')))).expect(413);
      expect(refused.body).toEqual({ statusCode: 413, code: 'payload_too_large', message: 'The CSV has more than 1000 data records' });
    }
    expect([await savedCourses(), await savedLinks()]).toEqual([100, 100]);
  });

  it('refuses a JSON body over 7 MiB with 413 on each of the four routes', async () => {
    for (const route of routes()) {
      const refused = await f.as(route.account).post(route.path, JSON.stringify(bodyFor(route, 'a'.repeat(7 * MIB)))).expect(413);
      expect(refused.body).toEqual({ statusCode: 413, code: 'payload_too_large', message: 'The request body is larger than 7 MiB' });
    }
  });

  it('gives the 7 MiB parser only to a signed-in holder of the grant of the route: anyone else is refused at 100 KiB', async () => {
    const stranger = await f.account();
    const revoked = await f.account('catalog_maintainer');
    await f.db.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1', [revoked.userId]);
    const unparsed = { statusCode: 413, message: 'request entity too large' };
    const large = { csv: 'a'.repeat(150 * 1024) };
    const http = () => request(f.app.getHttpServer());
    for (const route of routes()) {
      // No token, and a 7 MiB body: the default parser refuses it on its declared length, as on any route.
      expect((await http().post(route.path).set('Content-Type', 'application/json').send(JSON.stringify(bodyFor(route, 'a'.repeat(7 * MIB)))).expect(413)).body).toEqual(unparsed);
      expect((await http().post(route.path).send(large).expect(413)).body).toEqual(unparsed);
      // A token that is no session, a revoked session, a signed-in user without a grant, and the grant of the other route family.
      const others = [{ token: 'no-such-session', userId: '' }, revoked, stranger, route.account === maintainer ? admin : maintainer];
      for (const account of others) expect((await f.as(account).post(route.path, large).expect(413)).body).toEqual(unparsed);
      // Under 100 KiB they reach the route and get its own answer.
      await http().post(route.path).send(bodyFor(route, route.header)).expect(401);
      expect((await f.as(stranger).post(route.path, bodyFor(route, route.header)).expect(403)).body.code).toBe('permission_required');
    }
    // A program grant opens the large parser for that program only.
    const clcImports = `${cohortImports(f.clc, f.clcCurriculum)}/preview`;
    expect((await f.as(admin).post(clcImports, large).expect(413)).body).toEqual(unparsed);
    // The holder of the grant is still served above 100 KiB: the answer comes from the route, about the file.
    expect((await f.as(maintainer).post(`${CATALOG}/preview`, large).expect(400)).body.code).toBe('validation_failed');
    expect((await f.as(admin).post(`${links}/preview`, large).expect(400)).body.code).toBe('validation_failed');
  });

  it('refuses a compressed body with 415 on each of the four routes, for a holder of the grant as for anyone', async () => {
    // About 7 KiB on the wire, 7 MiB once inflated; it is never inflated.
    const bomb = gzipSync(JSON.stringify({ csv: 'a'.repeat(7 * MIB), reviewVersion: 'x' }));
    expect(bomb.length).toBeLessThan(10 * 1024);
    for (const route of routes()) {
      for (const token of [route.account.token, null]) {
        const test = request(f.app.getHttpServer()).post(route.path).set('Content-Type', 'application/json').set('Content-Encoding', 'gzip');
        const refused = await (token ? test.set('Authorization', `Bearer ${token}`) : test).serialize((bytes) => bytes as string).send(bomb).expect(415);
        expect(refused.body).toEqual({ statusCode: 415, code: 'unsupported_content_encoding', message: 'The import routes do not accept a compressed request body' });
      }
    }
  });

  it('keeps the 100 KiB JSON limit on the other routes, which still take a body under it', async () => {
    const m = f.as(maintainer);
    const large = 'x'.repeat(100 * 1024);
    const group = `/api/admin/programs/${f.apcs}/cohorts/${f.apcs2024}`;
    const refused = [
      await m.post('/api/admin/catalog/courses', { code: `${M}BIG`, nameVi: large, credits: 3 }),
      await m.patch(`/api/admin/catalog/courses/${code(0)}`, { nameVi: large }),
      await f.as(admin).put(`${group}/courses/${code(0)}/prerequisites`, { prerequisites: [], padding: large }),
      await f.as(admin).post(`${group}/requirement-groups`, { name: groupName, kind: 'elective', officialNotes: large }),
      await request(f.app.getHttpServer()).post('/api/auth/sign-in').send({ email: 'limits@example.com', password: large }),
      // An import path with something after it is not an import route.
      await m.post(`${CATALOG}/preview/again`, { csv: large }),
    ];
    expect(refused.map((res) => res.status)).toEqual([413, 413, 413, 413, 413, 413]);
    await m.post('/api/admin/catalog/courses', { code: `${M}SMALL`, nameVi: 'x'.repeat(255), credits: 3 }).expect(201);
  });

  it('documents exactly these four routes as imports, each with its 413', async () => {
    const { body } = await request(f.app.getHttpServer()).get('/api/docs-json').expect(200);
    const imports = Object.entries(body.paths as Record<string, Record<string, { responses: Record<string, object>; security?: unknown[] }>>).filter(([path]) => path.includes('/imports'));
    expect(imports.map(([path, item]) => [path, Object.keys(item)])).toEqual([
      ['/api/admin/catalog/imports/preview', ['post']],
      ['/api/admin/catalog/imports/confirm', ['post']],
      ['/api/admin/programs/{programId}/cohorts/{curriculumId}/imports/preview', ['post']],
      ['/api/admin/programs/{programId}/cohorts/{curriculumId}/imports/confirm', ['post']],
    ]);
    for (const [, item] of imports) {
      expect(Object.keys(item.post.responses)).toEqual(expect.arrayContaining(['200', '400', '401', '403', '404', '413', '415']));
      expect(item.post.security).toEqual([{ bearer: [] }]);
      expect(item.post.responses['400']).toMatchObject({ content: { 'application/json': { schema: { $ref: '#/components/schemas/ImportRejectedDto' } } } });
    }
  });
});
