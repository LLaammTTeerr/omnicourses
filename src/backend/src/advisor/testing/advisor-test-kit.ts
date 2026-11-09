import type { LlmService } from '../../ai/llm.service.js';
import type { AdvisorConsentService } from '../advisor-consent.service.js';
import { type AdvisorRecord, AuditSource, CourseSource, PlanIssuesSource, RecordSource, UnavailableAuditSource, UnavailablePlanIssuesSource } from '../advisor-sources.js';
import { type AdvisorEvent, AdvisorService } from '../advisor.service.js';
import { corpusIndex } from '../retrieval/regulation-corpus.js';

// Synthetic fixtures for advisor tests and the red-team suite. No real student anywhere
// (AGENTS.md hard rule 3): the record below was made up for these tests.

export const TEST_USER_ID = '00000000-0000-4000-8000-000000000001';
export const TEST_CANARY = 'OC-0123456789abcdef';

export const SYNTHETIC_RECORD: AdvisorRecord = {
  program: 'APCS',
  cohort: 2024,
  courses: [
    { code: 'CSC10001', credits: 4, result: 'graded', grade: 8.5, term: { year: 2024, number: 1 } },
    { code: 'MTH00003', credits: 3, result: 'graded', grade: 4.5, term: { year: 2024, number: 1 } },
    { code: 'CSC10002', credits: 4, result: 'in_progress', grade: null, term: { year: 2024, number: 2 } },
  ],
};

export const SYNTHETIC_COURSE = {
  code: 'CSC10001',
  nameVi: 'Nhập môn lập trình',
  nameEn: 'Introduction to Programming',
  credits: 4,
  memberships: [{ programCode: 'APCS', cohortYear: 2024, requirementGroupName: 'Core', kind: 'compulsory' }],
};

export class FixedRecordSource extends RecordSource {
  readonly calls: string[] = [];
  async recordFor(userId: string): Promise<AdvisorRecord> {
    this.calls.push(userId);
    return SYNTHETIC_RECORD;
  }
}

export class FixedCourseSource extends CourseSource {
  async find(code: string): Promise<unknown | null> {
    return code === SYNTHETIC_COURSE.code ? SYNTHETIC_COURSE : null;
  }
}

export interface KitOptions {
  llm: LlmService;
  consented?: boolean;
  audits?: AuditSource;
  planIssues?: PlanIssuesSource;
}

export function advisorFor({ llm, consented = true, audits, planIssues }: KitOptions): { advisor: AdvisorService; records: FixedRecordSource } {
  const consent = { hasConsented: async () => consented } as unknown as AdvisorConsentService;
  const records = new FixedRecordSource();
  const advisor = new AdvisorService(
    llm,
    consent,
    corpusIndex(),
    records,
    audits ?? new UnavailableAuditSource(),
    planIssues ?? new UnavailablePlanIssuesSource(),
    new FixedCourseSource(),
    () => TEST_CANARY,
  );
  return { advisor, records };
}

export async function collect(events: AsyncIterable<AdvisorEvent>): Promise<AdvisorEvent[]> {
  const out: AdvisorEvent[] = [];
  for await (const e of events) out.push(e);
  return out;
}

/** The final answer and outcome of a run. */
export function summary(events: AdvisorEvent[]) {
  const done = events.find((e) => e.type === 'done');
  const verdict = events.find((e) => e.type === 'verdict');
  const citations = events.find((e) => e.type === 'citations');
  return {
    text: done?.type === 'done' ? done.text : '',
    outcome: verdict?.type === 'verdict' ? verdict.outcome : undefined,
    reasons: verdict?.type === 'verdict' ? verdict.reasons : [],
    cited: citations?.type === 'citations' ? citations.clauses.map((c) => c.id) : [],
  };
}
