import type { ChatMessage, LlmService } from '../../ai/llm.service.js';
import { type AdvisorAnswer, type ModelAnswer, type Refusal } from '../advisor-answer.js';
import { ADVISOR_BADGE, FIXED_REPLIES, REDACTION_NOTICE } from '../advisor-prompt.js';
import { auditFacts, courseFacts, planFacts, renderFact } from '../engine-facts.js';
import type { AdvisorConsentService } from '../advisor-consent.service.js';
import { type AdvisorRecord, AuditSource, CourseSource, PlanIssuesSource, RecordSource, UnavailableAuditSource, UnavailablePlanIssuesSource } from '../advisor-sources.js';
import { AdvisorService } from '../advisor.service.js';
import { corpusIndex } from '../retrieval/regulation-corpus.js';
import { gate } from '../topic-gate.js';

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

const index = corpusIndex();

/** One answer of the advisor to these messages. */
export function ask(advisor: AdvisorService, language: 'vi' | 'en', messages: ChatMessage[]): Promise<AdvisorAnswer> {
  return advisor.ask(TEST_USER_ID, { language, messages });
}

/** The parts of an answer a test reads. `explanation` is the only model-written text shown. */
export function summary(a: AdvisorAnswer) {
  const of = (kind: string) => a.segments.filter((s) => s.kind === kind);
  return {
    outcome: a.outcome,
    reasons: a.reasons,
    text: a.segments.map((s) => s.text).join('\n\n'),
    explanation: of('explanation')[0]?.text ?? null,
    notices: of('notice').map((s) => s.text),
    passages: of('passage').map((s) => s.citation!.id),
    facts: of('engine').map((s) => s.text),
  };
}

// ── The model's structured answer, as test scripts write it ──────────────────

const FIXED_TEXTS = (Object.entries(FIXED_REPLIES) as [keyof typeof FIXED_REPLIES, Record<'vi' | 'en', string>][]).flatMap(([key, t]) => [
  [key, t.vi],
  [key, t.en],
] as const);
const REFUSAL_OF: Partial<Record<keyof typeof FIXED_REPLIES, Refusal>> = {
  offTopic: 'off_topic',
  cannotAct: 'cannot_act',
  noDisclosure: 'no_disclosure',
  needsConsent: 'needs_consent',
  noSource: 'no_source',
};

/**
 * A free-text reply of the earlier red-team suites, re-expressed as the structured answer a model
 * that wrote it would now return (one mechanical rule, never tuned per case): its [[ids]] become
 * `passageIds` (real, fake or out of turn alike), a fixed reply it contains becomes `refusal`, and the
 * rest, word for word with its citation markers, becomes the `explanation`.
 */
export function structuredFrom(text: string, engineFacts: string[] = []): ModelAnswer {
  let rest = text;
  let refusal: Refusal | null = null;
  for (const [key, fixed] of FIXED_TEXTS) {
    if (!rest.includes(fixed)) continue;
    rest = rest.split(fixed).join(' ');
    refusal ??= REFUSAL_OF[key] ?? null;
  }
  const passageIds = [...new Set([...text.matchAll(/\[\[([^\]]{0,120})\]\]/g)].map((m) => m[1].trim()))].slice(0, 5);
  const explanation = rest.replace(/\s+/g, ' ').trim();
  return { refusal, passageIds, engineFacts, explanation: /\p{L}/u.test(explanation.replace(/\[\[[^\]]*\]\]/g, '')) ? explanation : null };
}

/** The model's final message for an answer. */
export const reply = (a: Partial<ModelAnswer>): { text: string } => ({
  text: JSON.stringify({ refusal: null, passageIds: [], engineFacts: [], explanation: null, ...a }),
});

/** The fact ids the synthetic tools return for these steps (what a faithful model may pick). */
export function factIdsFor(steps: { tool: string; args?: unknown }[] = [], audit: unknown = { engine: 'unavailable', reason: 'not connected' }): string[] {
  return steps.flatMap((s) => {
    if (s.tool === 'get_course') return courseFacts((s.args as { code?: string })?.code?.toUpperCase() === SYNTHETIC_COURSE.code ? SYNTHETIC_COURSE : null).map((f) => f.id);
    if (s.tool === 'get_my_audit') return auditFacts(SYNTHETIC_RECORD, audit).map((f) => f.id);
    if (s.tool === 'get_my_plan_issues') return ['plan:unavailable'];
    return [];
  });
}

/**
 * Search steps that put these passages in the turn's evidence, for ids the gate did not retrieve: the
 * scripted model searches a passage's own text, as a real model would search before picking it.
 */
export function stepsToReach(userTurns: string[], ids: string[], consented = true): { tool: string; args: unknown }[] {
  const hits = new Set(gate(index, userTurns, consented).hits.map((h) => h.clause.id));
  const steps: { tool: string; args: unknown }[] = [];
  for (const id of ids) {
    const clause = index.get(id);
    if (!clause || hits.has(id)) continue;
    const query = clause.text.replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!index.search(query, 5).hits.some((h) => h.clause.id === id)) continue;
    for (const h of index.search(query, 5).hits) hits.add(h.clause.id);
    steps.push({ tool: 'search_regulations', args: { query } });
  }
  return steps;
}

const FIXED_NOTICES = new Set([...Object.values(FIXED_REPLIES).flatMap((t) => [t.vi, t.en]), REDACTION_NOTICE.vi, REDACTION_NOTICE.en]);

/**
 * The structural promise of option A, checked on every answer of the suites: the only text the model
 * wrote is in `explanation` segments. A passage is a real passage, word for word; a fact is a server
 * template of the synthetic data; a notice is a fixed server text; the badge is the fixed badge.
 */
export function modelTextOutsideExplanation(a: AdvisorAnswer, language: 'vi' | 'en', audit?: unknown): string[] {
  const problems: string[] = [];
  const facts = new Set(
    [...courseFacts(SYNTHETIC_COURSE), ...auditFacts(SYNTHETIC_RECORD, { engine: 'unavailable', reason: 'x' }), ...(audit === undefined ? [] : auditFacts(SYNTHETIC_RECORD, audit)), ...planFacts({ engine: 'unavailable', reason: 'x' })].map((f) =>
      renderFact(f.fact, language),
    ),
  );
  if (a.badge !== ADVISOR_BADGE[language]) problems.push('badge');
  for (const s of a.segments) {
    if (s.kind === 'passage' && (!s.citation || index.get(s.citation.id)?.text !== s.text)) problems.push(`passage ${s.citation?.id}`);
    if (s.kind === 'engine' && !facts.has(s.text)) problems.push(`engine ${s.text.slice(0, 40)}`);
    if (s.kind === 'notice' && !FIXED_NOTICES.has(s.text)) problems.push(`notice ${s.text.slice(0, 40)}`);
    if (s.kind !== 'passage' && s.citation !== null) problems.push('citation');
  }
  if (a.segments.filter((s) => s.kind === 'explanation').length > 1) problems.push('two explanations');
  return problems;
}

/**
 * The same hostile answer from a model that knows the server's id checks: it keeps only passage ids
 * this turn produced (or picks the best retrieved one), drops every other [[id]] from its
 * explanation, and so is never caught by an id check. Only the explanation guard stands between its
 * explanation and the student.
 */
export function anchoredFrom(a: ModelAnswer, inTurn: Set<string>, fallbackId: string | undefined): ModelAnswer {
  const kept = a.passageIds.filter((id) => inTurn.has(id));
  const passageIds = kept.length ? kept : fallbackId ? [fallbackId] : [];
  const explanation = a.explanation?.replace(/\[\[([^\]]*)\]\]/g, (m, id: string) => (passageIds.includes(id.trim()) ? m : ' ')).replace(/\s+/g, ' ').trim() ?? null;
  return { ...a, passageIds, explanation: explanation || null };
}

export interface FaithfulInput {
  /** The free-text reply of the earlier suites. */
  legacy: string;
  userTurns: string[];
  consented: boolean;
  steps?: { tool: string; args: unknown }[];
  explanation: string | null;
  audit?: unknown;
}

/**
 * What a faithful model returns for a question of the earlier suites, and the scripted steps that
 * get it there: the passages its reply cited (or, with none, the two the gate retrieved, as the
 * blind explanations' writer was shown), the facts its tools returned, its fixed reply as the
 * refusal, and a blind explanation. Search steps are added for cited passages outside the gate's hits.
 */
export function faithfulAnswer(f: FaithfulInput): { answer: ModelAnswer; steps: { tool: string; args: unknown }[] } {
  const legacy = structuredFrom(f.legacy);
  const cited = legacy.passageIds.filter((id) => index.get(id));
  const passageIds = cited.length ? cited : gate(index, f.userTurns, f.consented).hits.slice(0, 2).map((h) => h.clause.id);
  const engineFacts = factIdsFor(f.steps, f.audit);
  const refusal = legacy.refusal ?? (!passageIds.length && !engineFacts.length ? 'no_source' : null);
  const own = f.steps ?? [];
  const steps = [...own.filter((s) => s.tool !== 'search_regulations'), ...own.filter((s) => s.tool === 'search_regulations'), ...stepsToReach(f.userTurns, passageIds, f.consented)];
  return { answer: { refusal, passageIds, engineFacts, explanation: f.explanation }, steps };
}
