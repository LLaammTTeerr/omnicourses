import { Injectable } from '@nestjs/common';
import { CatalogLookup } from '../curriculum/catalog-lookup.js';
import { CourseRulesService } from '../curriculum/course-rules.service.js';
import { CurriculumRulesReader } from '../curriculum/curriculum-rules.reader.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { TranscriptService } from '../transcript/transcript.service.js';
import { degreeAudit } from './audit.js';
import type { AuditUnavailableCode, DegreeAudit } from './audit-types.js';
import { courseCodesOf, type BoardTerm } from './inputs.js';
import type { PlanIssuesReport } from './plan-issue-types.js';
import { checkPlan } from './plan-issues.js';

export type AuditOutcome =
  | { status: 'ok'; audit: DegreeAudit }
  /** Onboarding is not finished, or names no program and cohort. */
  | { status: Extract<AuditUnavailableCode, 'onboarding_required'> }
  /** Onboarding names a program and cohort that have no curriculum. */
  | { status: Extract<AuditUnavailableCode, 'curriculum_not_found'>; programCode: string; cohortYear: number };

/** The plan a check is for: its id, and the curriculum it was made against (ADR 0014). */
export interface PlanRef {
  planId: string;
  curriculumId: string;
}

// The rule engine (ADR 0013): the only place OmniCourse decides an academic rule (AGENTS.md hard
// rule 1). This service loads the inputs; every rule is a pure function in this folder, which
// other modules (the planner, the advisor's tools) import directly. engine-imports.spec.ts keeps
// those files free of services and packages.
@Injectable()
export class RulesService {
  constructor(
    private readonly curriculum: CurriculumRulesReader,
    private readonly transcript: TranscriptService,
    private readonly onboarding: OnboardingService,
    private readonly courseRules: CourseRulesService,
    private readonly catalog: CatalogLookup,
  ) {}

  /** The degree audit of the signed-in student: their onboarding program and cohort, their transcript. */
  async auditFor(userId: string): Promise<AuditOutcome> {
    const program = await this.onboarding.programFor(userId);
    if (!program) return { status: 'onboarding_required' };
    const [rules, entries] = await Promise.all([this.curriculum.rulesFor(program.programCode, program.cohortYear), this.transcript.rowsFor(userId)]);
    if (!rules) return { status: 'curriculum_not_found', ...program };
    return { status: 'ok', audit: degreeAudit(rules, entries) };
  }

  /**
   * The issues of one board of a student's plan (ADR 0014), against the plan's own curriculum,
   * never the onboarding one: a plan keeps the curriculum it was made against. Never blocks saving (ADR 0012).
   */
  async issuesFor(userId: string, plan: PlanRef, terms: readonly BoardTerm[]): Promise<PlanIssuesReport> {
    const [report] = await this.issuesForBoards(userId, plan, [terms]);
    return report!;
  }

  /** The same check on several boards of one plan, the inputs read once: the planner's drag preview. */
  async issuesForBoards(userId: string, plan: PlanRef, boards: readonly (readonly BoardTerm[])[]): Promise<PlanIssuesReport[]> {
    const [rules, courseRules, transcript, catalogCredits] = await Promise.all([
      this.curriculum.rulesForId(plan.curriculumId),
      this.courseRules.rulesFor(plan.curriculumId),
      this.transcript.rowsFor(userId),
      this.catalog.courseCredits([...new Set(boards.flatMap(courseCodesOf))]),
    ]);
    // ON DELETE RESTRICT keeps a plan's curriculum (ADR 0014), so this is a broken invariant.
    if (!rules) throw new Error(`The curriculum of plan ${plan.planId} is missing`);
    return boards.map((terms) => checkPlan({ planId: plan.planId, rules, courseRules, transcript, terms, catalogCredits }));
  }
}
