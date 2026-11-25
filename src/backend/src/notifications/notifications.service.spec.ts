import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEventStart } from '../academic-calendar/academic-calendar.service.js';
import type { TranscriptSaveListener } from '../transcript/transcript-change.js';
import { Notification } from './notification.entity.js';
import { notificationDto, NotificationsService } from './notifications.service.js';

// Synthetic dates and IDs only (AGENTS.md hard rule 3). The database behaviour (the uniqueness
// key, the recipients filter) is tested in test/notifications.e2e-spec.ts.
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
  let service: NotificationsService;

  beforeEach(() => {
    db = { query: vi.fn(async (_sql: string, params: unknown[]) => (params[0] as string[]).map((id) => ({ id }))) };
    calendar = { startingOn: vi.fn(async () => []) };
    onboarding = { userIdsByProgram: vi.fn(async () => new Map<string, string[]>()) };
    transcript = { onSaved: vi.fn() };
    service = new NotificationsService(db as never, {} as never, clock as never, calendar as never, onboarding as never, transcript as never);
  });

  describe('createDue', () => {
    // Dũng's rule 4: days follow Vietnam time. The day is read from the injected clock, never from the database.
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
      // A term that starts in seven days is found by the query and makes nothing.
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
      // The no-repeat rule and the deletion rule are in the statement itself.
      expect(sql).toContain('ON CONFLICT ("user_id", "calendar_event_id", "kind") DO NOTHING');
      expect(sql).toContain('u."deletion_requested_at" IS NULL');
      // The copy of the date, and the clock's instant as created_at.
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

  // Dũng's rule 3.
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
