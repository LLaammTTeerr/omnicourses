import { Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEventStart } from '../academic-calendar/academic-calendar.service.js';
import type { TranscriptSaveListener } from '../transcript/transcript-change.js';
import { Notification } from './notification.entity.js';
import { notificationDto, NotificationsService, READ_FAILURE_LOG_INTERVAL_MS } from './notifications.service.js';

const event = (over: Partial<CalendarEventStart>): CalendarEventStart => ({
  id: 'e1',
  programCode: 'ZZA',
  academicYear: 2090,
  term: 1,
  kind: 'registration',
  startsOn: '2090-03-20',
  endsOn: '2090-03-31',
  title: 'Synthetic registration',
  titleEn: null,
  ...over,
});

describe('NotificationsService', () => {
  const clock = { at: new Date('2090-03-13T05:00:00Z'), now: () => new Date(clock.at) };
  let db: { query: ReturnType<typeof vi.fn> };
  let calendar: { startingOn: ReturnType<typeof vi.fn> };
  let onboarding: { userIdsByProgram: ReturnType<typeof vi.fn> };
  let transcript: { onSaved: ReturnType<typeof vi.fn> };
  let stored: { countBy: ReturnType<typeof vi.fn>; createQueryBuilder: ReturnType<typeof vi.fn> };
  let service: NotificationsService;
  let errors: string[];
  const refused = (code: string) => new QueryFailedError('INSERT INTO "notifications" …', ['synthetic-user-id', 'Synthetic title'], Object.assign(new Error('Key (user_id)=(synthetic-user-id)'), { code }));

  beforeEach(() => {
    db = { query: vi.fn(async (_sql: string, params: unknown[]) => (params[0] as string[]).map((id) => ({ id }))) };
    calendar = { startingOn: vi.fn(async () => []) };
    onboarding = { userIdsByProgram: vi.fn(async () => new Map<string, string[]>()) };
    transcript = { onSaved: vi.fn() };
    const builder: Record<string, unknown> = { getMany: vi.fn(async () => []) };
    for (const method of ['where', 'andWhere', 'orderBy', 'addOrderBy', 'take']) builder[method] = vi.fn(() => builder);
    stored = { countBy: vi.fn(async () => 3), createQueryBuilder: vi.fn(() => builder) };
    service = new NotificationsService(db as never, stored as never, clock as never, calendar as never, onboarding as never, transcript as never);
    errors = [];
    vi.spyOn(Logger.prototype, 'error').mockImplementation((...args: unknown[]) => void errors.push(args.map(String).join(' ')));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createDue', () => {
    it('asks for the dates that start on the Vietnam day and seven days later, changing day at 17:00:00 UTC', async () => {
      clock.at = new Date('2090-03-12T16:59:59.999Z');
      await service.createDue();
      expect(calendar.startingOn).toHaveBeenLastCalledWith(['2090-03-12', '2090-03-19'], ['registration', 'term_start']);
      clock.at = new Date('2090-03-12T17:00:00.000Z');
      await service.createDue();
      expect(calendar.startingOn).toHaveBeenLastCalledWith(['2090-03-13', '2090-03-20'], ['registration', 'term_start']);
    });

    it('reads no student and writes nothing on a day with nothing due', async () => {
      clock.at = new Date('2090-03-13T05:00:00Z');
      calendar.startingOn.mockResolvedValue([event({ id: 'e9', kind: 'term_start' })]);
      expect(await service.createDue()).toBe(0);
      expect(onboarding.userIdsByProgram).not.toHaveBeenCalled();
      expect(db.query).not.toHaveBeenCalled();
    });

    it('writes one statement per date and kind, for all the students of its program at once', async () => {
      clock.at = new Date('2090-03-13T05:00:00Z');
      calendar.startingOn.mockResolvedValue([
        event({ id: 'soon', startsOn: '2090-03-20' }),
        event({ id: 'open', startsOn: '2090-03-13', programCode: 'ZZB' }),
        event({ id: 'term', kind: 'term_start', startsOn: '2090-03-13' }),
        event({ id: 'empty', kind: 'term_start', startsOn: '2090-03-13', programCode: 'ZZC' }),
      ]);
      onboarding.userIdsByProgram.mockResolvedValue(
        new Map([
          ['ZZA', ['u1', 'u2']],
          ['ZZB', ['u3']],
        ]),
      );
      expect(await service.createDue()).toBe(5);
      expect(onboarding.userIdsByProgram).toHaveBeenCalledTimes(1);
      expect(onboarding.userIdsByProgram).toHaveBeenCalledWith(['ZZA', 'ZZB', 'ZZC'], undefined);
      expect(db.query.mock.calls.map(([, p]) => [p[0], p[1], p[2]])).toEqual([
        [['u1', 'u2'], 'registration_soon', 'soon'],
        [['u3'], 'registration_open', 'open'],
        [['u1', 'u2'], 'term_start', 'term'],
      ]);
      const [sql, params] = db.query.mock.calls[0]!;
      expect(sql).toContain('ON CONFLICT ("user_id", "calendar_event_id", "kind") DO NOTHING');
      expect(sql).toContain('u."deletion_requested_at" IS NULL');
      expect(params.slice(3)).toEqual(['ZZA', 2090, 1, '2090-03-20', '2090-03-31', 'Synthetic registration', null, clock.at]);
    });

    it('narrows the same run to one student for a read', async () => {
      clock.at = new Date('2090-03-13T05:00:00Z');
      calendar.startingOn.mockResolvedValue([event({ startsOn: '2090-03-13' })]);
      onboarding.userIdsByProgram.mockResolvedValue(new Map([['ZZA', ['u1']]]));
      expect(await service.createDue('u1')).toBe(1);
      expect(onboarding.userIdsByProgram).toHaveBeenCalledWith(['ZZA'], 'u1');
      expect(db.query.mock.calls[0]![1][0]).toEqual(['u1']);
    });
  });

  describe('when creating fails', () => {
    const today = { kind: 'term_start', startsOn: '2090-03-13' } as const;

    beforeEach(() => {
      clock.at = new Date('2090-03-13T05:00:00Z');
      calendar.startingOn.mockResolvedValue([event({ id: 'first', ...today }), event({ id: 'bad', ...today, programCode: 'ZZB' }), event({ id: 'last', ...today }), event({ id: 'worse', ...today, programCode: 'ZZB' })]);
      onboarding.userIdsByProgram.mockResolvedValue(
        new Map([
          ['ZZA', ['u1', 'u2']],
          ['ZZB', ['u3']],
        ]),
      );
    });

    it('goes on with the other dates when the statement of one fails, and logs one line of counts and kinds', async () => {
      db.query.mockImplementation(async (_sql: string, params: unknown[]) => {
        if (params[2] === 'bad') throw refused('23503');
        if (params[2] === 'worse') throw refused('23514');
        return (params[0] as string[]).map((id) => ({ id }));
      });
      expect(await service.createDue()).toBe(4);
      expect(db.query.mock.calls.map(([, p]) => p[2])).toEqual(['first', 'bad', 'last', 'worse']);
      expect(errors).toEqual(['Could not create the notifications of 2 of 4 school date(s) that are due: QueryFailedError, SQLSTATE 23503; QueryFailedError, SQLSTATE 23514']);
    });

    it('logs nothing when every statement succeeds', async () => {
      expect(await service.createDue()).toBe(6);
      expect(errors).toEqual([]);
    });

    it('rejects when the dates or the students cannot be read: there is nothing to go on with', async () => {
      calendar.startingOn.mockRejectedValueOnce(refused('57014'));
      await expect(service.createDue()).rejects.toBeInstanceOf(QueryFailedError);
      onboarding.userIdsByProgram.mockRejectedValueOnce(refused('57014'));
      await expect(service.createDue()).rejects.toBeInstanceOf(QueryFailedError);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('still answers a read from what is stored, and logs the kind of failure only', async () => {
      calendar.startingOn.mockRejectedValue(refused('57014'));
      expect(await service.unreadCount('u1')).toEqual({ unread: 3 });
      expect(await service.list('u1', {})).toEqual({ notifications: [], nextBefore: null });
      const line = 'Could not create the notifications that are due before a read: QueryFailedError, SQLSTATE 57014';
      expect(errors).toEqual([line]);
      expect(errors.join()).not.toMatch(/synthetic-user-id|Synthetic title|INSERT/);
    });

    it('logs the first failed read, then at most one line a minute while reads go on failing', async () => {
      calendar.startingOn.mockRejectedValue(refused('57014'));
      const line = 'Could not create the notifications that are due before a read: QueryFailedError, SQLSTATE 57014';
      for (let i = 0; i < 103; i++) await service.unreadCount('u1');
      expect(errors).toEqual([line]);
      clock.at = new Date(clock.at.getTime() + READ_FAILURE_LOG_INTERVAL_MS - 1);
      await service.list('u1', {});
      expect(errors).toEqual([line]);
      clock.at = new Date(clock.at.getTime() + 1);
      await service.unreadCount('u1');
      expect(errors).toEqual([line, `${line} (103 more failed read(s) since the last line were not logged)`]);
      calendar.startingOn.mockResolvedValue([event({ id: 'bad', kind: 'term_start', startsOn: '2090-03-13', programCode: 'ZZB' })]);
      db.query.mockRejectedValue(refused('23514'));
      await service.list('u1', {});
      expect(errors).toHaveLength(2);
    });

    it('logs every failed run for everyone: the limit is for reads only', async () => {
      db.query.mockRejectedValue(refused('23514'));
      await service.createDue();
      await service.createDue();
      expect(errors).toHaveLength(2);
    });

    it('logs the frames of a failure that is not a database error, and never its message', async () => {
      const lines: unknown[][] = [];
      vi.spyOn(Logger.prototype, 'error').mockImplementation((...args: unknown[]) => void lines.push(args));
      onboarding.userIdsByProgram.mockRejectedValue(new TypeError('Cannot read synthetic-user-id'));
      await service.unreadCount('u1');
      expect(lines).toHaveLength(1);
      expect(lines[0]![0]).toBe('Could not create the notifications that are due before a read: TypeError');
      expect(String(lines[0]![1])).toMatch(/^\s+at /);
      expect(lines.flat().join('\n')).not.toContain('synthetic-user-id');
    });

    it('logs no stack for a refused statement: its class and SQLSTATE only', async () => {
      const lines: unknown[][] = [];
      vi.spyOn(Logger.prototype, 'error').mockImplementation((...args: unknown[]) => void lines.push(args));
      db.query.mockRejectedValue(refused('23514'));
      await service.createDue();
      expect(lines).toEqual([['Could not create the notifications of 4 of 4 school date(s) that are due: QueryFailedError, SQLSTATE 23514']]);
    });
  });

  describe('a read', () => {
    it('creates what is due for the caller alone, never for everyone', async () => {
      const createDue = vi.spyOn(service, 'createDue').mockResolvedValue(0);
      await service.list('u1', {});
      await service.unreadCount('u1');
      expect(createDue.mock.calls).toEqual([['u1'], ['u1']]);
    });

    it('creates nothing when it only marks notifications read', async () => {
      const createDue = vi.spyOn(service, 'createDue');
      Object.assign(stored, { update: vi.fn(async () => ({ affected: 1 })) });
      expect(await service.markAllRead('u1')).toEqual({ unread: 3 });
      expect(createDue).not.toHaveBeenCalled();
    });
  });

  describe('a saved transcript', () => {
    let listener: TranscriptSaveListener;
    const tx = { insert: vi.fn() };

    beforeEach(() => {
      tx.insert.mockReset();
      service.onModuleInit();
      [[listener]] = transcript.onSaved.mock.calls as [[TranscriptSaveListener]];
    });

    it('makes no notification for a first import or a save without changes', async () => {
      await listener(tx as never, { userId: 'u1', wasEmpty: true, changed: true });
      await listener(tx as never, { userId: 'u1', wasEmpty: true, changed: false });
      await listener(tx as never, { userId: 'u1', wasEmpty: false, changed: false });
      expect(tx.insert).not.toHaveBeenCalled();
    });

    it("makes one through the save's transaction when a saved transcript changes, holding nothing of the transcript", async () => {
      clock.at = new Date('2090-03-13T05:00:00Z');
      await listener(tx as never, { userId: 'u1', wasEmpty: false, changed: true });
      expect(tx.insert).toHaveBeenCalledTimes(1);
      expect(tx.insert).toHaveBeenCalledWith(Notification, { userId: 'u1', kind: 'transcript_changed', createdAt: clock.at });
      expect(db.query).not.toHaveBeenCalled();
    });
  });
});

describe('notificationDto', () => {
  const base = { id: 'n1', userId: 'u1', createdAt: new Date('2090-03-13T05:00:00Z'), readAt: null } as Notification;

  it('returns the copy of the school date and the link keys of the kind, and never the user ID', () => {
    const dto = notificationDto({
      ...base,
      kind: 'registration_soon',
      calendarEventId: 'e1',
      programCode: 'ZZA',
      academicYear: 2090,
      term: null,
      startsOn: '2090-03-20',
      endsOn: '2090-03-31',
      title: 'Synthetic registration',
      titleEn: null,
    } as Notification);
    expect(dto).toEqual({
      id: 'n1',
      kind: 'registration_soon',
      createdAt: base.createdAt,
      readAt: null,
      event: { id: 'e1', programCode: 'ZZA', academicYear: 2090, term: null, startsOn: '2090-03-20', endsOn: '2090-03-31', title: 'Synthetic registration', titleEn: null },
      links: ['calendar', 'planner'],
    });
  });

  it('returns no school date for a transcript notification', () => {
    const dto = notificationDto({ ...base, kind: 'transcript_changed', calendarEventId: null } as Notification);
    expect(dto).toEqual({ id: 'n1', kind: 'transcript_changed', createdAt: base.createdAt, readAt: null, event: null, links: ['audit'] });
  });
});
