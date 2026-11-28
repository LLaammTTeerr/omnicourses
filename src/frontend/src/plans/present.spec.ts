import { describe, expect, it } from 'vitest';
import { commonestCredits } from './present.js';
import { curriculumCourse, ELECTIVE_GROUP, group } from './testing/fixtures.js';

describe('commonestCredits', () => {
  it('offers the credits most courses of the group carry', () => {
    const g = group(ELECTIVE_GROUP, 'Tự chọn', 'elective', [curriculumCourse('ZZ401', 'A', 4), curriculumCourse('ZZ402', 'B', 3), curriculumCourse('ZZ403', 'C', 3)]);
    expect(commonestCredits(g)).toBe(3);
  });

  it('takes the larger credits on a tie', () => {
    const g = group(ELECTIVE_GROUP, 'Tự chọn', 'elective', [curriculumCourse('ZZ401', 'A', 2), curriculumCourse('ZZ402', 'B', 4)]);
    expect(commonestCredits(g)).toBe(4);
  });
});
