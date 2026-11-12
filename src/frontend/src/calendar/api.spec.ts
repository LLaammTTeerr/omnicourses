import { describe, expect, it } from 'vitest';
import contract from '../../../backend/openapi.json';
import { contractEnum, contractShape, type Shape } from '../testing/contract.js';
import { CALENDAR_EVENT_KINDS, type AcademicCalendar, type CalendarEvent, type CalendarProgram } from './api.js';

// The school-dates API arrives with PR 97; until it is in the committed contract there is nothing to check against.
const inContract = Object.hasOwn(contract.components.schemas, 'AcademicCalendarDto');

describe.skipIf(!inContract)('academic calendar types against the contract (ADR 0016)', () => {
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
  });

  it('has the kinds and terms of the contract', () => {
    expect([...CALENDAR_EVENT_KINDS].sort()).toEqual(contractEnum('AcademicCalendarEventDto', 'kind'));
    expect(contractEnum('AcademicCalendarEventDto', 'term').filter((t) => t !== null)).toEqual([1, 2, 3]);
  });
});
