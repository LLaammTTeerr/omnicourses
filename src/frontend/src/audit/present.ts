import { useAsyncLoad } from '../async-load.js';
import { useAuth } from '../auth/store.js';
import { groupColour, orderGroups } from '../curriculum/present.js';
import { GROUPS, type GroupId } from '../groups.js';
import { LANGUAGES, type Lang } from '../locale.js';
import { fetchAudit, type CourseCoverage, type DegreeAudit, type GraduationCondition, type GroupCoverage } from './api.js';
import type { AUDIT_MESSAGES } from './messages.js';

// How the dashboard and the audit page show the API's degree audit: colours, order, names and number formats.
// Presentation only. Whether a group is met, what remains and every credit and average are the rule engine's answer
// (AGENTS.md hard rule 1); nothing here adds, compares or decides one.

type Messages = (typeof AUDIT_MESSAGES)[Lang];

/** Loads the signed-in student's audit; the API works it out afresh on every call (ADR 0013). */
export function useAudit() {
  const auth = useAuth();
  return useAsyncLoad('the degree audit', () => auth.authed(fetchAudit));
}

export interface ShownGroup {
  group: GroupCoverage;
  colour: GroupId;
  glyph: string;
}

/** The audit's groups in the design's colour order, each with its colour and glyph (groups.ts). */
export function shownGroups(audit: DegreeAudit): ShownGroup[] {
  return orderGroups(audit.groups).map((group) => {
    const colour = groupColour(group);
    return { group, colour, glyph: GROUPS.find((g) => g.id === colour)!.glyph };
  });
}

/** The condition the API lists for a group, a combined minimum or the total, with its citation. */
export function conditionFor(audit: DegreeAudit, id: string): GraduationCondition | null {
  const { met, unmet, notChecked } = audit.graduation;
  return [...unmet, ...met, ...notChecked].find((condition) => condition.id === id) ?? null;
}

/** The names of the combined minimums a group adds to (the rule of a group with no minimum of its own). */
export function combinedNamesOf(audit: DegreeAudit, groupId: string): string[] {
  return audit.combinedMinimums.filter((combined) => combined.groupIds.includes(groupId)).map((combined) => combined.name);
}

export const groupName = (audit: DegreeAudit, id: string | null): string | null => audit.groups.find((group) => group.id === id)?.name ?? null;

/**
 * A condition in the screen's language. The API phrases them in English; the id says which one it is, so a known id
 * is named here from the audit's own data, and an id this screen does not know shows the API's description.
 */
export function conditionLabel(audit: DegreeAudit, condition: GraduationCondition, m: Messages): string {
  const [kind, id] = condition.id.split(/:(.*)/s);
  if (kind === 'group') return groupName(audit, id ?? null) ?? condition.description;
  if (kind === 'combined') {
    const combined = audit.combinedMinimums.find((c) => c.id === id);
    return combined ? m.combinedCondition(combined.name, combined.creditsMin) : condition.description;
  }
  if (condition.id === 'total_credits') return m.totalCondition(audit.credits.totalRequired);
  return m.conditions[condition.id] ?? condition.description;
}

/** Where a condition is explained on the audit page. */
export function conditionAnchor(condition: GraduationCondition): string {
  const [kind, id] = condition.id.split(/:(.*)/s);
  if (kind === 'group' || kind === 'combined') return `#${kind}-${id}`;
  return '#graduation';
}

/** The courses of a compulsory group the API does not report as passed or counted elsewhere: what is left to pass. */
export const notPassed = (group: GroupCoverage): CourseCoverage[] =>
  group.kind === 'compulsory' ? group.courses.filter((course) => course.status === 'not_taken' || course.status === 'failed' || course.status === 'in_progress') : [];

/** A share of a bar, for drawing only: 0 to 100. */
export function share(part: number, whole: number | null): number {
  if (!whole || whole <= 0) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}

/** A grade or an average as the language writes it, to two decimals at most: 7,5 or 7.5. */
export function formatScore(value: number | null, lang: Lang): string | null {
  return value === null ? null : new Intl.NumberFormat(LANGUAGES[lang].tag, { maximumFractionDigits: 2 }).format(value);
}

export const courseName = (course: Pick<CourseCoverage, 'nameVi' | 'nameEn'>, lang: Lang): string => (lang === 'en' && course.nameEn) || course.nameVi;
