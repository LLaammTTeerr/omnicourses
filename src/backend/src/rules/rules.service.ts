import { Injectable } from '@nestjs/common';
import { CurriculumRulesReader } from '../curriculum/curriculum-rules.reader.js';
import { CurriculumService } from '../curriculum/curriculum.service.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { TranscriptService } from '../transcript/transcript.service.js';
import { degreeAudit } from './audit.js';
import { checkPlan, courseCodesOf } from './plan-issues.js';
import type { AuditOutcome, BoardTerm, PlanIssuesReport, PlanUnderCheck } from './types.js';

@Injectable()
export class RulesService {
  constructor(
    private readonly curriculum: CurriculumRulesReader,
    private readonly transcript: TranscriptService,
    private readonly onboarding: OnboardingService,
    private readonly catalog: CurriculumService,
  ) {}

  async auditFor(userId: string): Promise<AuditOutcome> {
    const cohort = await this.onboarding.cohortOf(userId);
    if (!cohort) return { status: 'onboarding_required' };
    const curriculumId = await this.catalog.findCurriculumId(cohort.programCode, cohort.cohortYear);
    const [rules, entries] = await Promise.all([curriculumId === null ? null : this.curriculum.rulesFor(curriculumId), this.transcript.rowsFor(userId)]);
    if (!rules) return { status: 'curriculum_not_found', ...cohort };
    return { status: 'ok', audit: degreeAudit(rules, entries) };
  }

  async issuesFor(plan: PlanUnderCheck, userId: string | null): Promise<PlanIssuesReport> {
    const [report] = await this.issuesForBoards(plan, [plan.terms], userId);
    return report!;
  }

  async issuesForBoards(plan: PlanUnderCheck, boards: readonly (readonly BoardTerm[])[], userId: string | null): Promise<PlanIssuesReport[]> {
    const [rules, transcript, catalog] = await Promise.all([
      this.curriculum.rulesFor(plan.curriculum.id),
      userId === null ? [] : this.transcript.rowsFor(userId),
      this.catalog.catalogCourses(boards.flatMap(courseCodesOf)),
    ]);
    if (!rules) throw new Error(`The curriculum of plan ${plan.id} is missing`);
    const catalogCredits = new Map([...catalog].map(([code, course]) => [code, course.credits]));
    return boards.map((terms) => checkPlan({ planId: plan.id, rules, transcript, terms, catalogCredits }));
  }
}
