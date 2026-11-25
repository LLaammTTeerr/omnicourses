import { describe, expect, it } from 'vitest';
import { CALENDAR_EVENT_KINDS } from '../academic-calendar/academic-calendar-event.entity.js';
import { LINKS_OF, NOTIFICATION_KINDS, NOTIFICATION_LINKS, notificationsDue, NOTIFYING_EVENT_KINDS, startDaysDueOn } from './notification-kinds.js';

// Dũng's rules 1, 2 and 6 (ADR 0018), on synthetic dates.
describe('notificationsDue', () => {
  const registration = { kind: 'registration', startsOn: '2026-12-09' } as const;
  const termStart = { kind: 'term_start', startsOn: '2027-01-04' } as const;

  it('makes the seven-day notification only on the day seven days before the window opens', () => {
    expect(notificationsDue(registration, '2026-12-01')).toEqual([]);
    expect(notificationsDue(registration, '2026-12-02')).toEqual(['registration_soon']);
    expect(notificationsDue(registration, '2026-12-03')).toEqual([]);
  });

  it('makes the opening notification only on the day the window opens', () => {
    expect(notificationsDue(registration, '2026-12-08')).toEqual([]);
    expect(notificationsDue(registration, '2026-12-09')).toEqual(['registration_open']);
    expect(notificationsDue(registration, '2026-12-10')).toEqual([]);
  });

  it('makes the term-start notification only on the first day of the term, with no seven-day notice', () => {
    expect(notificationsDue(termStart, '2026-12-28')).toEqual([]);
    expect(notificationsDue(termStart, '2027-01-03')).toEqual([]);
    expect(notificationsDue(termStart, '2027-01-04')).toEqual(['term_start']);
    expect(notificationsDue(termStart, '2027-01-05')).toEqual([]);
  });

  it('counts seven days across a month and a year', () => {
    expect(notificationsDue({ kind: 'registration', startsOn: '2027-01-03' }, '2026-12-27')).toEqual(['registration_soon']);
  });

  it('makes nothing for the other kinds of school date, add/drop included (not in B2)', () => {
    for (const kind of CALENDAR_EVENT_KINDS.filter((k) => !(NOTIFYING_EVENT_KINDS as readonly string[]).includes(k))) {
      expect(notificationsDue({ kind, startsOn: '2026-12-09' }, '2026-12-09'), kind).toEqual([]);
      expect(notificationsDue({ kind, startsOn: '2026-12-09' }, '2026-12-02'), kind).toEqual([]);
    }
  });
});

describe('startDaysDueOn', () => {
  it('names every first day that makes a notification on that day', () => {
    expect(startDaysDueOn('2026-12-28')).toEqual(['2026-12-28', '2027-01-04']);
    for (const startsOn of ['2026-12-27', '2026-12-29', '2027-01-03', '2027-01-05']) {
      expect(startDaysDueOn('2026-12-28')).not.toContain(startsOn);
      for (const kind of NOTIFYING_EVENT_KINDS) expect(notificationsDue({ kind, startsOn }, '2026-12-28')).toEqual([]);
    }
  });
});

describe('LINKS_OF', () => {
  it('gives every kind at least one known link key, and no URL', () => {
    for (const kind of NOTIFICATION_KINDS) {
      expect(LINKS_OF[kind].length, kind).toBeGreaterThan(0);
      for (const link of LINKS_OF[kind]) expect(NOTIFICATION_LINKS).toContain(link);
    }
  });
});
