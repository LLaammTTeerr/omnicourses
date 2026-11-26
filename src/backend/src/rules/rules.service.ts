import { Injectable } from '@nestjs/common';
import { CurriculumRulesReader } from '../curriculum/curriculum-rules.reader.js';
import { CurriculumService } from '../curriculum/curriculum.service.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { TranscriptService } from '../transcript/transcript.service.js';
import { degreeAudit } from './audit.js';
import { checkPlan, courseCodesOf } from './plan-issues.js';
import type { BoardTerm, DegreeAudit, PlanIssuesReport, PlanUnderCheck } from './types.js';

export type AuditOutcome =
  | { status: 'ok'; audit: DegreeAudit }
  /** Onboarding is not finished, or names no program and cohort. */
  | { status: 'onboarding_required' }
  /** Onboarding names a program and cohort that have no curriculum. */
  | { status: 'curriculum_not_found'; programCode: string; cohortYear: number };

export const AUDIT_UNAVAILABLE_CODES = ['onboarding_required', 'curriculum_not_found'] as const satisfies readonly AuditOutcome['status'][];

// The rule engine (ADR 0013): the only place OmniCourse decides an academic rule (AGENTS.md hard
// rule 1). This service loads the inputs; every rule is a pure function in this folder.
@Injectable()
export class RulesService {
  constructor(
    private readonly curriculum: CurriculumRulesReader,
    private readonly transcript: TranscriptService,
    private readonly onboarding: OnboardingService,
    private readonly catalog: CurriculumService,
  ) {}

  /** The degree audit of the signed-in student: their onboarding program and cohort, their transcript. */
  async auditFor(userId: string): Promise<AuditOutcome> {
    const cohort = await this.onboarding.cohortOf(userId);
    if (!cohort) return { status: 'onboarding_required' };
    const curriculumId = await this.catalog.findCurriculumId(cohort.programCode, cohort.cohortYear);
    const [rules, entries] = await Promise.all([curriculumId === null ? null : this.curriculum.rulesFor(curriculumId), this.transcript.rowsFor(userId)]);
    if (!rules) return { status: 'curriculum_not_found', ...cohort };
    return { status: 'ok', audit: degreeAudit(rules, entries) };
  }

  /**
   * The issues of one of the student's plans (ADR 0014), against the plan's own curriculum, never
   * the onboarding one: a plan keeps the curriculum it was made against. Never blocks saving (ADR 0012).
   *
   * With `userId` null, the same check with an empty transcript, which is never read: no student is named. For a caller
   * that shows only what the plan and its curriculum say (a shared plan whose owner did not choose
   * to show the transcript's checks, ADR 0010). What the report says of prerequisites met, courses
   * already passed or in progress and coverage is then nobody's, and must not be shown.
   */
  async issuesFor(plan: PlanUnderCheck, userId: string | null): Promise<PlanIssuesReport> {
    const [report] = await this.issuesForBoards(plan, [plan.terms], userId);
    return report!;
  }

  /** The same check on several boards of one plan, the inputs read once: the planner's drag preview. */
  async issuesForBoards(plan: PlanUnderCheck, boards: readonly (readonly BoardTerm[])[], userId: string | null): Promise<PlanIssuesReport[]> {
    const [rules, transcript, catalog] = await Promise.all([
      this.curriculum.rulesFor(plan.curriculum.id),
      userId === null ? [] : this.transcript.rowsFor(userId),
      this.catalog.catalogCourses(boards.flatMap(courseCodesOf)),
    ]);
    // ON DELETE RESTRICT keeps a plan's curriculum (ADR 0014), so this is a broken invariant.
    if (!rules) throw new Error(`The curriculum of plan ${plan.id} is missing`);
    const catalogCredits = new Map([...catalog].map(([code, course]) => [code, course.credits]));
    return boards.map((terms) => checkPlan({ planId: plan.id, rules, transcript, terms, catalogCredits }));
  }
}
