import { byText } from '../common/collections.js';
import type { CurriculumRuleCourse, CurriculumRuleGroup, CurriculumRules } from '../curriculum/curriculum-rules.reader.js';
import type { CourseRecord } from './attempts.js';
import type { CombinedMinimumCoverage, CourseCoverage, CourseStatus, GroupCoverage } from './types.js';

export interface CountedLink {
  group: CurriculumRuleGroup;
  course: CurriculumRuleCourse;
}

export function placements(rules: CurriculumRules): Map<string, CountedLink> {
  const order = [...rules.groups].sort(
    (a, b) => Number(a.kind !== 'compulsory') - Number(b.kind !== 'compulsory') || byText(a.name, b.name) || byText(a.id, b.id),
  );
  const result = new Map<string, CountedLink>();
  for (const group of order) {
    for (const course of group.courses) if (!result.has(course.code)) result.set(course.code, { group, course });
  }
  return result;
}

export function creditsOf(course: CurriculumRuleCourse, transcriptCredits: number | null): number {
  return transcriptCredits === null ? course.credits : Math.min(course.credits, transcriptCredits);
}

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

function tally(group: CurriculumRuleGroup, records: ReadonlyMap<string, CourseRecord>, placed: ReadonlyMap<string, CountedLink>): Tally {
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

function overflows(tallies: readonly Tally[]): { overflowIn: Map<string, number>; overflowOut: Map<string, number> } {
  const ids = new Set(tallies.map((t) => t.group.id));
  const overflowIn = new Map<string, number>();
  const overflowOut = new Map<string, number>();
  for (const t of tallies) {
    const target = t.group.overflowToGroupId;
    if (target === null || !ids.has(target) || target === t.group.id || t.required === null) continue;
    const excess = Math.max(0, t.passed - t.required);
    overflowOut.set(t.group.id, excess);
    overflowIn.set(target, (overflowIn.get(target) ?? 0) + excess);
  }
  return { overflowIn, overflowOut };
}

export function groupCoverage(rules: CurriculumRules, records: ReadonlyMap<string, CourseRecord>, placed: ReadonlyMap<string, CountedLink>): GroupCoverage[] {
  const tallies = rules.groups.map((g) => tally(g, records, placed));
  const { overflowIn, overflowOut } = overflows(tallies);
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
      remainingCredits: t.required === null ? null : met ? 0 : Math.max(0, t.required - t.passed - into - t.inProgress),
      met,
      courses: t.courses,
    };
  });
}

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
