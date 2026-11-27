import type { CurriculumCourse, RequirementGroup } from '../curriculum/api.js';
import type { Term, TranscriptRow } from '../transcript/api.js';

export type TranscriptCourseStatus = 'passed' | 'in_progress' | 'failed';
export type CourseReadiness = 'available' | 'locked';

export interface CourseStanding {
  transcriptStatus: TranscriptCourseStatus | null;
  readiness: CourseReadiness | null;
  missingPrerequisites: string[];
}

const PASSING_TENTHS = 50;
const TENTHS_PER_POINT = 10;
const UNGRADED_PASS_SEVERITY = 1000;
const FAILED_GRADE_OFFSET = 1000;
const UNGRADED_FAIL_SEVERITY = -2000;

const compareTerms = (a: Term, b: Term): number => a.year - b.year || a.number - b.number;

function attemptPasses(row: TranscriptRow): boolean {
  if (row.result === 'exempt' || row.result === 'pass') return true;
  if (row.result === 'graded') return row.grade !== null && row.grade !== undefined && Math.round(row.grade * TENTHS_PER_POINT) >= PASSING_TENTHS;
  return false;
}

function severity(row: TranscriptRow): number {
  const tenths = row.result === 'graded' && row.grade !== null && row.grade !== undefined ? Math.round(row.grade * TENTHS_PER_POINT) : null;
  if (!attemptPasses(row)) return tenths !== null ? tenths - FAILED_GRADE_OFFSET : UNGRADED_FAIL_SEVERITY;
  return tenths !== null ? tenths : UNGRADED_PASS_SEVERITY;
}

function resolveCourseStatus(attempts: readonly TranscriptRow[]): TranscriptCourseStatus | null {
  const sorted = [...attempts].sort((a, b) => compareTerms(a.term, b.term));
  const completed = sorted.filter((a) => a.result !== 'in_progress');
  const lastCompleted = completed.at(-1) ?? null;
  const official = lastCompleted
    ? completed.filter((a) => compareTerms(a.term, lastCompleted.term) === 0).reduce((worst, a) => (severity(a) < severity(worst) ? a : worst))
    : null;
  if (official !== null && attemptPasses(official)) return 'passed';
  if (sorted.some((a) => a.result === 'in_progress' && (official === null || compareTerms(a.term, official.term) > 0))) return 'in_progress';
  return official !== null ? 'failed' : null;
}

export function transcriptStatuses(rows: readonly TranscriptRow[]): Map<string, TranscriptCourseStatus> {
  const byCode = new Map<string, TranscriptRow[]>();
  for (const row of rows) {
    const code = row.courseCode.trim().toUpperCase();
    const list = byCode.get(code);
    if (list) list.push(row);
    else byCode.set(code, [row]);
  }
  const statuses = new Map<string, TranscriptCourseStatus>();
  for (const [code, attempts] of byCode) {
    const status = resolveCourseStatus(attempts);
    if (status) statuses.set(code, status);
  }
  return statuses;
}

export function courseStanding(
  course: Pick<CurriculumCourse, 'code' | 'prerequisites'>,
  statuses: ReadonlyMap<string, TranscriptCourseStatus>,
): CourseStanding {
  const transcriptStatus = statuses.get(course.code) ?? null;
  if (course.prerequisites === null) return { transcriptStatus, readiness: null, missingPrerequisites: [] };
  if (transcriptStatus === 'passed' || transcriptStatus === 'in_progress') {
    return { transcriptStatus, readiness: null, missingPrerequisites: [] };
  }
  const missingPrerequisites = [...new Set(course.prerequisites)]
    .filter((code) => {
      const status = statuses.get(code);
      return status !== 'passed' && status !== 'in_progress';
    })
    .sort();
  return missingPrerequisites.length > 0
    ? { transcriptStatus, readiness: 'locked', missingPrerequisites }
    : { transcriptStatus, readiness: 'available', missingPrerequisites: [] };
}

export function unlockedBy(groups: readonly RequirementGroup[], courseCode: string): CurriculumCourse[] {
  const seen = new Set<string>();
  const unlocked: CurriculumCourse[] = [];
  for (const group of groups) {
    for (const course of group.courses) {
      if (seen.has(course.code)) continue;
      if (Array.isArray(course.prerequisites) && course.prerequisites.includes(courseCode)) {
        seen.add(course.code);
        unlocked.push(course);
      }
    }
  }
  return unlocked;
}
