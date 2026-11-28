import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import contract from '../../../backend/openapi.json';
import { API_URL } from '../api.js';
import { contractEnum, contractNullable, contractShape, nullableKeys, type Shape } from '../testing/contract.js';
import { signedInPinia } from '../testing/signed-in.js';
import { CALENDAR_EVENT_KINDS, fetchAcademicCalendar, type AcademicCalendar, type CalendarEvent, type CalendarProgram } from './api.js';
import { restoreMocksAfterCheckingCalls } from '../testing/fetch.js';

const NULLABLE: Record<string, string[]> = {
  AcademicCalendarDto: nullableKeys<AcademicCalendar>({ program: true }),
  CalendarProgramDto: nullableKeys<CalendarProgram>({ nameEn: true }),
  AcademicCalendarEventDto: nullableKeys<CalendarEvent>({ notes: true, sourceUrl: true, term: true, titleEn: true }),
};

describe('academic calendar types against the contract (ADR 0017)', () => {
  it.each([
    ['AcademicCalendarDto', { program: 'required', events: 'required' } satisfies Shape<AcademicCalendar>],
    ['CalendarProgramDto', { id: 'required', code: 'required', nameVi: 'required', nameEn: 'required' } satisfies Shape<CalendarProgram>],
    [
      'AcademicCalendarEventDto',
      {
        id: 'required',
        academicYear: 'required',
        term: 'required',
        kind: 'required',
        startsOn: 'required',
        endsOn: 'required',
        title: 'required',
        titleEn: 'required',
        sourceUrl: 'required',
        notes: 'required',
        updatedAt: 'required',
      } satisfies Shape<CalendarEvent>,
    ],
  ])('has the fields of %s', (schema, shape) => {
    expect(contractShape(schema)).toEqual(shape);
    expect(contractNullable(schema)).toEqual(NULLABLE[schema] ?? []);
  });

  it('has the kinds and terms of the contract', () => {
    expect([...CALENDAR_EVENT_KINDS].sort()).toEqual(contractEnum('AcademicCalendarEventDto', 'kind'));
    expect(contractEnum('AcademicCalendarEventDto', 'term').filter((t) => t !== null)).toEqual([1, 2, 3]);
  });
});

describe('fetchAcademicCalendar', () => {
  beforeEach(() => signedInPinia());
  afterEach(() => restoreMocksAfterCheckingCalls());

  it('asks for the school dates with the token of the signed-in student', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ program: null, events: [] }));
    await expect(fetchAcademicCalendar()).resolves.toEqual({ program: null, events: [] });
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/academic-calendar`, expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer zz-token' } }));
  });
});
