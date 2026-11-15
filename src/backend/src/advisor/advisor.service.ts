import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { AI_REASONS, AiUnavailableError } from '../ai/ai-unavailable.error.js';
import type { ChatMessage } from '../ai/llm.service.js';
import { LlmService } from '../ai/llm.service.js';
import { AdvisorConsentService } from './advisor-consent.service.js';
import { type AdvisorAnswer, answer, assembleAnswer, notice, type Segment } from './advisor-answer.js';
import { type AdvisorLanguage, buildInstructions, FIXED_REPLIES, REDACTION_NOTICE } from './advisor-prompt.js';
import { AuditSource, CourseSource, PlanIssuesSource, RecordSource } from './advisor-sources.js';
import { advisorTools, TurnEvidence } from './advisor-tools.js';
import { redactPersonalData } from './redaction.js';
import type { ClauseIndex } from './retrieval/clause-index.js';
import { cleanInput } from './retrieval/text.js';
import { gate } from './topic-gate.js';

export const CLAUSE_INDEX = Symbol('CLAUSE_INDEX');
/** Makes the per-request internal marker; tests pass a fixed one. */
export const ADVISOR_CANARY = Symbol('ADVISOR_CANARY');
/**
 * Tool calls per question (ADR 0016, R18): a faithful answer needs at most a few searches, the audit
 * and a course or two. Past it the gateway ends the call and the student gets the fallback.
 */
export const ADVISOR_MAX_TOOL_CALLS = 8;

export interface AskInput {
  language: AdvisorLanguage;
  messages: ChatMessage[];
}

// F8 advisor (UC-08, ADR 0016): topic gate → prompt with retrieved clauses → gateway chat with
// read-only tools → the model's JSON answer → ids checked, passages and facts rendered by the server,
// explanation guarded. Conversation content is never stored or logged.
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
   * One answer. Nothing the model writes reaches the student until the whole answer is checked, so
   * there is nothing to stream: the route answers JSON. A gateway failure throws AiUnavailableError
   * (503 `ai_unavailable`). An aborted signal (the student closed the tab) stops the model call.
   */
  async ask(userId: string, input: AskInput, signal?: AbortSignal): Promise<AdvisorAnswer> {
    const { language } = input;
    // Passwords, student IDs, emails, phones and birth dates never reach the provider (hard rule 3),
    // in the question or in the history the browser sends back.
    const redacted = input.messages.map((m) => redactPersonalData(cleanInput(m.content)));
    const lead: Segment[] = redacted.some((r) => r.redacted) ? [notice(REDACTION_NOTICE[language])] : [];
    const consented = await this.consent.hasConsented(userId);
    // Without consent (never given, or withdrawn mid-conversation) the provider gets only the
    // student's own turns: an earlier answer may quote their record (grades, courses), which may
    // leave the server only with consent (ADR 0003, ADR 0016).
    const messages: ChatMessage[] = input.messages
      .map((m, i) => ({ role: m.role, content: redacted[i].text }))
      .filter((m) => consented || m.role === 'user');
    const decision = gate(
      this.index,
      messages.filter((m) => m.role === 'user').map((m) => m.content),
      consented,
    );
    if (decision.decision === 'off_topic') return answer('off_topic', [...lead, notice(FIXED_REPLIES.offTopic[language])], language);
    if (decision.decision === 'needs_consent') return answer('needs_consent', [...lead, notice(FIXED_REPLIES.needsConsent[language])], language);

    const evidence = new TurnEvidence();
    evidence.addClauses(decision.hits.map((h) => h.clause));
    const canary = this.makeCanary();
    const instructions = buildInstructions({ language, consented, clauses: [...evidence.clauses.values()], canary });
    const stillConsented = () => this.consent.hasConsented(userId);
    const tools = advisorTools(
      { index: this.index, records: this.records, audits: this.audits, planIssues: this.planIssues, courses: this.courses },
      userId,
      consented,
      evidence,
      stillConsented,
    );

    let text = '';
    // Text deltas are dropped: only the final message is read, and only as a JSON answer.
    const events = this.llm.chat({ context: { userId, feature: 'advisor' }, instructions, messages, tools, maxToolCalls: ADVISOR_MAX_TOOL_CALLS })[Symbol.asyncIterator]();
    // A closed tab ends the model request at its next event, even inside a long tool turn (an async
    // generator queues return() behind the pending next()). The call still counts toward the cap (ADR 0003).
    const stop = () => void events.return?.()?.catch(() => undefined);
    signal?.addEventListener('abort', stop, { once: true });
    let toolLimit = false;
    try {
      if (signal?.aborted) stop();
      for (let r = await events.next(); !r.done && !signal?.aborted; r = await events.next()) if (r.value.type === 'done') text = r.value.text;
    } catch (error) {
      // A tool loop is the model's fault, not an outage: the student gets the safe fallback, and the
      // call still counts (the gateway does not release it). Every other failure stays a 503.
      if (!(error instanceof AiUnavailableError && error.reason === AI_REASONS.toolLimit)) throw error;
      toolLimit = true;
    } finally {
      signal?.removeEventListener('abort', stop);
    }
    if (signal?.aborted) text = '';
    // Read again: consent withdrawn while the model ran drops the record's facts (J35).
    const stillConsentedNow = consented && (await stillConsented());
    const result = assembleAnswer({
      text,
      language,
      evidence,
      index: this.index,
      canary,
      instructions,
      toolNames: tools.map((t) => t.name),
      lead,
      consented: stillConsentedNow,
      toolLimit,
    });
    // Fixed codes only, never the answer (AGENTS.md hard rule 3).
    if (result.reasons.length) this.logger.warn(`Advisor answer ${result.outcome}: ${result.reasons.join(',')}`);
    return result;
  }
}
