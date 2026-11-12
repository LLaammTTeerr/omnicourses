import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApp } from './support/app.js';
import { signedInUser } from './support/users.js';

interface Event {
  id: string;
  academicYear: number;
  term: number | null;
  kind: string;
  startsOn: string;
  endsOn: string;
  title: string;
  titleEn: string | null;
  sourceUrl: string | null;
  notes: string | null;
  updatedAt: string;
}

// Synthetic programs and dates only (AGENTS.md hard rule 3), unique per run and removed in
// afterAll: e2e files share one database, and nothing here touches a seeded program.
describe('Academic calendar API (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (path: string) => http().get(path).set('Authorization', `Bearer ${token}`),
    post: (path: string, body: object = {}) => http().post(path).set('Authorization', `Bearer ${token}`).send(body),
    patch: (path: string, body: object = {}) => http().patch(path).set('Authorization', `Bearer ${token}`).send(body),
    delete: (path: string) => http().delete(path).set('Authorization', `Bearer ${token}`),
  });

  const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  const codeA = `ZZCAL${suffix}A`;
  const codeB = `ZZCAL${suffix}B`;
  let programA: string;
  let programB: string;
  let adminA: { token: string; userId: string };
  let adminB: { token: string; userId: string };
  let manager: { token: string; userId: string };
  let student: { token: string; userId: string };
  let newcomer: { token: string; userId: string };
  const events = (program: string) => `/api/admin/programs/${program}/calendar-events`;
  const calendar = (query = '') => `/api/academic-calendar${query}`;
  const valid = { academicYear: 2026, term: 1, kind: 'term_start', startsOn: '2026-09-07', title: 'Bắt đầu học kỳ 1' };

  beforeAll(async () => {
    app = await bootApp();
    db = app.get(DataSource);
    [adminA, adminB, manager, student, newcomer] = await Promise.all([signedInUser(app), signedInUser(app), signedInUser(app), signedInUser(app), signedInUser(app)]);
    const insertProgram = async (code: string) => ((await db.query(`INSERT INTO programs (code, name_vi) VALUES ($1, $2) RETURNING id`, [code, `Chương trình ${code}`])) as { id: string }[])[0].id;
    programA = await insertProgram(codeA);
    programB = await insertProgram(codeB);
    await db.query(`INSERT INTO program_admin_grants (user_id, program_id) VALUES ($1, $2), ($3, $4)`, [adminA.userId, programA, adminB.userId, programB]);
    await db.query(`INSERT INTO global_admin_grants (user_id, permission) VALUES ($1, 'access_manager'), ($1, 'catalog_maintainer')`, [manager.userId]);
    await db.query(`INSERT INTO onboarding_answers (user_id, program_code, cohort_year) VALUES ($1, $2, 2026)`, [student.userId, codeA]);
  });

  afterAll(async () => {
    if (db?.isInitialized && programA) {
      const programs = [programA, programB].filter(Boolean);
      const users = [adminA, adminB, manager, student, newcomer].map((u) => u.userId);
      await db.query('DELETE FROM academic_calendar_events WHERE program_id = ANY($1)', [programs]);
      await db.query('DELETE FROM program_admin_grants WHERE user_id = ANY($1) OR program_id = ANY($2)', [users, programs]);
      await db.query('DELETE FROM global_admin_grants WHERE user_id = ANY($1)', [users]);
      await db.query('DELETE FROM onboarding_answers WHERE user_id = ANY($1)', [users]);
      await db.query('DELETE FROM programs WHERE id = ANY($1)', [programs]);
    }
    await app?.close();
  });

  it('maps the table exactly as migration 1794500000000 creates it', async () => {
    const { upQueries } = await db.driver.createSchemaBuilder().log();
    expect(upQueries.map((q) => q.query).filter((q) => q.includes('"academic_calendar_events"'))).toEqual([]);
  });

  it('refuses every route without a token', async () => {
    await http().get(calendar()).expect(401);
    await http().post(events(programA)).send(valid).expect(401);
    await http().patch(`${events(programA)}/${randomUUID()}`).send({ title: 'x' }).expect(401);
    await http().delete(`${events(programA)}/${randomUUID()}`).expect(401);
  });

  it("answers an empty list, never invented dates, for the student's program before anything is entered", async () => {
    const { body } = await as(student.token).get(calendar()).expect(200);
    expect(body).toEqual({ program: { id: programA, code: codeA, nameVi: `Chương trình ${codeA}`, nameEn: null }, events: [] });
  });

  it('answers program null and no dates to a student who has not chosen a program', async () => {
    expect((await as(newcomer.token).get(calendar()).expect(200)).body).toEqual({ program: null, events: [] });
  });

  it('answers 404 not_found for an unknown program code', async () => {
    const res = await as(student.token).get(calendar(`?program=ZZNOPE${suffix}`)).expect(404);
    expect(res.body.code).toBe('not_found');
  });

  it('refuses writes to a student, to an access manager and catalog maintainer, and to the administrator of another program', async () => {
    for (const caller of [student, manager, adminB]) {
      const res = await as(caller.token).post(events(programA), valid);
      expect([res.status, res.body.code, res.body.permission]).toEqual([403, 'permission_required', 'program_admin']);
    }
    expect((await as(student.token).get(calendar()).expect(200)).body.events).toEqual([]);
  });

  describe('once the administrator has entered dates', () => {
    let registration: Event;
    let termStart: Event;
    let holiday: Event;
    let examB: Event;

    beforeAll(async () => {
      // Entered out of order, to show the read sorts by date.
      termStart = (await as(adminA.token).post(events(programA), valid).expect(201)).body;
      holiday = (
        await as(adminA.token)
          .post(events(programA), { academicYear: 2026, kind: 'holiday', startsOn: '2027-02-10', endsOn: '2027-02-21', title: 'Nghỉ Tết', titleEn: 'Lunar New Year break', notes: 'Synthetic' })
          .expect(201)
      ).body;
      registration = (
        await as(adminA.token)
          .post(events(programA), {
            academicYear: 2026,
            term: 1,
            kind: 'registration',
            startsOn: '2026-07-20',
            endsOn: '2026-07-31',
            title: '  Đăng ký học phần học kỳ 1  ',
            titleEn: 'Term 1 course registration',
            sourceUrl: 'https://example.edu.vn/thong-bao/dang-ky-hk1',
          })
          .expect(201)
      ).body;
      examB = (await as(adminB.token).post(events(programB), { academicYear: 2026, term: 1, kind: 'exam_period', startsOn: '2026-12-21', endsOn: '2027-01-08', title: 'Thi cuối kỳ' }).expect(201)).body;
    });

    it('returns the saved event: dates as YYYY-MM-DD, endsOn defaulting to startsOn, trimmed title, no actor IDs', () => {
      expect(termStart).toEqual({
        id: expect.any(String),
        academicYear: 2026,
        term: 1,
        kind: 'term_start',
        startsOn: '2026-09-07',
        endsOn: '2026-09-07',
        title: 'Bắt đầu học kỳ 1',
        titleEn: null,
        sourceUrl: null,
        notes: null,
        updatedAt: expect.any(String),
      });
      expect(registration.title).toBe('Đăng ký học phần học kỳ 1');
      expect(holiday.term).toBeNull();
    });

    it("lists the student's program only, ordered by date", async () => {
      const { body } = await as(student.token).get(calendar()).expect(200);
      expect(body.program.code).toBe(codeA);
      expect((body.events as Event[]).map((e) => e.id)).toEqual([registration.id, termStart.id, holiday.id]);
      expect(body.events[0]).toEqual(registration);
    });

    it('orders same-day dates by end, then title', async () => {
      const late = (await as(adminA.token).post(events(programA), { ...valid, kind: 'other', endsOn: '2026-09-09', title: 'A: tuần sinh hoạt công dân' }).expect(201)).body as Event;
      const sameB = (await as(adminA.token).post(events(programA), { ...valid, kind: 'other', title: 'Z: khai giảng' }).expect(201)).body as Event;
      const { body } = await as(student.token).get(calendar('?from=2026-09-07&to=2026-09-07')).expect(200);
      expect((body.events as Event[]).map((e) => e.id)).toEqual([termStart.id, sameB.id, late.id]);
      await as(adminA.token).delete(`${events(programA)}/${late.id}`).expect(204);
      await as(adminA.token).delete(`${events(programA)}/${sameB.id}`).expect(204);
    });

    it('lets anyone read another program by code', async () => {
      const { body } = await as(student.token).get(calendar(`?program=${codeB}`)).expect(200);
      expect(body.program.id).toBe(programB);
      expect((body.events as Event[]).map((e) => e.id)).toEqual([examB.id]);
    });

    it('filters by academic year and by overlap with from/to', async () => {
      expect((await as(student.token).get(calendar('?academicYear=2025')).expect(200)).body.events).toEqual([]);
      expect((await as(student.token).get(calendar('?academicYear=2026')).expect(200)).body.events).toHaveLength(3);
      // A window that opened before `from` and is still open counts.
      const july = (await as(student.token).get(calendar('?from=2026-07-25&to=2026-08-31')).expect(200)).body.events as Event[];
      expect(july.map((e) => e.id)).toEqual([registration.id]);
      const fromSept = (await as(student.token).get(calendar('?from=2026-09-01')).expect(200)).body.events as Event[];
      expect(fromSept.map((e) => e.id)).toEqual([termStart.id, holiday.id]);
      const toAug = (await as(student.token).get(calendar('?to=2026-08-01')).expect(200)).body.events as Event[];
      expect(toAug.map((e) => e.id)).toEqual([registration.id]);
    });

    it('refuses malformed query values', async () => {
      const s = as(student.token);
      expect((await s.get(calendar('?from=2026-10-01&to=2026-09-01')).expect(400)).body.code).toBe('validation_failed');
      await s.get(calendar('?from=2026-02-30')).expect(400);
      await s.get(calendar('?to=2026-09-01T00:00:00Z')).expect(400);
      await s.get(calendar('?academicYear=next')).expect(400);
      await s.get(calendar('?academicYear=1999')).expect(400);
    });

    it('refuses invalid bodies with validation_failed and saves nothing', async () => {
      const bad: object[] = [
        { ...valid, userId: student.userId },
        { ...valid, createdBy: student.userId },
        { ...valid, startsOn: '2026-02-30' },
        { ...valid, startsOn: '2026-09-07T00:00:00Z' },
        { ...valid, endsOn: '2026-09-06' },
        { ...valid, startsOn: '2025-12-31' },
        { ...valid, startsOn: '2028-01-01' },
        { ...valid, kind: 'party' },
        { ...valid, term: 4 },
        { ...valid, academicYear: 1999 },
        { ...valid, title: '   ' },
        { ...valid, title: 'x'.repeat(256) },
        { ...valid, sourceUrl: 'http://example.edu.vn/a' },
        { ...valid, sourceUrl: 'javascript:alert(1)' },
        { ...valid, notes: 'x'.repeat(2001) },
        { kind: 'term_start', startsOn: '2026-09-07', title: 'no year' },
      ];
      for (const body of bad) {
        const res = await as(adminA.token).post(events(programA), body);
        expect([res.status, res.body.code], JSON.stringify(body)).toEqual([400, 'validation_failed']);
      }
      expect((await as(student.token).get(calendar()).expect(200)).body.events).toHaveLength(3);
    });

    it('updates the given fields, checks the merged range against stored dates, and clears with null or blank', async () => {
      const path = `${events(programA)}/${registration.id}`;
      const lone = await as(adminA.token).patch(path, { endsOn: '2026-07-19' });
      expect([lone.status, lone.body.code]).toEqual([400, 'validation_failed']);
      await as(adminA.token).patch(path, { startsOn: '2026-08-01' }).expect(400);
      await as(adminA.token).patch(path, { academicYear: 2027 }).expect(400);
      await as(adminA.token).patch(path, { id: randomUUID() }).expect(400);

      const moved = (await as(adminA.token).patch(path, { endsOn: '2026-08-02', notes: 'Gia hạn' }).expect(200)).body as Event;
      expect(moved).toMatchObject({ startsOn: '2026-07-20', endsOn: '2026-08-02', notes: 'Gia hạn', title: registration.title, sourceUrl: registration.sourceUrl });
      expect(moved.updatedAt >= registration.updatedAt).toBe(true);

      const cleared = (await as(adminA.token).patch(path, { sourceUrl: null, titleEn: '', term: null }).expect(200)).body as Event;
      expect(cleared).toMatchObject({ sourceUrl: null, titleEn: null, term: null });
      expect((await as(adminA.token).patch(path, { sourceUrl: '' }).expect(200)).body.sourceUrl).toBeNull();
      registration = (await as(adminA.token).patch(path, { sourceUrl: 'https://example.edu.vn/thong-bao/dang-ky-hk1' }).expect(200)).body;
    });

    it('answers 404 for an event of another program under this program, and 403 to the other administrator', async () => {
      const crossPath = `${events(programA)}/${examB.id}`;
      expect((await as(adminA.token).patch(crossPath, { title: 'x' }).expect(404)).body.code).toBe('not_found');
      await as(adminA.token).delete(crossPath).expect(404);
      const own = `${events(programA)}/${termStart.id}`;
      for (const res of [await as(adminB.token).patch(own, { title: 'x' }), await as(adminB.token).delete(own), await as(student.token).delete(own)]) {
        expect([res.status, res.body.code]).toEqual([403, 'permission_required']);
      }
      expect((await as(student.token).get(calendar(`?program=${codeB}`)).expect(200)).body.events[0].title).toBe('Thi cuối kỳ');
    });

    it('refuses a path ID that is not a UUID', async () => {
      expect((await as(adminA.token).post(events('not-a-uuid'), valid).expect(400)).body.code).toBe('validation_failed');
      await as(adminA.token).delete(`${events(programA)}/42`).expect(400);
    });

    it('deletes an event once', async () => {
      const temp = (await as(adminA.token).post(events(programA), { ...valid, kind: 'add_drop', title: 'Tạm' }).expect(201)).body as Event;
      await as(adminA.token).delete(`${events(programA)}/${temp.id}`).expect(204);
      await as(adminA.token).delete(`${events(programA)}/${temp.id}`).expect(404);
      expect(((await as(student.token).get(calendar()).expect(200)).body.events as Event[]).map((e) => e.id)).not.toContain(temp.id);
    });

    it("keeps the dates, without attribution, when the administrator's account is purged", async () => {
      const leaving = await signedInUser(app);
      await db.query('INSERT INTO program_admin_grants (user_id, program_id) VALUES ($1, $2)', [leaving.userId, programA]);
      const event = (await as(leaving.token).post(events(programA), { ...valid, kind: 'term_end', startsOn: '2027-01-15', title: 'Kết thúc học kỳ 1' }).expect(201)).body as Event;
      await db.query('DELETE FROM users WHERE id = $1', [leaving.userId]);
      const [row] = await db.query('SELECT created_by, updated_by FROM academic_calendar_events WHERE id = $1', [event.id]);
      expect(row).toEqual({ created_by: null, updated_by: null });
    });
  });
});
