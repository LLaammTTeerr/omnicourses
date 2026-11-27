import { byText } from '../common/collections.js';
import type { CurriculumRules } from '../curriculum/curriculum-rules.reader.js';
import type { TranscriptEntry } from '../transcript/transcript-entry.js';
import { courseRecords, type CourseRecord } from './attempts.js';
import { checkPrerequisites } from './prerequisites.js';
import type { CourseStandingItem, TranscriptCourseStatus } from './types.js';

function statusOf(record: CourseRecord | undefined): TranscriptCourseStatus | null {
  if (!record) return null;
  if (record.passed) return 'passed';
  if (record.inProgress) return 'in_progress';
  return 'failed';
}

export function curriculumStanding(rules: CurriculumRules, entries: readonly TranscriptEntry[]): CourseStandingItem[] {
  const records = courseRecords(entries);
  const satisfied = new Set<string>();
  for (const record of records.values()) {
    if (record.passed) satisfied.add(record.code);
  }

  const codes = [...new Set(rules.groups.flatMap((group) => group.courses.map((course) => course.code)))].sort(byText);
  return codes.map((code): CourseStandingItem => {
    const transcriptStatus = statusOf(records.get(code));
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
