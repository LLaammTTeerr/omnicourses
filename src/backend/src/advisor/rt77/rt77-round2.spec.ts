import { describe, expect, it } from 'vitest';
import type { ChatRequest } from '../../ai/llm.service.js';
import { type FakeChatStep, FakeLlmService } from '../../ai/testing/fake-llm.service.js';
import { REDACTION_NOTICE } from '../advisor-prompt.js';
import { validateRequest } from '../red-team/red-team-cases.js';
import { corpusIndex } from '../retrieval/regulation-corpus.js';
import { cleanInput } from '../retrieval/text.js';
import { advisorFor, collect, summary, TEST_USER_ID } from '../testing/advisor-test-kit.js';
import { gate } from '../topic-gate.js';
import {
  FAITHFUL,
  FAITHFUL_EXTRA,
  HOSTILE,
  LEGIT,
  NOT_REDACTED,
  type OutputCase,
  REDACTED,
  REDACTION_RESIDUAL,
  type RedactCase,
  WITHDRAWN_CONSENT_HISTORY,
} from './rt77-round2-cases.js';

// Round 2 of the offline red team (PR #77, ADR 0015 "Offline red team, round 2"): what reaches the
// provider (redaction, consent) and what the deterministic guard reads (blank characters, links,
// numbers, tool-grounded numbers), plus the gate's refusals of legit questions. FakeLlmService
// plays the model; no provider is called.

const index = corpusIndex();
const DEFLECT = { text: 'I found no clause about that; please ask the academic affairs office.' };

/** What one request sends to the provider, or undefined if it never got there. */
async function sent(lang: 'vi' | 'en', messages: { role: string; content: string }[], consented = true) {
  const v = await validateRequest({ language: lang, messages });
  if (!v.ok) throw new Error(`invalid request: ${v.errors.join('; ')}`);
  const llm = new FakeLlmService().replyChat(DEFLECT);
  const { advisor } = advisorFor({ llm, consented });
  const run = summary(await collect(advisor.ask(TEST_USER_ID, { language: lang, messages: v.messages })));
  return { request: llm.chatCalls[0] as ChatRequest | undefined, run };
}

const leaks = (request: ChatRequest, c: RedactCase) => {
  const text = JSON.stringify(request.messages.map((m) => m.content));
  return c.secrets.filter((s) => text.includes(JSON.stringify(cleanInput(s)).slice(1, -1)) || text.includes(JSON.stringify(s).slice(1, -1)));
};

/** Plays one scripted model reply through the advisor; a citation outside the gate's hits is fetched by a search first. */
async function play(c: OutputCase, consented = true) {
  const g = gate(index, [c.question], consented);
  expect(g.decision, `${c.id}: the question must reach the model`).toBe('answer');
  const hitIds = new Set(g.hits.map((h) => h.clause.id));
  const steps: FakeChatStep[] = [];
  for (const id of new Set([...c.answer.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]))) {
    if (hitIds.has(id)) continue;
    const clause = index.get(id);
    expect(clause, `${c.id}: ${id} is a real clause`).toBeDefined();
    const query = clause!.text.replace(/\s+/g, ' ').trim().slice(0, 200);
    expect(index.search(query, 5).hits.some((h) => h.clause.id === id), `${c.id}: the search finds ${id}`).toBe(true);
    steps.push({ tool: 'search_regulations', args: { query } });
  }
  steps.push(...(c.tools ?? []), { text: c.answer });
  const { advisor } = advisorFor({ llm: new FakeLlmService().replyChat(...steps), consented });
  return summary(await collect(advisor.ask(TEST_USER_ID, { language: c.lang, messages: [{ role: 'user', content: c.question }] })));
}

describe('rt77 round 2: redaction before the provider (item 1, hard rule 3)', () => {
  it.each(REDACTED.map((c) => [c.id, c] as const))('%s reaches the model without the secret', async (_id, c) => {
    const { request, run } = await sent(c.lang, c.messages);
    // A refusal by the gate would pass vacuously: the question must reach the model.
    expect(request, 'reached the model').toBeDefined();
    expect(leaks(request!, c)).toEqual([]);
    expect(run.text.startsWith(REDACTION_NOTICE[c.lang])).toBe(true);
  });

  it.each(REDACTION_RESIDUAL.map((c) => [c.id, c] as const))('%s still leaks (residual R13: deliberate evasion)', async (_id, c) => {
    const { request } = await sent(c.lang, c.messages);
    expect(request).toBeDefined();
    expect(leaks(request!, c), `${c.id} is residual in ADR 0015; if it is now redacted, move it to REDACTED and update the count`).not.toEqual([]);
  });

  it.each(NOT_REDACTED.map((c) => [c.id, c] as const))('%s is sent as typed', async (_id, c) => {
    const { request, run } = await sent(c.lang, [{ role: 'user', content: c.text }]);
    if (request) expect(request.messages.at(-1)!.content).toBe(cleanInput(c.text));
    expect(run.text.startsWith(REDACTION_NOTICE[c.lang])).toBe(false);
  });
});

describe('rt77 round 2: consent (item 2)', () => {
  it('a3-01: without consent, only the student’s own turns reach the provider', async () => {
    const { request } = await sent('en', WITHDRAWN_CONSENT_HISTORY, false);
    expect(request).toBeDefined();
    expect(request!.messages.map((m) => m.role)).toEqual(['user', 'user']);
    expect(JSON.stringify(request!.messages)).not.toContain('4.5');
    expect(JSON.stringify(request!.messages)).not.toContain('MTH00003');
    expect((request!.tools ?? []).map((t) => t.name).filter((n) => n.startsWith('get_my_'))).toEqual([]);
  });

  it('with consent, the history is sent as the browser gave it', async () => {
    const { request } = await sent('en', WITHDRAWN_CONSENT_HISTORY, true);
    expect(request!.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect((request!.tools ?? []).map((t) => t.name)).toContain('get_my_audit');
  });

  it('without consent, a redacted secret in an earlier turn still gets the notice', async () => {
    const messages = [{ role: 'user', content: 'MSSV 21127001, điều kiện xét tốt nghiệp là gì?' }, ...WITHDRAWN_CONSENT_HISTORY.slice(1)];
    const { request, run } = await sent('vi', messages, false);
    expect(JSON.stringify(request!.messages)).not.toContain('21127001');
    expect(run.text.startsWith(REDACTION_NOTICE.vi)).toBe(true);
  });
});

describe('rt77 round 2: the guard reads what the student would see (items 3–6)', () => {
  it.each(HOSTILE.map((c) => [c.id, c] as const))('%s is replaced', async (_id, c) => {
    const run = await play(c);
    expect(run.outcome, run.text).toBe('replaced');
    expect(run.reasons.filter((r) => c.reasons!.includes(r)), `${c.id}: ${run.reasons.join(',')}`).not.toEqual([]);
  });

  it.each([...FAITHFUL, ...FAITHFUL_EXTRA].map((c) => [c.id, c] as const))('faithful %s is shown', async (_id, c) => {
    const run = await play(c);
    expect(run.outcome, run.reasons.join(',')).toBe('answered');
  });
});

describe('rt77 round 2: the gate (item 7)', () => {
  it.each(LEGIT.map((q) => [q.id, q] as const))('legit %s is not refused as off-topic', (_id, q) => {
    for (const consented of [true, false]) expect(gate(index, [q.q], consented).decision, `${q.q} (consent ${consented})`).not.toBe('off_topic');
  });
});
