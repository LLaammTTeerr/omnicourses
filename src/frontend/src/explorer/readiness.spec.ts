import { describe, expect, it } from 'vitest';
import type { CurriculumCourse, RequirementGroup } from '../curriculum/api.js';
import type { TranscriptRow } from '../transcript/api.js';
import { courseStanding, transcriptStatuses, unlockedBy } from './readiness.js';

const row = (courseCode: string, result: TranscriptRow['result'], term: [number, 1 | 2 | 3], grade: number | null = null): TranscriptRow => ({
  courseCode,
  courseName: courseCode,
  credits: 4,
  result,
  grade,
  term: { year: term[0], number: term[1] },
});

const course = (code: string, prerequisites: string[] | null): CurriculumCourse => ({
  code,
  nameVi: code,
  nameEn: null,
  credits: 4,
  theoryPeriods: 45,
  labPeriods: 0,
  exercisePeriods: null,
  projectPeriods: null,
  prerequisites,
  offeringTerms: null,
});

describe('explorer deterministic transcript & readiness rules (F4)', () => {
  it('resolves passed, in_progress, and failed from chronological transcript attempts', () => {
    const statuses = transcriptStatuses([
      row('CS101', 'fail', [2024, 1]),
      row('CS101', 'graded', [2024, 2], 7.5),
      row('CS102', 'graded', [2024, 1], 4.9),
      row('CS103', 'fail', [2024, 1]),
      row('CS103', 'in_progress', [2024, 2]),
      row('CS104', 'graded', [2024, 1], 8.0),
      row('CS104', 'graded', [2024, 2], 4.0),
      row('CS105', 'exempt', [2024, 1]),
    ]);
    expect(statuses.get('CS101')).toBe('passed');
    expect(statuses.get('CS102')).toBe('failed');
    expect(statuses.get('CS103')).toBe('in_progress');
    expect(statuses.get('CS104')).toBe('failed');
    expect(statuses.get('CS105')).toBe('passed');
  });

  it('computes locked vs available only when prerequisites are recorded, never when null', () => {
    const before = transcriptStatuses([row('CS469', 'fail', [2025, 1])]);
    expect(courseStanding(course('ZZ414', null), before)).toEqual({ transcriptStatus: null, readiness: null, missingPrerequisites: [] });
    expect(courseStanding(course('CS469', []), before)).toEqual({ transcriptStatus: 'failed', readiness: 'available', missingPrerequisites: [] });
    expect(courseStanding(course('CS470', ['CS469']), before)).toEqual({
      transcriptStatus: null,
      readiness: 'locked',
      missingPrerequisites: ['CS469'],
    });

    const inProgress = transcriptStatuses([row('CS469', 'in_progress', [2025, 2])]);
    expect(courseStanding(course('CS469', []), inProgress)).toEqual({ transcriptStatus: 'in_progress', readiness: null, missingPrerequisites: [] });
    expect(courseStanding(course('CS470', ['CS469']), inProgress)).toEqual({ transcriptStatus: null, readiness: 'available', missingPrerequisites: [] });

    const passed = transcriptStatuses([row('CS469', 'pass', [2025, 2])]);
    expect(courseStanding(course('CS470', ['CS469']), passed)).toEqual({ transcriptStatus: null, readiness: 'available', missingPrerequisites: [] });
  });

  it('finds unique downstream courses unlocked by a selected course', () => {
    const cs469 = course('CS469', []);
    const cs470 = course('CS470', ['CS469']);
    const groups: RequirementGroup[] = [
      { id: 'g1', name: 'Core', kind: 'compulsory', creditsTotal: 8, creditsTotalMin: null, officialNotes: null, courses: [cs469, cs470] },
      { id: 'g2', name: 'Elective', kind: 'elective', creditsTotal: null, creditsTotalMin: 4, officialNotes: null, courses: [cs470, course('ZZ999', null)] },
    ];
    expect(unlockedBy(groups, 'CS469').map((c) => c.code)).toEqual(['CS470']);
    expect(unlockedBy(groups, 'CS470')).toEqual([]);
  });
});
