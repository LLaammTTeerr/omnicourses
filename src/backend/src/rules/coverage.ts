// Requirement coverage (F3, ADR 0013): for each requirement group of the curriculum, what the
// transcript has passed, has in progress and still needs. Pure functions.
import type { CourseRecord } from './attempts.js';
import type { CombinedMinimumCoverage, CourseCoverage, CourseStatus, GroupCoverage } from './audit-types.js';
import type { CurriculumRuleCourse, CurriculumRuleGroup, CurriculumRules } from './inputs.js';

/** Code-point order: the same on every machine. */
export const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Where a curriculum course counts, and the link it counts through. */
export interface Placement {
  group: CurriculumRuleGroup;
  course: CurriculumRuleCourse;
}

/**
 * A course linked to several groups of one curriculum counts in exactly one of them, never twice
 * (ADR 0013): a compulsory group before an elective one, then the group name in code-point order,
 * then the group id. No seeded curriculum links a course twice; the rule keeps the result
 * deterministic and never counts credits twice.
 */
export function placements(rules: CurriculumRules): Map<string, Placement> {
  const order = [...rules.groups].sort(
    (a, b) => Number(a.kind !== 'compulsory') - Number(b.kind !== 'compulsory') || byText(a.name, b.name) || byText(a.id, b.id),
  );
  const result = new Map<string, Placement>();
  for (const group of order) {
    for (const course of group.courses) if (!result.has(course.code)) result.set(course.code, { group, course });
  }
  return result;
}

/**
 * The credits a curriculum course is worth to the audit: the catalog's, or the transcript's when
 * it says fewer. Two sources that disagree never add credits (ADR 0013); the audit warns.
 */
export function creditsOf(course: CurriculumRuleCourse, transcriptCredits: number | null): number {
  return transcriptCredits === null ? course.credits : Math.min(course.credits, transcriptCredits);
}

/** The transcript credits of a course: those of its official attempt, else of its latest one. */
export function recordCredits(record: CourseRecord): number {
  return (record.official ?? record.attempts.at(-1)!).credits;
}

function statusOf(record: CourseRecord | undefined): Exclude<CourseStatus, 'counted_in_other_group'> {
  if (!record) return 'not_taken';
  if (record.passed) return 'passed';
  if (record.inProgress) return 'in_progress';
  return record.official ? 'failed' : 'not_taken';
}

interface Tally {
  group: CurriculumRuleGroup;
  required: number | null;
  passed: number;
  inProgress: number;
  courses: CourseCoverage[];
}

function tally(group: CurriculumRuleGroup, records: ReadonlyMap<string, CourseRecord>, placed: ReadonlyMap<string, Placement>): Tally {
  const required = group.kind === 'compulsory' ? group.creditsTotal : group.creditsTotalMin;
  let passed = 0;
  let inProgress = 0;
  const courses = group.courses.map((course): CourseCoverage => {
    const record = records.get(course.code);
    const own = statusOf(record);
    const countedIn = placed.get(course.code)!.group.id;
    const here = countedIn === group.id;
    if (here && course.countsTowardTotal && record) {
      const credits = creditsOf(course, recordCredits(record));
      if (own === 'passed') passed += credits;
      else if (own === 'in_progress') inProgress += credits;
    }
    // Its credits count once, in its placement. Only a passed course shows as counted elsewhere: a failed or
    // in-progress one keeps its own status, since a compulsory group that lists it still needs it passed (ADR 0013).
    return {
      code: course.code,
      nameVi: course.nameVi,
      nameEn: course.nameEn,
      credits: course.credits,
      countsTowardTotal: course.countsTowardTotal,
      countsTowardGpa: course.countsTowardGpa,
      status: !here && own === 'passed' ? 'counted_in_other_group' : own,
      result: record?.official?.result ?? null,
      grade: record?.official?.grade ?? null,
      countedInGroupId: !here && (own === 'passed' || own === 'in_progress') ? countedIn : null,
    };
  });
  return { group, required, passed, inProgress, courses };
}

/**
 * Coverage of every group. Overflow (ADR 0013): a group's passed credits beyond its own minimum
 * count toward its overflow target in the same curriculum. Only passed credits overflow, one hop
 * only, and overflow never makes the source group met.
 */
export function groupCoverage(rules: CurriculumRules, records: ReadonlyMap<string, CourseRecord>, placed: ReadonlyMap<string, Placement>): GroupCoverage[] {
  const tallies = rules.groups.map((g) => tally(g, records, placed));
  const ids = new Set(rules.groups.map((g) => g.id));
  const overflowIn = new Map<string, number>();
  const overflowOut = new Map<string, number>();
  for (const t of tallies) {
    const target = t.group.overflowToGroupId;
    if (target === null || !ids.has(target) || target === t.group.id || t.required === null) continue;
    const excess = Math.max(0, t.passed - t.required);
    overflowOut.set(t.group.id, excess);
    overflowIn.set(target, (overflowIn.get(target) ?? 0) + excess);
  }
  return tallies.map((t) => {
    const into = overflowIn.get(t.group.id) ?? 0;
    const met =
      t.group.kind === 'compulsory'
        ? t.group.courses.every((c) => records.get(c.code)?.passed === true)
        : t.required === null || t.passed + into >= t.required;
    return {
      id: t.group.id,
      name: t.group.name,
      kind: t.group.kind,
      requiredCredits: t.required,
      passedCredits: t.passed,
      inProgressCredits: t.inProgress,
      overflowInCredits: into,
      overflowOutCredits: overflowOut.get(t.group.id) ?? 0,
      overflowToGroupId: t.group.overflowToGroupId,
      // A met group needs nothing more, even when its credits fall short of its total (fewer transcript credits, or a
      // passed course counted in another group): a compulsory group is met by its courses, not its credits.
      remainingCredits: t.required === null ? null : met ? 0 : Math.max(0, t.required - t.passed - into - t.inProgress),
      met,
      courses: t.courses,
    };
  });
}

/**
 * A combined minimum: the groups' passed credits together. Overflow between two of its own groups is
 * counted once; overflow from a group outside counts; overflow to a group outside does not.
 */
export function combinedMinimumCoverage(rules: CurriculumRules, groups: readonly GroupCoverage[]): CombinedMinimumCoverage[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  return rules.combinedMinimums.map((m) => {
    const members = new Set(m.groupIds.filter((id) => byId.has(id)));
    let credits = 0;
    let inProgress = 0;
    for (const id of members) {
      const g = byId.get(id)!;
      credits += g.passedCredits;
      if (g.overflowToGroupId !== null && !members.has(g.overflowToGroupId)) credits -= g.overflowOutCredits;
      inProgress += g.inProgressCredits;
    }
    for (const g of groups) {
      if (!members.has(g.id) && g.overflowToGroupId !== null && members.has(g.overflowToGroupId)) credits += g.overflowOutCredits;
    }
    return {
      id: m.id,
      name: m.name,
      creditsMin: m.creditsMin,
      officialNotes: m.officialNotes,
      groupIds: [...m.groupIds],
      credits,
      inProgressCredits: inProgress,
      remainingCredits: Math.max(0, m.creditsMin - credits - inProgress),
      met: credits >= m.creditsMin,
    };
  });
}
