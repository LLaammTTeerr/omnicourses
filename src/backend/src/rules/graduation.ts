// Graduation status (QĐ 1175/QĐ-KHTN Điều 17.3, ADR 0013). Pure functions. A condition the data
// cannot check is listed as not checked, never assumed met.
import type { CombinedMinimumCoverage, CreditSummary, GraduationCondition, GraduationStatus, GroupCoverage } from './audit-types.js';

const ARTICLE_17_3_B = 'QĐ 1175/QĐ-KHTN Điều 17.3.b';

/**
 * Conditions of Điều 17.3 (and the time limit of Điều 2.7) that nothing OmniCourse stores can
 * check. The degree audit lists them every time; the school checks them.
 */
export const NOT_CHECKED_CONDITIONS: readonly GraduationCondition[] = [
  {
    id: 'no_prosecution_or_suspension',
    description: 'Not being prosecuted, and not serving a suspension, at the time of graduation review',
    citation: 'QĐ 1175/QĐ-KHTN Điều 17.3.a',
    status: 'not_checked',
  },
  {
    id: 'defence_education_certificate',
    description: 'The Giáo dục quốc phòng - An ninh certificate (passing the courses is checked with their group)',
    citation: 'QĐ 1175/QĐ-KHTN Điều 17.3.c',
    status: 'not_checked',
  },
  {
    id: 'foreign_language_standard',
    description: "The school's foreign-language standard",
    citation: 'QĐ 1175/QĐ-KHTN Điều 17.3.d',
    status: 'not_checked',
  },
  {
    id: 'it_standard',
    description: 'The IT standard set by the curriculum',
    citation: 'QĐ 1175/QĐ-KHTN Điều 17.3.e',
    status: 'not_checked',
  },
  {
    id: 'study_time_limit',
    description: 'Finishing within the maximum study time',
    citation: 'QĐ 1175/QĐ-KHTN Điều 2.7',
    status: 'not_checked',
  },
];

const status = (met: boolean): GraduationCondition['status'] => (met ? 'met' : 'not_met');

/** Every condition: each group, each combined minimum, the cohort total, then the unchecked ones. */
export function graduationStatus(groups: readonly GroupCoverage[], combined: readonly CombinedMinimumCoverage[], credits: CreditSummary): GraduationStatus {
  const conditions: GraduationCondition[] = [
    ...groups.map((g) => ({
      id: `group:${g.id}`,
      description: `Requirement group "${g.name}"`,
      citation: ARTICLE_17_3_B,
      status: status(g.met),
    })),
    ...combined.map((m) => ({
      id: `combined:${m.id}`,
      description: `"${m.name}": at least ${m.creditsMin} credits across its groups`,
      citation: ARTICLE_17_3_B,
      status: status(m.met),
    })),
    credits.totalRequired === null
      ? { id: 'total_credits', description: 'The cohort total is not recorded', citation: ARTICLE_17_3_B, status: 'not_checked' as const }
      : {
          id: 'total_credits',
          description: `At least ${credits.totalRequired} credits toward the cohort total`,
          citation: ARTICLE_17_3_B,
          status: status(credits.towardTotal >= credits.totalRequired),
        },
    ...NOT_CHECKED_CONDITIONS,
  ];
  const met = conditions.filter((c) => c.status === 'met');
  const unmet = conditions.filter((c) => c.status === 'not_met');
  const notChecked = conditions.filter((c) => c.status === 'not_checked');
  return { status: unmet.length === 0 ? 'done' : 'not_yet', met, unmet, notChecked };
}
