import { computed } from 'vue';
import { useAsyncLoad } from '../async-load.js';
import { groupColour, orderGroups } from '../curriculum/present.js';
import { GROUPS, type GroupId } from '../groups.js';
import { LANGUAGES, type Lang } from '../locale.js';
import { fetchAudit, type AuditOutcome, type CourseStatus, type DegreeAudit, type GraduationCondition, type GroupCoverage } from './api.js';
import type { AUDIT_MESSAGES } from './messages.js';

type Messages = (typeof AUDIT_MESSAGES)[Lang];

export const readyAudit = (outcome: AuditOutcome | null): DegreeAudit | null => (outcome?.status === 'ready' ? outcome.audit : null);

export function useAudit() {
  const load = useAsyncLoad('the degree audit', () => fetchAudit());
  return { ...load, audit: computed(() => readyAudit(load.data.value)) };
}

export interface ShownGroup {
  group: GroupCoverage;
  colour: GroupId;
  glyph: string;
}

export function shownGroups(audit: DegreeAudit): ShownGroup[] {
  return orderGroups(audit.groups).map((group) => {
    const colour = groupColour(group);
    return { group, colour, glyph: GROUPS.find((g) => g.id === colour)!.glyph };
  });
}

export function conditionFor(audit: DegreeAudit, id: string): GraduationCondition | null {
  const { met, unmet, notChecked } = audit.graduation;
  return [...unmet, ...met, ...notChecked].find((condition) => condition.id === id) ?? null;
}

export function combinedNamesOf(audit: DegreeAudit, groupId: string): string[] {
  return audit.combinedMinimums.filter((combined) => combined.groupIds.includes(groupId)).map((combined) => combined.name);
}

export const groupName = (audit: DegreeAudit, id: string | null): string | null => audit.groups.find((group) => group.id === id)?.name ?? null;

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

export function conditionAnchor(condition: GraduationCondition): string {
  const [kind, id] = condition.id.split(/:(.*)/s);
  if (kind === 'group' || kind === 'combined') return `#${kind}-${id}`;
  return '#graduation';
}

export const withoutOwnCondition = (audit: DegreeAudit, group: GroupCoverage): boolean => conditionFor(audit, `group:${group.id}`) === null;

const NOT_PASSED: readonly CourseStatus[] = ['not_taken', 'failed', 'in_progress'];

export function notPassedByStatus(group: GroupCoverage): { status: CourseStatus; codes: string[] }[] {
  if (group.kind !== 'compulsory') return [];
  return NOT_PASSED.map((status) => ({ status, codes: group.courses.filter((course) => course.status === status).map((course) => course.code) })).filter(
    (bucket) => bucket.codes.length > 0,
  );
}

export function share(part: number, whole: number | null): number {
  if (!whole || whole <= 0) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}

const scoreFormats = new Map<Lang, Intl.NumberFormat>();

export function formatScore(value: number | null, lang: Lang): string | null {
  if (value === null) return null;
  let format = scoreFormats.get(lang);
  if (!format) scoreFormats.set(lang, (format = new Intl.NumberFormat(LANGUAGES[lang].tag, { maximumFractionDigits: 2 })));
  return format.format(value);
}

