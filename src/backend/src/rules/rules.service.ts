import { Injectable } from '@nestjs/common';
import { CourseRulesService } from '../curriculum/course-rules.service.js';
import { CurriculumRulesReader } from '../curriculum/curriculum-rules.reader.js';
import { CurriculumService } from '../curriculum/curriculum.service.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { courseCodesOf, type BoardTerm } from '../plans/plan-board.js';
import type { PlanIssuesProvider, PlanIssuesReport } from '../plans/plan-issues.js';
import type { PlanDto } from '../plans/plans.dto.js';
import { TranscriptService } from '../transcript/transcript.service.js';
import { degreeAudit } from './audit.js';
import type { DegreeAudit } from './audit-types.js';
import { checkTermLoad, creditCaps, termKind } from './credit-caps.js';
import { checkPlan } from './plan-issues.js';
import { checkOfferingTerm, checkPrerequisites } from './prerequisites.js';

export type AuditOutcome =
  | { status: 'ok'; audit: DegreeAudit }
  /** Onboarding is not finished, or names no program and cohort. */
  | { status: 'onboarding_required' }
  /** Onboarding names a program and cohort that have no curriculum. */
  | { status: 'curriculum_not_found'; programCode: string; cohortYear: number };

// The rule engine (ADR 0013): the only place OmniCourse decides an academic rule (AGENTS.md hard
// rule 1). This service loads the inputs; every rule is a pure function in this folder, also
// exposed here for other modules (the planner, the advisor's tools).
@Injectable()
export class RulesService implements PlanIssuesProvider {
  readonly termKind = termKind;
  readonly creditCaps = creditCaps;
  readonly checkTermLoad = checkTermLoad;
  readonly checkPrerequisites = checkPrerequisites;
  readonly checkOfferingTerm = checkOfferingTerm;
  readonly degreeAudit = degreeAudit;

  constructor(
    private readonly curriculum: CurriculumRulesReader,
    private readonly transcript: TranscriptService,
    private readonly onboarding: OnboardingService,
    private readonly courseRules: CourseRulesService,
    private readonly catalog: CurriculumService,
  ) {}

  /** The degree audit of the signed-in student: their onboarding program and cohort, their transcript. */
  async auditFor(userId: string): Promise<AuditOutcome> {
    const answers = await this.onboarding.answersFor(userId);
    if (!answers.finished || answers.program === null || answers.cohort === null) return { status: 'onboarding_required' };
    const [rules, entries] = await Promise.all([this.curriculum.rulesFor(answers.program, answers.cohort), this.transcript.rowsFor(userId)]);
    if (!rules) return { status: 'curriculum_not_found', programCode: answers.program, cohortYear: answers.cohort };
    return { status: 'ok', audit: degreeAudit(rules, entries) };
  }

  /**
   * The issues of one of the student's plans (PlanIssuesProvider, ADR 0014), against the plan's own
   * curriculum, never the onboarding one: a plan keeps the curriculum it was made against.
   */
  async issuesFor(userId: string, plan: PlanDto): Promise<PlanIssuesReport> {
    const [report] = await this.issuesForBoards(userId, plan, [plan.terms]);
    return report!;
  }

  async issuesForBoards(userId: string, plan: PlanDto, boards: readonly BoardTerm[][]): Promise<PlanIssuesReport[]> {
    const { id: curriculumId, programCode, cohortYear } = plan.curriculum;
    const [rules, courseRules, transcript, catalogCredits] = await Promise.all([
      this.curriculum.rulesFor(programCode, cohortYear),
      this.courseRules.rulesFor(curriculumId),
      this.transcript.rowsFor(userId),
      this.catalog.courseCredits([...new Set(boards.flatMap(courseCodesOf))]),
    ]);
    // ON DELETE RESTRICT keeps a plan's curriculum (ADR 0014), so this is a broken invariant.
    if (!rules) throw new Error(`The curriculum of plan ${plan.id} is missing`);
    return boards.map((terms) => checkPlan({ planId: plan.id, rules, courseRules, transcript, terms, catalogCredits }));
  }
}
