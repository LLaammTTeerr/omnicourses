import { byText, groupBy } from '../common/collections.js';
import type { CurriculumRules } from '../curriculum/curriculum-rules.js';
import { compareTerms, copyTerm, type Term } from '../terms/term.js';
import type { TranscriptEntry } from '../transcript/transcript-entry.js';
import { attemptPasses, courseRecords, isCompleted, recordAsOf, resolve, type CourseRecord } from './attempts.js';
import type {
  AuditWarning,
  CombinedMinimumCoverage,
  CreditSummary,
  DegreeAudit,
  GpaSummary,
  GroupCoverage,
  TermAttempt,
  TermCombinedMinimumCoverage,
  TermGroupCoverage,
  TermSummary,
  UnmatchedCourse,
} from './types.js';
import { checkTermLoad } from './credit-caps.js';
import { combinedMinimumCoverage, type CountedLink, creditsOf, groupCoverage, placements, recordCredits } from './coverage.js';
import { fourPointAverage, weightedAverage, type WeightedGrade } from './gpa.js';
import { classify, yearLevel } from './grades.js';
import { graduationStatus } from './graduation.js';

const unique = (codes: string[]) => [...new Set(codes)].sort(byText);

export function degreeAudit(rules: CurriculumRules, transcript: readonly TranscriptEntry[], asOf: Term | null = null): DegreeAudit {
  const entries = asOf === null ? transcript : transcript.filter((e) => compareTerms(e.term, asOf) <= 0);
  const records = courseRecords(entries);
  const placed = placements(rules);

  const groups = groupCoverage(rules, records, placed);
  const combinedMinimums = combinedMinimumCoverage(rules, groups);
  const credits = creditSummary(rules, records, placed);
  return {
    programCode: rules.programCode,
    trainingType: rules.trainingType,
    cohortYear: rules.cohortYear,
    curriculumCode: rules.curriculumCode,
    asOfTerm: asOf === null ? null : copyTerm(asOf),
    credits,
    gpa: gpaSummary(records, placed, rules.cohortYear),
    terms: termSummaries(rules, entries, records, placed),
    groups,
    combinedMinimums,
    unmatchedCourses: unmatched(records, placed),
    graduation: graduationStatus(groups, combinedMinimums, credits),
    warnings: warnings(records, placed),
  };
}

function matched(records: ReadonlyMap<string, CourseRecord>, placed: ReadonlyMap<string, CountedLink>) {
  return [...records.values()]
    .filter((r) => placed.has(r.code))
    .map((record) => {
      const place = placed.get(record.code)!;
      return { record, place, credits: creditsOf(place.course, recordCredits(record)) };
    });
}

function creditSummary(rules: CurriculumRules, records: ReadonlyMap<string, CourseRecord>, placed: ReadonlyMap<string, CountedLink>): CreditSummary {
  let accumulated = 0;
  let towardTotal = 0;
  let inProgressTowardTotal = 0;
  for (const { record, place, credits } of matched(records, placed)) {
    if (record.passed) {
      accumulated += credits;
      if (place.course.countsTowardTotal) towardTotal += credits;
    } else if (record.inProgress && place.course.countsTowardTotal) {
      inProgressTowardTotal += credits;
    }
  }
  const totalRequired = rules.totalCreditsMin;
  return {
    accumulated,
    towardTotal,
    inProgressTowardTotal,
    totalRequired,
    remaining: totalRequired === null ? null : Math.max(0, totalRequired - towardTotal),
    yearLevel: yearLevel(accumulated),
  };
}

function gpaCourses(records: Iterable<CourseRecord>, placed: ReadonlyMap<string, CountedLink>, passedOnly: boolean): WeightedGrade[] {
  const items: WeightedGrade[] = [];
  for (const record of records) {
    const place = placed.get(record.code);
    const official = record.official;
    if (!place || !place.course.countsTowardGpa || official?.result !== 'graded' || official.grade === null) continue;
    if (passedOnly && !record.passed) continue;
    items.push({ grade: official.grade, credits: creditsOf(place.course, official.credits) });
  }
  return items;
}

function gpaSummary(records: ReadonlyMap<string, CourseRecord>, placed: ReadonlyMap<string, CountedLink>, cohortYear: number): GpaSummary {
  const passed = gpaCourses(records.values(), placed, true);
  const accumulated = weightedAverage(passed);
  return {
    average: weightedAverage(gpaCourses(records.values(), placed, false))?.value ?? null,
    accumulatedAverage: accumulated?.value ?? null,
    accumulatedAverageFourPoint: fourPointAverage(passed)?.value ?? null,
    classification: accumulated ? classify(accumulated.numerator, accumulated.denominator, cohortYear) : null,
    gradedCredits: passed.reduce((sum, i) => sum + i.credits, 0),
  };
}

function transcriptTerms(transcript: readonly TranscriptEntry[]): Term[] {
  const terms: Term[] = [];
  for (const entry of [...transcript].sort((a, b) => compareTerms(a.term, b.term))) {
    if (!terms.some((t) => compareTerms(t, entry.term) === 0)) terms.push(entry.term);
  }
  return terms;
}

function termSummaries(
  rules: CurriculumRules,
  transcript: readonly TranscriptEntry[],
  records: ReadonlyMap<string, CourseRecord>,
  placed: ReadonlyMap<string, CountedLink>,
): TermSummary[] {
  const summaries: TermSummary[] = [];
  for (const term of transcriptTerms(transcript)) {
    const rows = transcript.filter((e) => compareTerms(e.term, term) === 0);
    summaries.push(termSummary(rules, term, rows, records, placed, summaries.at(-1)?.cumulativeAccumulatedAverage ?? null));
  }
  return summaries;
}

const HUNDREDTHS = 100;

function averageChange(previous: number | null, current: number | null): number | null {
  if (previous === null || current === null) return null;
  return (Math.round(current * HUNDREDTHS) - Math.round(previous * HUNDREDTHS)) / HUNDREDTHS;
}

function termAttempts(rows: readonly TranscriptEntry[], placed: ReadonlyMap<string, CountedLink>): TermAttempt[] {
  return [...rows]
    .sort((a, b) => byText(a.courseCode, b.courseCode))
    .map((e) => ({
      code: e.courseCode,
      name: e.courseName,
      credits: e.credits,
      result: e.result,
      grade: e.grade,
      passed: attemptPasses(e),
      inProgress: e.result === 'in_progress',
      requirementGroupId: placed.get(e.courseCode)?.group.id ?? null,
    }));
}

function deduplicateTermRows(rows: readonly TranscriptEntry[]): TranscriptEntry[] {
  return [...groupBy(rows, (e) => e.courseCode)].map(([code, courseRows]) => {
    if (courseRows.length === 1) return courseRows[0];
    const resolved = resolve(code, courseRows);
    return resolved.official ?? resolved.attempts.at(-1)!;
  });
}

function termGroupCoverage(group: GroupCoverage): TermGroupCoverage {
  return {
    id: group.id,
    passedCredits: group.passedCredits,
    inProgressCredits: group.inProgressCredits,
    overflowInCredits: group.overflowInCredits,
    remainingCredits: group.remainingCredits,
    courses: group.courses.map(({ code, credits, status, grade }) => ({ code, credits, status, grade })),
  };
}

function termCombinedMinimumCoverage({ id, credits, inProgressCredits, remainingCredits }: CombinedMinimumCoverage): TermCombinedMinimumCoverage {
  return { id, credits, inProgressCredits, remainingCredits };
}

function termSummary(
  rules: CurriculumRules,
  term: Term,
  rows: readonly TranscriptEntry[],
  records: ReadonlyMap<string, CourseRecord>,
  placed: ReadonlyMap<string, CountedLink>,
  previousCumulativeAverage: number | null,
): TermSummary {
  const entries = deduplicateTermRows(rows);
  const graded = entries.flatMap((e): (WeightedGrade & { passes: boolean })[] => {
    const place = placed.get(e.courseCode);
    if (!place || !place.course.countsTowardGpa || e.result !== 'graded' || e.grade === null) return [];
    return [{ grade: e.grade, credits: creditsOf(place.course, e.credits), passes: attemptPasses(e) }];
  });
  const asOf = [...records.values()].map((r) => recordAsOf(r, term)).filter((r): r is CourseRecord => r !== null);
  const recordsToDate = new Map(asOf.map((r) => [r.code, r]));
  const toDate = creditSummary(rules, recordsToDate, placed);
  const groupsToDate = groupCoverage(rules, recordsToDate, placed);
  const cumulative = weightedAverage(gpaCourses(asOf, placed, true));
  const cumulativeAccumulatedAverage = cumulative?.value ?? null;
  const load = checkTermLoad(
    rules.trainingType,
    term.number,
    entries.map((e) => ({ credits: e.credits, excludedFromMinimum: placed.get(e.courseCode)?.course.countsTowardTotal === false })),
  );
  return {
    term: { year: term.year, number: term.number },
    kind: load.kind,
    credits: load.credits,
    passedCredits: entries.filter(attemptPasses).reduce((sum, e) => sum + e.credits, 0),
    average: weightedAverage(graded)?.value ?? null,
    accumulatedAverage: weightedAverage(graded.filter((g) => g.passes))?.value ?? null,
    cumulativeAccumulatedAverage,
    cumulativeAccumulatedAverageChange: averageChange(previousCumulativeAverage, cumulativeAccumulatedAverage),
    cumulativeAccumulatedCredits: toDate.accumulated,
    cumulativeTowardTotal: toDate.towardTotal,
    cumulativeYearLevel: toDate.yearLevel,
    cumulativeClassification: cumulative ? classify(cumulative.numerator, cumulative.denominator, rules.cohortYear) : null,
    cumulativeRemaining: toDate.remaining,
    cumulativeGroups: groupsToDate.map(termGroupCoverage),
    cumulativeCombinedMinimums: combinedMinimumCoverage(rules, groupsToDate).map(termCombinedMinimumCoverage),
    failedCourseCodes: unique(entries.filter((e) => isCompleted(e) && !attemptPasses(e)).map((e) => e.courseCode)),
    inProgressCourseCodes: unique(entries.filter((e) => e.result === 'in_progress').map((e) => e.courseCode)),
    caps: load.caps,
    capViolations: load.violations,
    attempts: termAttempts(entries, placed),
  };
}

function unmatched(records: ReadonlyMap<string, CourseRecord>, placed: ReadonlyMap<string, CountedLink>): UnmatchedCourse[] {
  return [...records.values()]
    .filter((record) => !placed.has(record.code))
    .map((record) => ({
      code: record.code,
      name: record.name,
      credits: recordCredits(record),
      result: record.official?.result ?? null,
      grade: record.official?.grade ?? null,
      passed: record.passed,
      inProgress: record.inProgress,
    }));
}

function warnings(records: ReadonlyMap<string, CourseRecord>, placed: ReadonlyMap<string, CountedLink>): AuditWarning[] {
  return [...records.values()].flatMap((record) => recordWarnings(record, placed.get(record.code)));
}

function recordWarnings(record: CourseRecord, place: CountedLink | undefined): AuditWarning[] {
  const list: AuditWarning[] = [];
  if (!place) {
    list.push({
      code: 'not_in_curriculum',
      courseCode: record.code,
      message: 'No requirement group of the curriculum lists this course, and no course equivalence is recorded, so it counts toward nothing.',
      transcriptCredits: null,
      curriculumCredits: null,
    });
    return list;
  }
  const differing = [...new Set(record.attempts.filter((a) => a.credits !== place.course.credits).map((a) => a.credits))].sort((x, y) => x - y);
  if (differing.length) {
    list.push({
      code: 'credits_differ',
      courseCode: record.code,
      message: `The transcript gives ${differing.join(', ')} credits and the curriculum ${place.course.credits}; the audit counts the smaller number.`,
      transcriptCredits: differing,
      curriculumCredits: place.course.credits,
    });
  }
  if (record.sameTermAttempts) {
    list.push({
      code: 'same_term_attempts',
      courseCode: record.code,
      message: 'Several completed attempts in the same term: which was last is unknown, so the worse result counts.',
      transcriptCredits: null,
      curriculumCredits: null,
    });
  }
  return list;
}
