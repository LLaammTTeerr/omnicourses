import { Injectable } from '@nestjs/common';
import { CurriculumRulesReader } from '../curriculum/curriculum-rules.reader.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { TranscriptService } from '../transcript/transcript.service.js';
import { degreeAudit } from './audit.js';
import type { DegreeAudit } from './audit-types.js';
import { checkTermLoad, creditCaps, termKind } from './credit-caps.js';
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
export class RulesService {
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
  ) {}

  /** The degree audit of the signed-in student: their onboarding program and cohort, their transcript. */
  async auditFor(userId: string): Promise<AuditOutcome> {
    const answers = await this.onboarding.answersFor(userId);
    if (!answers.finished || answers.program === null || answers.cohort === null) return { status: 'onboarding_required' };
    const [rules, entries] = await Promise.all([this.curriculum.rulesFor(answers.program, answers.cohort), this.transcript.rowsFor(userId)]);
    if (!rules) return { status: 'curriculum_not_found', programCode: answers.program, cohortYear: answers.cohort };
    return { status: 'ok', audit: degreeAudit(rules, entries) };
  }
}
