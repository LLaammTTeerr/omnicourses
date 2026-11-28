import { courseName, groupColour, orderGroups } from '../curriculum/present.js';
import type { GroupId } from '../groups.js';
import type { Lang } from '../locale.js';
import type { PlanIssueKind } from '../plans/api.js';
import { capOf, ISSUE_KINDS_SHOWN, meter, toneOf, type CapState, type Meter } from '../plans/issue-view.js';
import type { PLANNER_MESSAGES } from '../plans/messages.js';
import { termKey, termName } from '../terms.js';
import type { SharedCurriculum, SharedGroupCoverage, SharedPlacement, SharedPlan, SharedPlanCoverage, SharedPlanIssue, SharedPlanTerm } from './api.js';
import type { SHARING_MESSAGES } from './messages.js';

export type PlannerText = (typeof PLANNER_MESSAGES)[Lang];
export type SharingText = (typeof SHARING_MESSAGES)[Lang];

export interface SharedTileView {
  placement: SharedPlacement;
  title: string;
  name: string | null;
  credits: number | null;
  slot: boolean;
  colour: GroupId | null;
  tone: string;
  bad: boolean;
  issues: SharedPlanIssue[];
  unknowns: SharedPlanIssue[];
}

export interface SharedRowView {
  key: string;
  name: string;
  when: string;
  summer: boolean;
  credits: number;
  atLeast: boolean;
  maxCap: number | null;
  capsLabel: string;
  meter: Meter | null;
  cap: CapState;
  tone: string;
  rowIssues: SharedPlanIssue[];
  tiles: SharedTileView[];
}

export interface IssueLists {
  byKind: Record<PlanIssueKind, SharedPlanIssue[]>;
  listed: SharedPlanIssue[];
  violationCount: number;
}

export function wordIssue(planner: PlannerText, issue: SharedPlanIssue): string {
  const requirementName = () => issue.requirementGroupName ?? issue.combinedMinimumName ?? null;
  return planner.issue[issue.code](issue, { requirementName });
}

function buildTileView(placement: SharedPlacement, posIssues: SharedPlanIssue[], lang: Lang, planner: PlannerText): SharedTileView {
  const tone = toneOf(posIssues);
  const slot = placement.kind === 'slot';
  const colour = slot && placement.requirementGroupName ? groupColour({ name: placement.requirementGroupName, kind: 'elective' }) : null;
  const title = slot ? planner.slot(placement.requirementGroupName ?? planner.slotGroupUnknown) : (placement.courseCode ?? '?');
  const name = !slot && placement.nameVi !== null ? courseName({ nameVi: placement.nameVi, nameEn: placement.nameEn }, lang) : null;
  return {
    placement,
    title,
    name,
    credits: placement.credits,
    slot,
    colour,
    tone,
    bad: tone === 'has-violation',
    issues: [...posIssues.filter((i) => i.kind === 'violation'), ...posIssues.filter((i) => i.kind === 'flag')],
    unknowns: posIssues.filter((i) => i.kind === 'unknown'),
  };
}

function buildRowView(termEntry: SharedPlanTerm, allIssues: readonly SharedPlanIssue[], lang: Lang, planner: PlannerText): SharedRowView {
  const key = termKey(termEntry.term);
  const inTerm = allIssues.filter((i) => i.term !== null && termKey(i.term) === key);
  const wholeTerm = inTerm.filter((i) => i.position === null);
  const load = { term: termEntry.term, kind: termEntry.kind, credits: termEntry.credits, caps: termEntry.caps };
  return {
    key,
    name: termName(termEntry.term, lang),
    when: planner.termMonths(termEntry.term),
    summer: termEntry.kind === 'summer',
    credits: termEntry.credits,
    atLeast: wholeTerm.some((i) => i.code === 'load_not_checked'),
    maxCap: termEntry.caps?.max ?? null,
    capsLabel: termEntry.caps ? planner.caps(termEntry.caps.min, termEntry.caps.max) : planner.capsUnknown,
    meter: meter(load, termEntry.credits),
    cap: capOf(inTerm, termEntry.credits),
    tone: toneOf(inTerm),
    rowIssues: wholeTerm,
    tiles: termEntry.placements.map((placement, index) =>
      buildTileView(placement, inTerm.filter((i) => i.position === index), lang, planner),
    ),
  };
}

export const buildRowViews = (plan: SharedPlan, lang: Lang, planner: PlannerText): SharedRowView[] =>
  plan.terms.map((term) => buildRowView(term, plan.issues, lang, planner));

export function curriculumMeta(curriculum: SharedCurriculum, lang: Lang, sharing: SharingText): string {
  const programLabel = `${courseName(curriculum.program, lang)} (${curriculum.program.code})`;
  const curriculumName = courseName(curriculum, lang).trim();
  const parts = [programLabel, sharing.cohort(curriculum.cohortYear), sharing.curriculumCode(curriculum.code)];
  const lower = curriculumName.toLowerCase();
  const repeatsProgram = [curriculum.program.nameVi, curriculum.program.nameEn, curriculum.code]
    .filter((s): s is string => Boolean(s?.trim()))
    .some((s) => lower.includes(s.trim().toLowerCase()));
  if (curriculumName && !repeatsProgram) parts.push(curriculumName);
  return parts.join(' · ');
}

export const withheldTitles = (plan: SharedPlan, planner: PlannerText): string[] => plan.issueCodesNotShown.map((code) => planner.issueTitle[code]);

export function issueLists(issues: readonly SharedPlanIssue[]): IssueLists {
  const placed = issues.filter((i) => i.term !== null);
  const byKind = Object.fromEntries(ISSUE_KINDS_SHOWN.map((kind) => [kind, placed.filter((i) => i.kind === kind)])) as IssueLists['byKind'];
  return { byKind, listed: [...byKind.violation, ...byKind.flag], violationCount: byKind.violation.length };
}

export const orderedGroups = (coverage: SharedPlanCoverage): SharedGroupCoverage[] => orderGroups(coverage.groups);

export const shortCount = (coverage: SharedPlanCoverage): number =>
  [...coverage.groups, ...coverage.combinedMinimums].filter((g) => !g.met).length;
