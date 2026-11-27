import { CITATIONS, type CombinedMinimumCoverage, type CreditSummary, type GraduationCondition, type GraduationStatus, type GroupCoverage } from './types.js';

export const NOT_CHECKED_CONDITIONS: readonly GraduationCondition[] = [
  {
    id: 'no_prosecution_or_suspension',
    description: 'Not being prosecuted, and not serving a suspension, at the time of graduation review',
    citation: CITATIONS.noProsecution,
    status: 'not_checked',
  },
  {
    id: 'defence_education_certificate',
    description: 'The Giáo dục quốc phòng - An ninh certificate (passing the courses is checked with their group)',
    citation: CITATIONS.defenceEducation,
    status: 'not_checked',
  },
  {
    id: 'foreign_language_standard',
    description: "The school's foreign-language standard",
    citation: CITATIONS.foreignLanguage,
    status: 'not_checked',
  },
  {
    id: 'it_standard',
    description: 'The IT standard set by the curriculum',
    citation: CITATIONS.itStandard,
    status: 'not_checked',
  },
  {
    id: 'study_time_limit',
    description: 'Finishing within the maximum study time',
    citation: CITATIONS.studyTimeLimit,
    status: 'not_checked',
  },
];

const status = (met: boolean): GraduationCondition['status'] => (met ? 'met' : 'not_met');

export function graduationStatus(groups: readonly GroupCoverage[], combined: readonly CombinedMinimumCoverage[], credits: CreditSummary): GraduationStatus {
  const ruled = groups.filter((group) => group.kind === 'compulsory' || group.requiredCredits !== null);
  const conditions: GraduationCondition[] = [
    ...ruled.map((group) => ({
      id: `group:${group.id}`,
      description: `Requirement group "${group.name}"`,
      citation: CITATIONS.graduation,
      status: status(group.met),
    })),
    ...combined.map((minimum) => ({
      id: `combined:${minimum.id}`,
      description: `"${minimum.name}": at least ${minimum.creditsMin} credits across its groups`,
      citation: CITATIONS.graduation,
      status: status(minimum.met),
    })),
    credits.totalRequired === null
      ? { id: 'total_credits', description: 'The cohort total is not recorded', citation: CITATIONS.graduation, status: 'not_checked' as const }
      : {
          id: 'total_credits',
          description: `At least ${credits.totalRequired} credits toward the cohort total`,
          citation: CITATIONS.graduation,
          status: status(credits.towardTotal >= credits.totalRequired),
        },
    ...NOT_CHECKED_CONDITIONS,
  ];
  const met = conditions.filter((c) => c.status === 'met');
  const unmet = conditions.filter((c) => c.status === 'not_met');
  const notChecked = conditions.filter((c) => c.status === 'not_checked');
  return { status: unmet.length === 0 && credits.totalRequired !== null ? 'done' : 'not_yet', met, unmet, notChecked };
}
