import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { ChatMessage } from '../ai/llm.service.js';
import { LlmService } from '../ai/llm.service.js';
import { AdvisorConsentService } from './advisor-consent.service.js';
import { type AdvisorLanguage, buildInstructions, FIXED_REPLIES, PROMPT_VERSION, REDACTION_NOTICE } from './advisor-prompt.js';
import { AuditSource, CourseSource, PlanIssuesSource, RecordSource } from './advisor-sources.js';
import { advisorTools, TurnEvidence } from './advisor-tools.js';
import { guardAnswer, type GuardReason } from './output-guard.js';
import { redactPersonalData } from './redaction.js';
import type { ClauseIndex, IndexedClause } from './retrieval/clause-index.js';
import { cleanInput } from './retrieval/text.js';
import { gate } from './topic-gate.js';

export const CLAUSE_INDEX = Symbol('CLAUSE_INDEX');
/** Makes the per-request internal marker; tests pass a fixed one. */
export const ADVISOR_CANARY = Symbol('ADVISOR_CANARY');

/** How the answer came about, sent after it (ADR 0015). Never content: reasons are fixed codes. */
export type AdvisorOutcome = 'answered' | 'replaced' | 'off_topic' | 'needs_consent';

export type AdvisorEvent =
  /** A tool started; its arguments stay on the server. */
  | { type: 'tool_call'; name: string }
  | { type: 'tool_result'; name: string; ok: boolean }
  /** The vetted answer, in pieces. */
  | { type: 'text'; delta: string }
  /** The clauses to show as links, with their exact text (UC-08 step 8). */
  | { type: 'citations'; clauses: { id: string; label: string; document: string; text: string }[] }
  | { type: 'verdict'; outcome: AdvisorOutcome; reasons: GuardReason[]; promptVersion: string }
  | { type: 'done'; text: string };

export interface AskInput {
  language: AdvisorLanguage;
  messages: ChatMessage[];
}

// F8 advisor (UC-08, ADR 0015): topic gate → prompt with retrieved clauses → gateway chat with
// read-only tools → output guard → the vetted answer. Conversation content is never stored or logged.
@Injectable()
export class AdvisorService {
  private readonly logger = new Logger(AdvisorService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly consent: AdvisorConsentService,
    @Inject(CLAUSE_INDEX) private readonly index: ClauseIndex,
    private readonly records: RecordSource,
    private readonly audits: AuditSource,
    private readonly planIssues: PlanIssuesSource,
    private readonly courses: CourseSource,
    @Optional() @Inject(ADVISOR_CANARY) private readonly makeCanary: () => string = () => `OC-${randomBytes(8).toString('hex')}`,
  ) {}

  /**
   * The events of one answer. The model's text is held back until the guard has read all of it, so
   * nothing unvetted reaches the student; tool progress streams as it happens. A failure before the
   * first event is thrown (503 `ai_unavailable` via streamChat).
   */
  async *ask(userId: string, input: AskInput): AsyncGenerator<AdvisorEvent> {
    const { language } = input;
    // Passwords, student IDs, emails, phones and birth dates never reach the provider (hard rule 3),
    // in the question or in the history the browser sends back.
    const redacted = input.messages.map((m) => redactPersonalData(cleanInput(m.content)));
    const messages: ChatMessage[] = input.messages.map((m, i) => ({ role: m.role, content: redacted[i].text }));
    const notice = redacted.some((r) => r.redacted) ? REDACTION_NOTICE[language] : undefined;
    const consented = await this.consent.hasConsented(userId);
    const decision = gate(
      this.index,
      messages.filter((m) => m.role === 'user').map((m) => m.content),
      consented,
    );
    if (decision.decision === 'off_topic') {
      yield* this.reply(FIXED_REPLIES.offTopic[language], 'off_topic', [], [], notice);
      return;
    }
    if (decision.decision === 'needs_consent') {
      yield* this.reply(FIXED_REPLIES.needsConsent[language], 'needs_consent', [], [], notice);
      return;
    }

    const clauses = decision.hits.map((h) => h.clause);
    const evidence = new TurnEvidence();
    evidence.addClauses(clauses);
    const canary = this.makeCanary();
    const instructions = buildInstructions({ language, consented, clauses, canary });
    const tools = advisorTools({ index: this.index, records: this.records, audits: this.audits, planIssues: this.planIssues, courses: this.courses }, userId, consented, evidence);

    let answer = '';
    for await (const event of this.llm.chat({ context: { userId, feature: 'advisor' }, instructions, messages, tools })) {
      if (event.type === 'tool_call') yield { type: 'tool_call', name: event.name };
      else if (event.type === 'tool_result') yield event;
      else if (event.type === 'done') answer = event.text;
      // `text` deltas are dropped: the guard must read the whole answer first (ADR 0015).
    }
    const verdict = guardAnswer({ answer, language, evidence, index: this.index, canary, instructions, toolNames: tools.map((t) => t.name) });
    // Fixed codes only, never the answer (AGENTS.md hard rule 3).
    if (verdict.status === 'replaced') this.logger.warn(`Advisor answer replaced: ${verdict.reasons.join(',')}`);
    yield* this.reply(verdict.text, verdict.status === 'passed' ? 'answered' : 'replaced', verdict.reasons, verdict.citations, notice);
  }

  /** The vetted events of one answer, after the redaction notice if something was removed. */
  private *reply(answer: string, outcome: AdvisorOutcome, reasons: GuardReason[], citations: IndexedClause[], notice?: string): Generator<AdvisorEvent> {
    const text = notice ? `${notice}\n\n${answer}` : answer;
    for (const delta of text.split(/(?<= )/)) yield { type: 'text', delta };
    yield {
      type: 'citations',
      clauses: citations.map((c) => ({ id: c.id, label: c.label, document: c.documentShortName, text: c.text })),
    };
    yield { type: 'verdict', outcome, reasons, promptVersion: PROMPT_VERSION };
    yield { type: 'done', text };
  }
}
