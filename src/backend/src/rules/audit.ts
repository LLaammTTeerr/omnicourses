// The degree audit (F3, ADR 0013): the student's transcript against their curriculum. One pure
// function; RulesService loads the inputs.
import type { CurriculumRules } from '../curriculum/curriculum-rules.reader.js';
import { compareTerms } from '../terms/current-term.js';
import type { Term } from '../terms/term.js';
import type { TranscriptEntry } from '../transcript/transcript-entry.js';
import { attemptPasses, courseRecords, isCompleted, recordAsOf, type CourseRecord } from './attempts.js';
import type { AuditWarning, CreditSummary, DegreeAudit, GpaSummary, TermSummary, UnmatchedCourse } from './audit-types.js';
import { checkTermLoad } from './credit-caps.js';
import { byText, combinedMinimumCoverage, creditsOf, groupCoverage, placements, recordCredits, type Placement } from './coverage.js';
import { fourPointAverage, weightedAverage, type WeightedGrade } from './gpa.js';
import { classify, yearLevel } from './grades.js';
import { graduationStatus } from './graduation.js';

const unique = (codes: string[]) => [...new Set(codes)].sort(byText);

export function degreeAudit(rules: CurriculumRules, transcript: readonly TranscriptEntry[]): DegreeAudit {
  const records = courseRecords(transcript);
  const placed = placements(rules);

  const groups = groupCoverage(rules, records, placed);
  const combinedMinimums = combinedMinimumCoverage(rules, groups);
  const credits = creditSummary(rules, records, placed);
  return {
    programCode: rules.programCode,
    trainingType: rules.trainingType,
    cohortYear: rules.cohortYear,
    curriculumCode: rules.curriculumCode,
    credits,
    gpa: gpaSummary(records, placed, rules.cohortYear),
    terms: termSummaries(rules, transcript, records, placed),
    groups,
    combinedMinimums,
    unmatchedCourses: unmatched(records, placed),
    graduation: graduationStatus(groups, combinedMinimums, credits),
    warnings: warnings(records, placed),
  };
}

/** Each curriculum course once, with the credits it is worth to the audit. */
function matched(records: ReadonlyMap<string, CourseRecord>, placed: ReadonlyMap<string, Placement>) {
  return [...records.values()]
    .filter((r) => placed.has(r.code))
    .map((record) => {
      const place = placed.get(record.code)!;
      return { record, place, credits: creditsOf(place.course, recordCredits(record)) };
    });
}

function creditSummary(rules: CurriculumRules, records: ReadonlyMap<string, CourseRecord>, placed: ReadonlyMap<string, Placement>): CreditSummary {
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

/**
 * The official graded courses that enter a GPA (Điều 15.1): courses of the curriculum only
 * ("nằm trong yêu cầu của chương trình đào tạo"), not the ones it leaves out (Điều 15.1.c), and only
 * graded results: exempt (Điều 13.3) and pass/fail courses have no grade to average.
 */
function gpaCourses(records: Iterable<CourseRecord>, placed: ReadonlyMap<string, Placement>, passedOnly: boolean): WeightedGrade[] {
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

function gpaSummary(records: ReadonlyMap<string, CourseRecord>, placed: ReadonlyMap<string, Placement>, cohortYear: number): GpaSummary {
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

function termSummaries(
  rules: CurriculumRules,
  transcript: readonly TranscriptEntry[],
  records: ReadonlyMap<string, CourseRecord>,
  placed: ReadonlyMap<string, Placement>,
): TermSummary[] {
  const terms: Term[] = [];
  for (const entry of [...transcript].sort((a, b) => compareTerms(a.term, b.term))) {
    if (!terms.some((t) => compareTerms(t, entry.term) === 0)) terms.push(entry.term);
  }
  return terms.map((term) => {
    const rows = transcript.filter((e) => compareTerms(e.term, term) === 0);
    // Every sitting of the term, retakes included (Điều 15.1.a; the audit prototype: "ĐTB học kỳ tính mọi lần học").
    const graded = rows.flatMap((e): (WeightedGrade & { passes: boolean })[] => {
      const place = placed.get(e.courseCode);
      if (!place || !place.course.countsTowardGpa || e.result !== 'graded' || e.grade === null) return [];
      return [{ grade: e.grade, credits: creditsOf(place.course, e.credits), passes: attemptPasses(e) }];
    });
    const asOf = [...records.values()].map((r) => recordAsOf(r, term)).filter((r): r is CourseRecord => r !== null);
    const load = checkTermLoad(
      rules.trainingType,
      term.number,
      rows.map((e) => ({ credits: e.credits, excludedFromMinimum: placed.get(e.courseCode)?.course.countsTowardTotal === false })),
    );
    return {
      term: { year: term.year, number: term.number },
      kind: load.kind,
      credits: load.credits,
      passedCredits: rows.filter(attemptPasses).reduce((sum, e) => sum + e.credits, 0),
      average: weightedAverage(graded)?.value ?? null,
      accumulatedAverage: weightedAverage(graded.filter((g) => g.passes))?.value ?? null,
      cumulativeAccumulatedAverage: weightedAverage(gpaCourses(asOf, placed, true))?.value ?? null,
      failedCourseCodes: unique(rows.filter((e) => isCompleted(e) && !attemptPasses(e)).map((e) => e.courseCode)),
      inProgressCourseCodes: unique(rows.filter((e) => e.result === 'in_progress').map((e) => e.courseCode)),
      caps: load.caps,
      capViolations: load.violations,
    };
  });
}

function unmatched(records: ReadonlyMap<string, CourseRecord>, placed: ReadonlyMap<string, Placement>): UnmatchedCourse[] {
  return [...records.values()]
    .filter((r) => !placed.has(r.code))
    .map((r) => ({
      code: r.code,
      name: r.name,
      credits: recordCredits(r),
      result: r.official?.result ?? null,
      grade: r.official?.grade ?? null,
      passed: r.passed,
      inProgress: r.inProgress,
    }));
}

function warnings(records: ReadonlyMap<string, CourseRecord>, placed: ReadonlyMap<string, Placement>): AuditWarning[] {
  const list: AuditWarning[] = [];
  for (const record of records.values()) {
    const place = placed.get(record.code);
    if (!place) {
      list.push({
        code: 'not_in_curriculum',
        courseCode: record.code,
        message: 'No requirement group of the curriculum lists this course, and no course equivalence is recorded, so it counts toward nothing.',
        transcriptCredits: null,
        curriculumCredits: null,
      });
      continue;
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
  }
  return list;
}
