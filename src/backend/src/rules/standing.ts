import { byText } from '../common/collections.js';
import type { CurriculumRules } from '../curriculum/curriculum-rules.js';
import type { TranscriptEntry } from '../transcript/transcript-entry.js';
import { courseRecords, courseStatus } from './attempts.js';
import { checkPrerequisites, passedOnly } from './prerequisites.js';
import type { CourseStandingItem } from './types.js';

export function curriculumStanding(rules: CurriculumRules, entries: readonly TranscriptEntry[]): CourseStandingItem[] {
  const records = courseRecords(entries);
  const satisfied = passedOnly(records);

  const codes = [...new Set(rules.groups.flatMap((group) => group.courses.map((course) => course.code)))].sort(byText);
  return codes.map((code): CourseStandingItem => {
    const record = records.get(code);
    const transcriptStatus = record ? courseStatus(record) : null;
    const prerequisites = rules.prerequisites.get(code) ?? null;
    if (prerequisites === null || transcriptStatus === 'passed') {
      return { code, transcriptStatus, readiness: null, missingPrerequisites: [] };
    }
    const check = checkPrerequisites(prerequisites, satisfied);
    if (check.status === 'not_met') {
      return { code, transcriptStatus, readiness: 'locked', missingPrerequisites: check.missing };
    }
    if (transcriptStatus === 'in_progress') {
      return { code, transcriptStatus, readiness: null, missingPrerequisites: [] };
    }
    return { code, transcriptStatus, readiness: 'available', missingPrerequisites: [] };
  });
}
