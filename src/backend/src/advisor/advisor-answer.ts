import { z } from 'zod';
import { ADVISOR_BADGE, type AdvisorLanguage, FIXED_REPLIES, PROMPT_VERSION } from './advisor-prompt.js';
import type { TurnEvidence } from './advisor-tools.js';
import { type EngineFact, renderFact } from './engine-facts.js';
import { type ExplanationReason, guardExplanation } from './explanation-guard.js';
import type { ClauseIndex, IndexedClause } from './retrieval/clause-index.js';

// The advisor's answer (ADR 0015, option A; Lâm, 12 Nov 2026). The model returns a JSON object that
// picks passages and engine facts by id and may add a short explanation. The server checks every id
// against this turn's evidence, shows each passage word for word and each fact in its own fixed
// wording, guards the explanation, and assembles typed segments. The only text the model writes that
// a student can see is an `explanation` segment, and it sits next to the badge.

export const REFUSALS = ['off_topic', 'cannot_act', 'no_disclosure', 'needs_consent', 'no_source'] as const;
export type Refusal = (typeof REFUSALS)[number];

export const MAX_PASSAGES = 5;
export const MAX_FACTS = 12;

/** What the model must return as its final message. Strict: an extra key fails the whole answer. */
export const ModelAnswerSchema = z.strictObject({
  refusal: z.enum(REFUSALS).nullable(),
  passageIds: z.array(z.string().max(120)).max(MAX_PASSAGES),
  engineFacts: z.array(z.string().max(120)).max(MAX_FACTS),
  explanation: z.string().max(4000).nullable(),
});
export type ModelAnswer = z.infer<typeof ModelAnswerSchema>;

/**
 * The model's final message as an answer, or undefined. Fail-closed: the whole message must be the
 * object (a json code fence around it is tolerated); prose around it, invalid JSON, a missing or
 * extra key, or a wrong type is no answer, and nothing of it is shown.
 */
export function parseModelAnswer(text: string): ModelAnswer | undefined {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*)\n```$/.exec(trimmed);
  const body = (fenced ? fenced[1] : trimmed).trim();
  if (!body.startsWith('{') || !body.endsWith('}')) return undefined;
  try {
    const parsed = ModelAnswerSchema.safeParse(JSON.parse(body));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export type SegmentKind = 'engine' | 'passage' | 'explanation' | 'notice';

export interface Citation {
  id: string;
  label: string;
  document: string;
  pages: number[];
}

export interface Segment {
  kind: SegmentKind;
  text: string;
  /** The passage a `passage` segment shows; null for the other kinds. */
  citation: Citation | null;
}

export type AdvisorOutcome = 'answered' | 'partial' | 'replaced' | 'off_topic' | 'needs_consent';

export type AnswerReason =
  | ExplanationReason
  | 'unparseable'
  | 'unknown_passage'
  | 'unknown_fact'
  | 'unanchored_explanation'
  /** The model called more tools than a turn allows (gateway `toolLimit`): the fallback is shown. */
  | 'tool_limit'
  /** The student withdrew consent during the call: facts from their record were dropped. */
  | 'consent_withdrawn'
  /** A `no_source` or `needs_consent` refusal next to what contradicts it: the notice was dropped. */
  | 'contradictory_refusal';

export interface AdvisorAnswer {
  outcome: AdvisorOutcome;
  segments: Segment[];
  /** Always shown with the answer (Lâm, 12 Nov). */
  badge: string;
  /** Fixed codes: why something was dropped. Never content. */
  reasons: AnswerReason[];
  promptVersion: string;
}

const REFUSAL_TEXT: Record<Refusal, keyof typeof FIXED_REPLIES> = {
  off_topic: 'offTopic',
  cannot_act: 'cannotAct',
  no_disclosure: 'noDisclosure',
  needs_consent: 'needsConsent',
  no_source: 'noSource',
};

export const notice = (text: string): Segment => ({ kind: 'notice', text, citation: null });

export function passageSegment(c: IndexedClause): Segment {
  return { kind: 'passage', text: c.text, citation: { id: c.id, label: c.label, document: c.documentShortName, pages: c.pages } };
}

export function answer(outcome: AdvisorOutcome, segments: Segment[], language: AdvisorLanguage, reasons: AnswerReason[] = []): AdvisorAnswer {
  return { outcome, segments, badge: ADVISOR_BADGE[language], reasons, promptVersion: PROMPT_VERSION };
}

export interface AssembleInput {
  /** The model's final message. */
  text: string;
  language: AdvisorLanguage;
  evidence: TurnEvidence;
  index: ClauseIndex;
  canary: string;
  instructions: string;
  toolNames: string[];
  /** Shown first: the redaction notice, when something was removed from the student's messages. */
  lead?: Segment[];
  /**
   * Whether the student has consented, read again after the model call: false drops every fact from
   * their record (consent withdrawn mid-call), and decides whether a `needs_consent` notice is true.
   */
  consented: boolean;
  /** The gateway ended the call at the tool-call cap: nothing the model picked is trusted. */
  toolLimit?: boolean;
}

/** A fact from the student's record or the rule engine's results on it; a catalogue fact is not one. */
export const isRecordFact = (f: EngineFact): boolean => f.kind !== 'course';
/** A part of the audit that reads differently without the audit's verdict beside it (J21, J22). */
const needsHeadline = (f: EngineFact): boolean => f.kind === 'record' || f.kind === 'record_course' || f.kind === 'credits' || f.kind === 'gpa';
/** The audit's verdict, or why there is none. */
const HEADLINE_IDS = ['audit:graduation', 'audit:unavailable'];

/**
 * The answer the student sees. A passage or fact id this turn did not produce is dropped, and so is
 * the explanation of an answer that named one (the model is then not trusted for prose). An
 * explanation is shown only beside a passage or a fact. With nothing left, the fixed "could not
 * check" reply and the passages retrieved for the question are shown.
 */
export function assembleAnswer(input: AssembleInput): AdvisorAnswer {
  const { language, evidence } = input;
  const lead = input.lead ?? [];
  const fallback = (reasons: AnswerReason[]) =>
    answer('replaced', [...lead, notice(FIXED_REPLIES.ungrounded[language]), ...[...evidence.clauses.values()].slice(0, MAX_PASSAGES).map(passageSegment)], language, reasons);

  if (input.toolLimit) return fallback(['tool_limit']);
  const model = parseModelAnswer(input.text);
  if (!model) return fallback(['unparseable']);

  const reasons = new Set<AnswerReason>();
  const passages = [...new Set(model.passageIds.map((id) => id.trim()))].flatMap((id) => {
    const clause = evidence.clauses.get(id);
    if (!clause) reasons.add('unknown_passage');
    return clause ? [clause] : [];
  });
  const factIds = [...new Set(model.engineFacts.map((id) => id.trim()))].filter((id) => {
    if (!evidence.facts.has(id)) reasons.add('unknown_fact');
    return evidence.facts.has(id);
  });
  // The engine's verdict goes with any part of the record: credits or passed courses alone would
  // read as "on track" next to a `not_yet` audit. Server policy, so no reason is recorded.
  const headline = HEADLINE_IDS.find((id) => evidence.facts.has(id));
  if (headline && !factIds.includes(headline) && factIds.some((id) => needsHeadline(evidence.facts.get(id)!))) factIds.unshift(headline);
  let facts = factIds.map((id) => evidence.facts.get(id)!);
  // Consent withdrawn while the model ran: what came from the record is not shown.
  if (!input.consented && facts.some(isRecordFact)) {
    facts = facts.filter((f) => !isRecordFact(f));
    reasons.add('consent_withdrawn');
  }

  let explanation: string | null = null;
  const tainted = reasons.size > 0;
  if (model.explanation !== null && model.explanation.trim()) {
    const verdict = guardExplanation({
      explanation: model.explanation,
      language,
      shownPassageIds: new Set(passages.map((p) => p.id)),
      index: input.index,
      canary: input.canary,
      instructions: input.instructions,
      toolNames: input.toolNames,
    });
    for (const r of verdict.reasons) reasons.add(r);
    if (verdict.text !== null && !tainted) {
      if (passages.length || facts.length) explanation = verdict.text;
      else reasons.add('unanchored_explanation');
    }
  }

  // A refusal notice never sits next to what contradicts it: "no passage answers this" beside a
  // passage or a fact, or "consent is needed" for a student who has consented or beside their record.
  // The checked passages and facts are kept; the notice is dropped.
  let refusal = model.refusal;
  const contradicted =
    (refusal === 'no_source' && (passages.length > 0 || facts.length > 0)) || (refusal === 'needs_consent' && (input.consented || facts.some(isRecordFact)));
  if (contradicted) {
    refusal = null;
    reasons.add('contradictory_refusal');
  }

  const segments: Segment[] = [...lead];
  if (refusal) segments.push(notice(FIXED_REPLIES[REFUSAL_TEXT[refusal]][language]));
  for (const f of facts) segments.push({ kind: 'engine', text: renderFact(f, language), citation: null });
  for (const p of passages) segments.push(passageSegment(p));
  if (explanation !== null) segments.push({ kind: 'explanation', text: explanation, citation: null });

  const shown = !!refusal || facts.length > 0 || passages.length > 0;
  if (!shown) return fallback([...reasons]);
  if (reasons.size && model.explanation !== null && explanation === null) segments.push(notice(FIXED_REPLIES.explanationWithheld[language]));
  return answer(reasons.size ? 'partial' : 'answered', segments, language, [...reasons]);
}
