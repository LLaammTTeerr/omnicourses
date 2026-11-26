import { randomUUID } from 'node:crypto';
import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { DataSource, QueryFailedError } from 'typeorm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademicCalendarService } from '../src/academic-calendar/academic-calendar.service.js';
import { AccountPurgeService } from '../src/account/account-purge.service.js';
import { Clock } from '../src/config/clock.js';
import { NotificationSchedule } from '../src/notifications/notification-schedule.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { TranscriptEntry } from '../src/transcript/transcript-entry.js';
import { TranscriptService } from '../src/transcript/transcript.service.js';
import { UsersService } from '../src/users/users.service.js';
import { type Account, authed, grantProgram, runSuffix } from './support/admin.js';
import { bootApp } from './support/app.js';
import { signedInUser, storedUser } from './support/users.js';

interface Notice {
  id: string;
  kind: string;
  createdAt: string;
  readAt: string | null;
  event: { id: string; programCode: string; academicYear: number; term: number | null; startsOn: string; endsOn: string; title: string; titleEn: string | null } | null;
  links: string[];
}

const rows: TranscriptEntry[] = [
  { courseCode: 'ZZ101', courseName: 'Synthetic One', credits: 4, result: 'graded', grade: 4.5, term: { year: 2025, number: 1 } },
  { courseCode: 'ZZ101', courseName: 'Synthetic One', credits: 4, result: 'graded', grade: 8, term: { year: 2025, number: 3 } },
  { courseCode: 'ZZ102', courseName: 'Synthetic Two', credits: 3, result: 'in_progress', grade: null, term: { year: 2026, number: 1 } },
];

const FAIL_ONE_DATE = 'zz_notifications_fail_one_date';
const SESSION_DAYS_LONGER_THAN_THE_CLOCK_MOVES = '1000';

describe('Notification inbox (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let notifications: NotificationsService;
  const clock = {
    at: new Date('2090-01-01T05:00:00Z'),
    now(): Date {
      return new Date(this.at);
    },
  };
  const onDay = (day: string, time = '12:00:00') => {
    clock.at = new Date(`${day}T${time}+07:00`);
  };
  const http = () => request(app.getHttpServer());
  const as = authed(() => app);

  const suffix = runSuffix();
  const codeA = `ZZNTF${suffix}A`;
  const codeB = `ZZNTF${suffix}B`;
  let programA: string;
  let programB: string;
  let adminA: Account;
  let adminB: Account;
  const userIds: string[] = [];

  async function student(programCode?: string, finished = true): Promise<Account> {
    const user = await signedInUser(app);
    userIds.push(user.userId);
    if (programCode) await join(user, programCode, finished);
    return user;
  }
  const join = (user: Account, programCode: string, finished = true) =>
    db.query(
      `INSERT INTO onboarding_answers (user_id, program_code, cohort_year, finished_at) VALUES ($1, $2, 2090, CASE WHEN $3::boolean THEN now() END)
       ON CONFLICT (user_id) DO UPDATE SET program_code = EXCLUDED.program_code`,
      [user.userId, programCode, finished],
    );

  const events = (program: string) => `/api/admin/programs/${program}/calendar-events`;
  async function enter(kind: string, startsOn: string, extra: object = {}, admin = adminA, program = programA): Promise<string> {
    const body = { academicYear: Number(startsOn.slice(0, 4)), term: 1, kind, startsOn, title: `Synthetic ${kind} ${startsOn}`, ...extra };
    const res = await as(admin.token).post(events(program), body);
    if (res.status === 400) return (await as(admin.token).post(events(program), { ...body, academicYear: body.academicYear - 1 }).expect(201)).body.id;
    expect(res.status).toBe(201);
    return res.body.id;
  }

  const inbox = async (user: Account, query = ''): Promise<Notice[]> => (await as(user.token).get(`/api/notifications${query}`).expect(200)).body.notifications;
  const stored = async (user: Account, eventId: string): Promise<string[]> =>
    ((await db.query('SELECT kind FROM notifications WHERE user_id = $1 AND calendar_event_id = $2 ORDER BY kind', [user.userId, eventId])) as { kind: string }[]).map((r) => r.kind);
  const seen = async (user: Account, eventId: string): Promise<string[]> =>
    (await notifications.list(user.userId, {})).notifications.filter((n) => n.event?.id === eventId).map((n) => n.kind);
  const total = async (eventId: string): Promise<number> => ((await db.query('SELECT count(*)::int AS n FROM notifications WHERE calendar_event_id = $1', [eventId])) as { n: number }[])[0]!.n;
  const transcriptNotices = async (user: Account): Promise<number> =>
    ((await db.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND kind = 'transcript_changed'`, [user.userId])) as { n: number }[])[0]!.n;
  const save = (user: Account, body: TranscriptEntry[]) => as(user.token).put('/api/users/me/transcript', { rows: body });

  beforeAll(async () => {
    vi.stubEnv('SESSION_TTL_DAYS', SESSION_DAYS_LONGER_THAN_THE_CLOCK_MOVES);
    app = await bootApp((builder) =>
      builder
        .overrideProvider(Clock)
        .useValue(clock)
        .overrideProvider(AccountPurgeService)
        .useFactory({ factory: (users: UsersService) => new AccountPurgeService(users, new Clock()), inject: [UsersService] }),
    );
    db = app.get(DataSource);
    notifications = app.get(NotificationsService);
    await db.query(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS ${FAIL_ONE_DATE}`);
    const insertProgram = async (code: string) => ((await db.query(`INSERT INTO programs (code, name_vi) VALUES ($1, $2) RETURNING id`, [code, `Chương trình ${code}`])) as { id: string }[])[0]!.id;
    programA = await insertProgram(codeA);
    programB = await insertProgram(codeB);
    adminA = await student();
    adminB = await student();
    await grantProgram(db, adminA.userId, programA);
    await grantProgram(db, adminB.userId, programB);
  });

  afterAll(async () => {
    if (db?.isInitialized && programA) {
      const programs = [programA, programB].filter(Boolean);
      await db.query('DELETE FROM academic_calendar WHERE program_id = ANY($1)', [programs]);
      await db.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
      await db.query('DELETE FROM programs WHERE id = ANY($1)', [programs]);
    }
    await app?.close();
    vi.unstubAllEnvs();
  });

  it('purges accounts by the wall clock, not by the clock this file sets in 2090', async () => {
    const userId = await storedUser(app);
    userIds.push(userId);
    await db.query('UPDATE users SET deletion_requested_at = now(), purge_after = $2 WHERE id = $1', [userId, '2050-01-01T00:00:00Z']);
    await app.get(AccountPurgeService).purge();
    expect(await db.query('SELECT id FROM users WHERE id = $1', [userId])).toHaveLength(1);
  });

  it('maps the table exactly as migration 1795575059760 creates it', async () => {
    const { upQueries } = await db.driver.createSchemaBuilder().log();
    expect(upQueries.map((q) => q.query).filter((q) => q.includes('"notifications"'))).toEqual([]);
  });

  it('refuses every route without a token', async () => {
    await http().get('/api/notifications').expect(401);
    await http().get('/api/notifications/unread-count').expect(401);
    await http().post('/api/notifications/read-all').expect(401);
    await http().post(`/api/notifications/${randomUUID()}/read`).expect(401);
  });

  describe('school dates', () => {
    it('announces a registration window seven days before it opens and on the day it opens, once each', async () => {
      const s = await student(codeA);
      onDay('2090-03-01');
      const window = await enter('registration', '2090-03-20', { endsOn: '2090-03-31', titleEn: 'Synthetic registration window' });

      onDay('2090-03-12');
      expect(await inbox(s)).toEqual([]);

      onDay('2090-03-13');
      const [soon, ...rest] = await inbox(s);
      expect(rest).toEqual([]);
      expect(soon).toEqual({
        id: expect.any(String),
        kind: 'registration_soon',
        createdAt: '2090-03-13T05:00:00.000Z',
        readAt: null,
        event: { id: window, programCode: codeA, academicYear: 2090, term: 1, startsOn: '2090-03-20', endsOn: '2090-03-31', title: 'Synthetic registration 2090-03-20', titleEn: 'Synthetic registration window' },
        links: ['calendar', 'planner'],
      });
      expect(await inbox(s)).toEqual([soon]);
      await notifications.createDue();
      await notifications.createDue();
      expect(await total(window)).toBe(1);

      for (const between of ['2090-03-14', '2090-03-19']) {
        onDay(between);
        expect(await seen(s, window)).toEqual(['registration_soon']);
      }

      onDay('2090-03-20');
      expect((await inbox(s)).map((n) => n.kind)).toEqual(['registration_open', 'registration_soon']);

      for (const after of ['2090-03-21', '2090-03-27', '2090-03-31']) {
        onDay(after);
        expect(await seen(s, window)).toEqual(['registration_open', 'registration_soon']);
      }
      expect((await as(s.token).get('/api/notifications/unread-count').expect(200)).body).toEqual({ unread: 2 });
    });

    it('announces a term on its first day only', async () => {
      const s = await student(codeA);
      onDay('2090-04-01');
      const term = await enter('term_start', '2090-04-20', { term: 2 });
      for (const before of ['2090-04-13', '2090-04-19']) {
        onDay(before);
        expect(await seen(s, term)).toEqual([]);
      }
      onDay('2090-04-20');
      const [notice] = await inbox(s);
      expect(notice).toMatchObject({ kind: 'term_start', event: { id: term, term: 2, startsOn: '2090-04-20', endsOn: '2090-04-20' }, links: ['calendar'] });
      onDay('2090-04-21');
      expect(await seen(s, term)).toEqual(['term_start']);
    });

    it('changes day at 00:00 in Vietnam, 17:00:00 UTC, exactly', async () => {
      const s = await student(codeA);
      onDay('2090-05-01');
      const window = await enter('registration', '2090-05-20');
      const term = await enter('term_start', '2090-05-13');

      clock.at = new Date('2090-05-12T16:59:59.999Z');
      expect(await seen(s, window)).toEqual([]);
      expect(await seen(s, term)).toEqual([]);

      clock.at = new Date('2090-05-12T17:00:00.000Z');
      expect(await seen(s, window)).toEqual(['registration_soon']);
      expect(await seen(s, term)).toEqual(['term_start']);

      clock.at = new Date('2090-05-19T16:59:59.999Z');
      expect(await seen(s, window)).toEqual(['registration_soon']);
      clock.at = new Date('2090-05-19T17:00:00.000Z');
      expect(await seen(s, window)).toEqual(['registration_open', 'registration_soon']);
    });

    it("creates the day's notifications from the timer, without any read", async () => {
      const s = await student(codeA);
      onDay('2090-06-01');
      const term = await enter('term_start', '2090-06-10');
      onDay('2090-06-10', '00:00:00');
      expect(await stored(s, term)).toEqual([]);
      await app.get(NotificationSchedule).tick();
      expect(await stored(s, term)).toEqual(['term_start']);
      await app.get(NotificationSchedule).tick();
      expect(await stored(s, term)).toEqual(['term_start']);
    });

    it('skips the seven-day notice of a date entered three days before it starts, and still announces the opening day', async () => {
      const s = await student(codeA);
      onDay('2090-07-10');
      const window = await enter('registration', '2090-07-13');
      for (const day of ['2090-07-10', '2090-07-11', '2090-07-12']) {
        onDay(day);
        expect(await inbox(s)).toEqual([]);
      }
      onDay('2090-07-13');
      expect((await inbox(s)).map((n) => [n.kind, n.event?.id])).toEqual([['registration_open', window]]);
      onDay('2090-07-14');
      expect(await seen(s, window)).toEqual(['registration_open']);
    });

    it('shows a date entered for today at once, and the seven-day notice of a date entered exactly seven days ahead at once', async () => {
      const s = await student(codeA);
      onDay('2090-08-03');
      expect(await inbox(s)).toEqual([]);
      const today = await enter('registration', '2090-08-03');
      const term = await enter('term_start', '2090-08-03');
      const nextWeek = await enter('registration', '2090-08-10');
      const got = await inbox(s);
      expect(got.map((n) => [n.kind, n.event?.id]).sort()).toEqual(
        [
          ['registration_open', today],
          ['registration_soon', nextWeek],
          ['term_start', term],
        ].sort(),
      );
      expect((await as(s.token).get('/api/notifications/unread-count').expect(200)).body).toEqual({ unread: 3 });
    });

    it('creates the notifications of a date entered today on the first unread-count read too', async () => {
      const s = await student(codeA);
      onDay('2090-08-20');
      const term = await enter('term_start', '2090-08-20');
      expect((await as(s.token).get('/api/notifications/unread-count').expect(200)).body).toEqual({ unread: 1 });
      expect(await stored(s, term)).toEqual(['term_start']);
    });

    it('does not catch up on a day that passed with no run', async () => {
      const s = await student(codeA);
      onDay('2090-09-01');
      const window = await enter('registration', '2090-09-20');
      onDay('2090-09-12');
      await notifications.createDue();
      onDay('2090-09-14');
      await notifications.createDue();
      expect(await total(window)).toBe(0);
      expect(await seen(s, window)).toEqual([]);
      onDay('2090-09-20');
      expect(await seen(s, window)).toEqual(['registration_open']);
    });

    it('sends nothing again when a date moves after its notification went out', async () => {
      const s = await student(codeA);
      onDay('2090-10-01');
      const window = await enter('registration', '2090-10-20', { endsOn: '2090-10-31' });
      onDay('2090-10-13');
      await notifications.createDue();
      expect(await stored(s, window)).toEqual(['registration_soon']);
      const afterSoon = await total(window);

      await as(adminA.token).patch(`${events(programA)}/${window}`, { startsOn: '2090-10-25', title: 'Synthetic registration, moved' }).expect(200);
      onDay('2090-10-18');
      await notifications.createDue();
      expect(await total(window)).toBe(afterSoon);
      expect(await seen(s, window)).toEqual(['registration_soon']);
      onDay('2090-10-20');
      expect(await seen(s, window)).toEqual(['registration_soon']);
      onDay('2090-10-25');
      await notifications.createDue();
      expect(await stored(s, window)).toEqual(['registration_open', 'registration_soon']);
      const afterOpen = await total(window);
      expect(afterOpen).toBe(2 * afterSoon);

      await as(adminA.token).patch(`${events(programA)}/${window}`, { startsOn: '2090-10-31' }).expect(200);
      for (const day of ['2090-10-24', '2090-10-31']) {
        onDay(day);
        await notifications.createDue();
        expect(await total(window)).toBe(afterOpen);
        expect(await seen(s, window)).toEqual(['registration_open', 'registration_soon']);
      }

      const list = (await inbox(s)).filter((n) => n.event?.id === window);
      expect(list.map((n) => [n.kind, n.event?.startsOn, n.event?.title])).toEqual([
        ['registration_open', '2090-10-25', 'Synthetic registration, moved'],
        ['registration_soon', '2090-10-20', 'Synthetic registration 2090-10-20'],
      ]);
    });

    it('sends the seven-day notice of a date postponed by a week after its opening-day notice went out, and no second opening-day notice', async () => {
      const s = await student(codeA);
      onDay('2091-05-04');
      const window = await enter('registration', '2091-05-04', { endsOn: '2091-05-20' });
      await notifications.createDue();
      expect(await stored(s, window)).toEqual(['registration_open']);

      await as(adminA.token).patch(`${events(programA)}/${window}`, { startsOn: '2091-05-11' }).expect(200);
      await notifications.createDue();
      expect(await stored(s, window)).toEqual(['registration_open', 'registration_soon']);
      const afterBoth = await total(window);
      const held = (await inbox(s)).filter((n) => n.event?.id === window).map((n) => [n.kind, n.event?.startsOn]);
      expect(held.sort()).toEqual([
        ['registration_open', '2091-05-04'],
        ['registration_soon', '2091-05-11'],
      ]);

      onDay('2091-05-11');
      await notifications.createDue();
      expect(await total(window)).toBe(afterBoth);
      expect(await seen(s, window)).toHaveLength(2);

      await as(adminA.token).delete(`${events(programA)}/${window}`).expect(204);
      const again = await enter('registration', '2091-05-11', { endsOn: '2091-05-20' });
      expect(await seen(s, again)).toEqual(['registration_open']);
      expect(await stored(s, window)).toEqual(['registration_open', 'registration_soon']);
    });

    it('sends the opening-day notice too when a term start that was announced today is changed to a registration window', async () => {
      const s = await student(codeA);
      onDay('2091-05-25');
      const date = await enter('term_start', '2091-05-25');
      await notifications.createDue();
      expect(await stored(s, date)).toEqual(['term_start']);

      await as(adminA.token).patch(`${events(programA)}/${date}`, { kind: 'registration' }).expect(200);
      await notifications.createDue();
      expect(await stored(s, date)).toEqual(['registration_open', 'term_start']);
      await notifications.createDue();
      const held = (await inbox(s)).filter((n) => n.event?.id === date);
      expect(held.map((n) => n.kind).sort()).toEqual(['registration_open', 'term_start']);
      expect(new Set(held.map((n) => n.event?.startsOn))).toEqual(new Set(['2091-05-25']));
    });

    it('makes one notification when several runs and reads happen at once', async () => {
      const [s, t] = [await student(codeA), await student(codeA)];
      onDay('2090-11-01');
      const term = await enter('term_start', '2090-11-10');
      onDay('2090-11-10');
      await Promise.all([
        notifications.createDue(),
        notifications.createDue(),
        notifications.createDue(s.userId),
        inbox(s),
        inbox(t),
        as(s.token).get('/api/notifications/unread-count'),
        app.get(NotificationSchedule).tick(),
      ]);
      expect(await stored(s, term)).toEqual(['term_start']);
      expect(await stored(t, term)).toEqual(['term_start']);
    });

    it('holds the no-repeat rule in the database: the key is the student, the date and the kind, never the day', async () => {
      const s = await student(codeA);
      onDay('2090-11-12');
      const term = await enter('term_start', '2090-11-12');
      expect(await seen(s, term)).toEqual(['term_start']);
      const insert = (kind: string, eventId: string | null, startsOn: string | null) =>
        db.query(
          `INSERT INTO notifications (user_id, kind, calendar_event_id, program_code, academic_year, starts_on, ends_on, title)
           VALUES ($1, $2, $3, $4, $5, $6, $6, $7)`,
          [s.userId, kind, eventId, eventId && codeA, eventId && 2090, startsOn, eventId && 'Synthetic'],
        );
      await expect(insert('term_start', term, '2090-11-30')).rejects.toThrow(/uq_notifications_user_event_kind/);
      await expect(insert('term_start', null, null)).rejects.toThrow(/ck_notifications_event/);
      await expect(insert('transcript_changed', term, '2090-11-12')).rejects.toThrow(/ck_notifications_event/);
      await expect(insert('add_drop', term, '2090-11-12')).rejects.toThrow(/ck_notifications_kind/);
      await expect(db.query(`INSERT INTO notifications (user_id, kind, calendar_event_id) VALUES ($1, 'term_start', $2)`, [s.userId, randomUUID()])).rejects.toThrow(/ck_notifications_snapshot/);
    });

    it('makes nothing for add/drop windows and the other kinds of school date', async () => {
      const s = await student(codeA);
      onDay('2090-11-20');
      const ids: string[] = [];
      for (const kind of ['add_drop', 'term_end', 'exam_period', 'holiday', 'other']) {
        ids.push(await enter(kind, '2090-11-20'), await enter(kind, '2090-11-27'));
      }
      expect(await inbox(s)).toEqual([]);
      await notifications.createDue();
      for (const id of ids) expect(await total(id)).toBe(0);
    });
  });

  describe('recipients', () => {
    it("gives each student the notifications of their own program, never another program's", async () => {
      const [a1, a2, b, nobody] = [await student(codeA), await student(codeA), await student(codeB), await student()];
      onDay('2090-12-01');
      const termA = await enter('term_start', '2090-12-05');
      const termB = await enter('term_start', '2090-12-05', { title: 'Synthetic term start of program B' }, adminB, programB);
      onDay('2090-12-05');
      await notifications.createDue();
      for (const a of [a1, a2]) {
        expect(await stored(a, termA)).toEqual(['term_start']);
        expect(await stored(a, termB)).toEqual([]);
        expect((await inbox(a)).map((n) => n.event?.id)).toEqual([termA]);
      }
      expect(await stored(b, termB)).toEqual(['term_start']);
      expect(await stored(b, termA)).toEqual([]);
      const [seenByB] = await inbox(b);
      expect(seenByB?.event).toMatchObject({ id: termB, programCode: codeB, title: 'Synthetic term start of program B' });
      expect(await inbox(nobody)).toEqual([]);
      expect((await as(nobody.token).get('/api/notifications/unread-count').expect(200)).body).toEqual({ unread: 0 });
      const holders = ((await db.query('SELECT user_id FROM notifications WHERE calendar_event_id = $1 AND user_id = ANY($2)', [termA, userIds])) as { user_id: string }[]).map((r) => r.user_id);
      expect(holders).not.toContain(b.userId);
      expect(holders).not.toContain(nobody.userId);
      expect(holders).not.toContain(adminA.userId);
    });

    it('creates on a read only the notifications of the student who reads', async () => {
      const [reader, other] = [await student(codeA), await student(codeA)];
      onDay('2091-06-01');
      const term = await enter('term_start', '2091-06-01');
      expect((await inbox(reader)).map((n) => n.event?.id)).toEqual([term]);
      expect((await as(reader.token).get('/api/notifications/unread-count').expect(200)).body).toEqual({ unread: 1 });
      expect(await total(term)).toBe(1);
      expect(await stored(other, term)).toEqual([]);

      expect((await as(other.token).get('/api/notifications/unread-count').expect(200)).body).toEqual({ unread: 1 });
      expect(await total(term)).toBe(2);
      await notifications.createDue();
      expect(await total(term)).toBeGreaterThan(2);
    });

    it('counts a program as soon as it is saved, before onboarding is finished', async () => {
      const unfinished = await student(codeA, false);
      onDay('2090-12-07');
      const term = await enter('term_start', '2090-12-07');
      await notifications.createDue();
      expect(await stored(unfinished, term)).toEqual(['term_start']);
    });

    it('gives a student who joins the program only the notifications made from then on', async () => {
      const [early, sameDay, late] = [await student(codeA), await student(), await student()];
      onDay('2090-12-08');
      const window = await enter('registration', '2090-12-15');
      await notifications.createDue();
      expect(await stored(early, window)).toEqual(['registration_soon']);

      onDay('2090-12-08', '21:00:00');
      await join(sameDay, codeA);
      expect(await seen(sameDay, window)).toEqual(['registration_soon']);

      onDay('2090-12-09');
      await join(late, codeA);
      expect(await seen(late, window)).toEqual([]);
      onDay('2090-12-15');
      await notifications.createDue();
      expect(await stored(late, window)).toEqual(['registration_open']);
      expect(await stored(early, window)).toEqual(['registration_open', 'registration_soon']);
    });

    it('follows the student to a new program without sending the old one again', async () => {
      const mover = await student(codeA);
      onDay('2090-12-16');
      const termA = await enter('term_start', '2090-12-16');
      const termB = await enter('term_start', '2090-12-17', {}, adminB, programB);
      expect(await seen(mover, termA)).toEqual(['term_start']);
      await join(mover, codeB);
      onDay('2090-12-17');
      expect(await seen(mover, termB)).toEqual(['term_start']);
      expect(await seen(mover, termA)).toEqual(['term_start']);
    });

    it('makes nothing for an account waiting for deletion, and resumes when the deletion is cancelled', async () => {
      const [leaving, staying] = [await student(codeA), await student(codeA)];
      onDay('2090-12-18');
      const window = await enter('registration', '2090-12-25');
      await db.query(`UPDATE users SET deletion_requested_at = now(), purge_after = now() + interval '30 days' WHERE id = $1`, [leaving.userId]);
      await notifications.createDue();
      await notifications.createDue(leaving.userId);
      expect(await stored(staying, window)).toEqual(['registration_soon']);
      expect(await stored(leaving, window)).toEqual([]);

      onDay('2090-12-19');
      await db.query('UPDATE users SET deletion_requested_at = NULL, purge_after = NULL WHERE id = $1', [leaving.userId]);
      await notifications.createDue();
      expect(await stored(leaving, window)).toEqual([]);
      onDay('2090-12-25');
      await notifications.createDue();
      expect(await stored(leaving, window)).toEqual(['registration_open']);
    });
  });

  describe('when creating fails', () => {
    let errors: string[];

    beforeEach(() => {
      errors = [];
      vi.spyOn(Logger.prototype, 'error').mockImplementation((...args: unknown[]) => void errors.push(args.map(String).join(' ')));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('goes on with the other school dates when the statement of one date fails, and tries that date again the same day', async () => {
      const [a, b] = [await student(codeA), await student(codeB)];
      onDay('2091-07-01');
      const bad = await enter('term_start', '2091-07-01', { title: 'Synthetic date whose statement fails' });
      const good = await enter('registration', '2091-07-01');
      const goodB = await enter('term_start', '2091-07-01', {}, adminB, programB);
      await db.query(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS ${FAIL_ONE_DATE}`);
      await db.query(`ALTER TABLE notifications ADD CONSTRAINT ${FAIL_ONE_DATE} CHECK (calendar_event_id IS DISTINCT FROM '${bad}'::uuid)`);
      try {
        await notifications.createDue();
        expect(await stored(a, good)).toEqual(['registration_open']);
        expect(await stored(b, goodB)).toEqual(['term_start']);
        expect(await total(bad)).toBe(0);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatch(/^Could not create the notifications of 1 of \d+ school date\(s\) that are due: QueryFailedError, SQLSTATE 23514$/);

        const reader = await student(codeA);
        errors.length = 0;
        expect((await inbox(reader)).map((n) => [n.kind, n.event?.id])).toEqual([['registration_open', good]]);
        expect((await as(reader.token).get('/api/notifications/unread-count').expect(200)).body).toEqual({ unread: 1 });
        expect(errors).toHaveLength(1);
        for (const line of errors) expect(line).toMatch(/^Could not create the notifications of 1 of \d+ school date\(s\) that are due: QueryFailedError, SQLSTATE 23514$/);
        for (const value of [a.userId, reader.userId, bad, 'Synthetic', codeA, 'INSERT', FAIL_ONE_DATE]) expect(errors.join('\n')).not.toContain(value);
      } finally {
        await db.query(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS ${FAIL_ONE_DATE}`);
      }
      errors.length = 0;
      await notifications.createDue();
      expect(await stored(a, bad)).toEqual(['term_start']);
      expect(errors).toEqual([]);
    });

    it('serves the stored notifications when the due dates cannot be read at all, and logs no statement and no parameter', async () => {
      const s = await student(codeA);
      onDay('2091-07-10');
      await enter('term_start', '2091-07-10');
      const before = await inbox(s);
      expect(before).toHaveLength(1);

      const failure = new QueryFailedError(
        `SELECT "e"."title" FROM "academic_calendar" "e" WHERE "e"."starts_on" IN ($1, $2) /* ${s.userId} */`,
        ['2091-07-10', s.userId, 'Synthetic title in a parameter'],
        Object.assign(new Error(`canceling statement due to statement timeout (${s.userId})`), { code: '57014' }),
      );
      const startingOn = vi.spyOn(app.get(AcademicCalendarService), 'startingOn').mockRejectedValue(failure);

      expect((await as(s.token).get('/api/notifications').expect(200)).body).toEqual({ notifications: before, nextBefore: null });
      expect((await as(s.token).get('/api/notifications/unread-count').expect(200)).body).toEqual({ unread: 1 });
      expect(startingOn).toHaveBeenCalledTimes(2);
      const line = 'Could not create the notifications that are due before a read: QueryFailedError, SQLSTATE 57014';
      expect(errors.map((l) => l.replace(/ \(\d+ more failed read\(s\) since the last line were not logged\)$/, ''))).toEqual([line]);

      await app.get(NotificationSchedule).tick();
      expect(errors[1]).toBe('Could not create the notifications that are due: QueryFailedError, SQLSTATE 57014');
      for (const value of [s.userId, 'Synthetic', 'SELECT', 'statement timeout', '2091-07-10']) expect(errors.join('\n')).not.toContain(value);

      expect((await as(s.token).post(`/api/notifications/${before[0]!.id}/read`).expect(200)).body.readAt).not.toBeNull();
      expect(errors).toHaveLength(2);
    });
  });

  describe('a deleted school date', () => {
    it('keeps the notification already sent, and a date entered again is a new date with its own notifications', async () => {
      const s = await student(codeA);
      onDay('2091-01-05');
      const body = { endsOn: '2091-01-12', title: 'Synthetic registration, deleted later' };
      const first = await enter('registration', '2091-01-05', body);
      expect(await seen(s, first)).toEqual(['registration_open']);

      await as(adminA.token).delete(`${events(programA)}/${first}`).expect(204);
      expect((await as(s.token).get('/api/academic-calendar?from=2091-01-05&to=2091-01-05').expect(200)).body.events).toEqual([]);
      const kept = (await inbox(s)).filter((n) => n.event?.id === first);
      expect(kept).toHaveLength(1);
      expect(kept[0]).toMatchObject({ kind: 'registration_open', event: { id: first, programCode: codeA, startsOn: '2091-01-05', endsOn: '2091-01-12', title: body.title } });
      expect((await as(s.token).post(`/api/notifications/${kept[0]!.id}/read`).expect(200)).body.readAt).not.toBeNull();

      const second = await enter('registration', '2091-01-05', body);
      expect(second).not.toBe(first);
      expect(await seen(s, second)).toEqual(['registration_open']);
      expect(await seen(s, first)).toEqual(['registration_open']);
    });
  });

  describe('the inbox routes', () => {
    let owner: Account;
    let other: Account;
    let list: Notice[];
    let othersNotice: Notice;

    beforeAll(async () => {
      [owner, other] = [await student(codeA), await student(codeB)];
      onDay('2091-02-01');
      await enter('registration', '2091-02-08');
      await enter('term_start', '2091-02-01');
      await enter('registration', '2091-02-01');
      await enter('term_start', '2091-02-01', {}, adminB, programB);
      list = await inbox(owner);
      onDay('2091-02-01', '15:00:00');
      await save(owner, rows).expect(200);
      await save(owner, [rows[0]!]).expect(200);
      list = await inbox(owner);
      [othersNotice] = await inbox(other);
    });

    it('lists newest first, and breaks a tie the same way on every read', async () => {
      expect(list.map((n) => n.kind)[0]).toBe('transcript_changed');
      expect(list.map((n) => n.kind).slice(1).sort()).toEqual(['registration_open', 'registration_soon', 'term_start']);
      const expected = [...list].sort((x, y) => (x.createdAt === y.createdAt ? (x.id < y.id ? 1 : -1) : x.createdAt < y.createdAt ? 1 : -1));
      expect(list.map((n) => n.id)).toEqual(expected.map((n) => n.id));
      expect(new Set(list.slice(1).map((n) => n.createdAt)).size).toBe(1);
      for (let i = 0; i < 3; i++) expect((await inbox(owner)).map((n) => n.id)).toEqual(list.map((n) => n.id));
    });

    it('returns only keys the screen words itself: no sentence, no URL, no user ID', () => {
      for (const n of list) {
        expect(Object.keys(n).sort()).toEqual(['createdAt', 'event', 'id', 'kind', 'links', 'readAt']);
        for (const link of n.links) expect(['calendar', 'planner', 'audit']).toContain(link);
      }
      expect(JSON.stringify(list)).not.toMatch(/https?:|user_?id|example\.com/i);
    });

    it('pages with limit and before, without skipping or repeating', async () => {
      const first = (await as(owner.token).get('/api/notifications?limit=3').expect(200)).body;
      expect(first.notifications.map((n: Notice) => n.id)).toEqual(list.slice(0, 3).map((n) => n.id));
      expect(first.nextBefore).toBe(list[2]!.id);
      const second = (await as(owner.token).get(`/api/notifications?limit=3&before=${first.nextBefore}`).expect(200)).body;
      expect(second.notifications.map((n: Notice) => n.id)).toEqual(list.slice(3).map((n) => n.id));
      expect(second.nextBefore).toBeNull();
      const exact = (await as(owner.token).get(`/api/notifications?limit=${list.length}`).expect(200)).body;
      expect(exact.nextBefore).toBeNull();
      expect((await as(owner.token).get(`/api/notifications?before=${list.at(-1)!.id}`).expect(200)).body).toEqual({ notifications: [], nextBefore: null });
    });

    it('filters by kind, one or several', async () => {
      expect((await inbox(owner, '?kind=term_start')).map((n) => n.kind)).toEqual(['term_start']);
      expect((await inbox(owner, '?kind=registration_soon&kind=registration_open')).map((n) => n.kind).sort()).toEqual(['registration_open', 'registration_soon']);
      expect((await inbox(owner, '?kind=transcript_changed')).map((n) => n.kind)).toEqual(['transcript_changed']);
    });

    it('refuses malformed query values with 400', async () => {
      for (const query of ['?unread=yes', '?unread=1', '?kind=party', '?kind=term_start&kind=party', '?kind=term_start&kind=term_start', '?limit=0', '?limit=101', '?limit=ten', '?limit=1.5', '?limit=1e2', '?limit=0x10', '?limit=%2B5', '?limit=%205', '?limit=5&limit=6', '?before=42']) {
        const res = await as(owner.token).get(`/api/notifications${query}`);
        expect(res.status, query).toBe(400);
      }
    });

    it("answers 404, never 403, for another student's notification, an unknown ID and a malformed ID, and changes nothing", async () => {
      for (const id of [othersNotice.id, randomUUID(), '42', 'not-a-uuid', "1' OR '1'='1"]) {
        const res = await as(owner.token).post(`/api/notifications/${encodeURIComponent(id)}/read`);
        expect([res.status, res.body.code], id).toEqual([404, 'not_found']);
      }
      expect((await as(owner.token).get(`/api/notifications?before=${othersNotice.id}`).expect(404)).body.code).toBe('not_found');
      expect((await as(owner.token).get(`/api/notifications?before=${randomUUID()}`).expect(404)).body.code).toBe('not_found');
      const [still] = await inbox(other);
      expect(still).toEqual(othersNotice);
      expect(still!.readAt).toBeNull();
    });

    it('marks one notification read, once, and counts the unread ones for the bell', async () => {
      const count = async () => (await as(owner.token).get('/api/notifications/unread-count').expect(200)).body.unread;
      expect(await count()).toBe(list.length);
      const target = list[1]!;
      onDay('2091-02-01', '16:00:00');
      const read = (await as(owner.token).post(`/api/notifications/${target.id}/read`).expect(200)).body as Notice;
      expect(read).toEqual({ ...target, readAt: '2091-02-01T09:00:00.000Z' });
      expect(await count()).toBe(list.length - 1);

      onDay('2091-02-01', '18:00:00');
      expect((await as(owner.token).post(`/api/notifications/${target.id.toUpperCase()}/read`).expect(200)).body).toEqual(read);
      expect(await count()).toBe(list.length - 1);

      expect((await inbox(owner, '?unread=true')).map((n) => n.id)).toEqual(list.filter((n) => n.id !== target.id).map((n) => n.id));
      expect((await inbox(owner, '?unread=false')).map((n) => n.id)).toEqual([target.id]);
      expect((await inbox(owner, '?unread=true&kind=transcript_changed')).length).toBe(target.kind === 'transcript_changed' ? 0 : 1);
    });

    it("marks every notification read (UC-12 A3), again without effect, and leaves other students' alone", async () => {
      const before = await inbox(owner);
      onDay('2091-02-01', '20:00:00');
      expect((await as(owner.token).post('/api/notifications/read-all').expect(200)).body).toEqual({ unread: 0 });
      const after = await inbox(owner);
      expect(after.map((n) => n.id)).toEqual(before.map((n) => n.id));
      for (const n of after) expect(n.readAt).toBe(before.find((b) => b.id === n.id)!.readAt ?? '2091-02-01T13:00:00.000Z');
      onDay('2091-02-01', '22:00:00');
      expect((await as(owner.token).post('/api/notifications/read-all').expect(200)).body).toEqual({ unread: 0 });
      expect(await inbox(owner)).toEqual(after);
      expect(await inbox(owner, '?unread=true')).toEqual([]);
      expect((await inbox(other))[0]!.readAt).toBeNull();
    });
  });

  describe('a changed transcript', () => {
    let s: Account;
    let bystander: Account;

    beforeAll(async () => {
      [s, bystander] = [await student(codeA), await student(codeA)];
      onDay('2091-03-01');
    });

    it('makes nothing for the first import', async () => {
      await save(s, rows).expect(200);
      expect(await transcriptNotices(s)).toBe(0);
    });

    it('makes nothing for a save with the same rows, in the same or another order', async () => {
      await save(s, rows).expect(200);
      await save(s, [...rows].reverse()).expect(200);
      await save(s, [rows[1]!, rows[2]!, rows[0]!]).expect(200);
      expect(await transcriptNotices(s)).toBe(0);
    });

    it('makes one for each save that differs: a grade, a retake row added, a retake row removed', async () => {
      await save(s, [{ ...rows[0]!, grade: 5 }, rows[1]!, rows[2]!]).expect(200);
      expect(await transcriptNotices(s)).toBe(1);
      await save(s, [{ ...rows[0]!, grade: 5 }, rows[1]!, rows[1]!, rows[2]!]).expect(200);
      expect(await transcriptNotices(s)).toBe(2);
      await save(s, [{ ...rows[0]!, grade: 5 }, rows[1]!, rows[2]!]).expect(200);
      expect(await transcriptNotices(s)).toBe(3);
      await save(s, [rows[1]!, { ...rows[0]!, grade: 5 }, rows[2]!]).expect(200);
      expect(await transcriptNotices(s)).toBe(3);
    });

    it('says only that the transcript changed: no grade, no course, no audit result', async () => {
      const [notice] = await inbox(s, '?kind=transcript_changed&limit=1');
      expect(notice).toEqual({ id: expect.any(String), kind: 'transcript_changed', createdAt: '2091-03-01T05:00:00.000Z', readAt: null, event: null, links: ['audit'] });
      const [row] = await db.query('SELECT * FROM notifications WHERE id = $1', [notice!.id]);
      expect(Object.entries(row as object).filter(([, v]) => v !== null).map(([k]) => k).sort()).toEqual(['created_at', 'id', 'kind', 'user_id']);
      expect(JSON.stringify(await inbox(s))).not.toMatch(/ZZ101|Synthetic One|grade/);
    });

    it('makes nothing when a save is refused, or fails and rolls back', async () => {
      const before = await transcriptNotices(s);
      await save(s, [{ ...rows[0]!, grade: 11 }]).expect(400);
      await save(s, [{ ...rows[2]!, grade: 7 }]).expect(400);
      await expect(app.get(TranscriptService).replace(s.userId, [{ ...rows[0]!, credits: 99 }])).rejects.toThrow(/ck_transcript_rows_credits/);
      let sawNotice = -1;
      const remove = app.get(TranscriptService).onSaved(async (tx) => {
        sawNotice = (await tx.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND kind = 'transcript_changed'`, [s.userId]))[0].n;
        throw new Error('synthetic failure after the notification');
      });
      try {
        await save(s, [rows[2]!]).expect(500);
      } finally {
        remove();
      }
      expect(sawNotice).toBe(before + 1);
      expect(await transcriptNotices(s)).toBe(before);
      expect((await as(s.token).get('/api/users/me/transcript').expect(200)).body.rows).toHaveLength(3);
    });

    it('makes one when a saved transcript is emptied, and none when rows are saved over the empty one', async () => {
      const before = await transcriptNotices(s);
      await save(s, []).expect(200);
      expect(await transcriptNotices(s)).toBe(before + 1);
      await save(s, []).expect(200);
      expect(await transcriptNotices(s)).toBe(before + 1);
      await save(s, rows).expect(200);
      expect(await transcriptNotices(s)).toBe(before + 1);
      await save(s, [rows[0]!]).expect(200);
      expect(await transcriptNotices(s)).toBe(before + 2);
    });

    it('tells only the student who saved', async () => {
      expect(await transcriptNotices(bystander)).toBe(0);
      expect(await inbox(bystander, '?kind=transcript_changed')).toEqual([]);
    });

    it('makes one notification per save when two saves run at once', async () => {
      const t = await student();
      await save(t, rows).expect(200);
      const transcript = app.get(TranscriptService);
      await Promise.all([transcript.replace(t.userId, [rows[0]!]), transcript.replace(t.userId, [rows[0]!])]);
      expect(await transcriptNotices(t)).toBe(1);
    });
  });

  describe('account export and deletion (ADR 0004)', () => {
    it("exports the student's notifications, and removes them with the account", async () => {
      const [s, neighbour] = [await student(codeA), await student(codeA)];
      onDay('2091-04-01');
      const term = await enter('term_start', '2091-04-01');
      await save(s, rows).expect(200);
      await save(s, [rows[0]!]).expect(200);
      expect((await inbox(s)).map((n) => n.kind).sort()).toEqual(['term_start', 'transcript_changed']);
      expect(await seen(neighbour, term)).toEqual(['term_start']);

      const exported = (await as(s.token).get('/api/users/me/export').expect(200)).body.tables.notifications as Record<string, unknown>[];
      expect(exported.map((r) => r.kind).sort()).toEqual(['term_start', 'transcript_changed']);
      for (const row of exported) expect(row.user_id).toBe(s.userId);
      expect(exported.find((r) => r.kind === 'term_start')).toMatchObject({ calendar_event_id: term, program_code: codeA, title: 'Synthetic term_start 2091-04-01' });

      await db.query('DELETE FROM users WHERE id = $1', [s.userId]);
      expect(await db.query('SELECT 1 FROM notifications WHERE user_id = $1', [s.userId])).toEqual([]);
      expect(await stored(neighbour, term)).toEqual(['term_start']);
    });
  });
});
