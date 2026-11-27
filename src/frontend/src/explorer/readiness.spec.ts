import { describe, expect, it } from 'vitest';
import type { CurriculumCourse, RequirementGroup } from '../curriculum/api.js';
import { unlockedBy } from './readiness.js';

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

describe('unlockedBy (F4 curriculum graph edges)', () => {
  it('finds unique downstream courses whose recorded prerequisites include the selected course', () => {
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
