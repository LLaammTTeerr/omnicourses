import { describe, expect, it } from 'vitest';
import type { ChatRequest } from '../../ai/llm.service.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FakeLlmService } from '../../ai/testing/fake-llm.service.js';
import type { ModelAnswer } from '../advisor-answer.js';
import { REDACTION_NOTICE } from '../advisor-prompt.js';
import { validateRequest } from '../red-team/red-team-cases.js';
import { corpusIndex } from '../retrieval/regulation-corpus.js';
import { cleanInput } from '../retrieval/text.js';
import { advisorFor, anchoredFrom, ask, faithfulAnswer, factIdsFor, modelTextOutsideExplanation, reply, stepsToReach, structuredFrom, summary } from '../testing/advisor-test-kit.js';
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

// Round 2 of the offline red team (PR #77, ADR 0016 "Offline red team, round 2"): what reaches the
// provider (redaction, consent) and what the server shows (blank characters, links, numbers,
// tool-grounded numbers), plus the gate's refusals of legit questions. FakeLlmService plays the
// model; no provider is called. Since option A the model answers with a JSON object: a hostile
// reply is re-expressed by structuredFrom (and again by anchoredFrom, passing every id check) and
// must not have its explanation shown; a faithful reply is a faithful model's answer with its
// blind explanation (faithful-explanations.json) and must have its passages and facts shown.

const index = corpusIndex();
const DEFLECT = reply({ refusal: 'no_source' });
const EXPLANATIONS: Record<string, string | null> = JSON.parse(readFileSync(join(__dirname, 'faithful-explanations.json'), 'utf8'));

/** What one request sends to the provider, or undefined if it never got there. */
async function sent(lang: 'vi' | 'en', messages: { role: string; content: string }[], consented = true) {
  const v = await validateRequest({ language: lang, messages });
  if (!v.ok) throw new Error(`invalid request: ${v.errors.join('; ')}`);
  const llm = new FakeLlmService().replyChat(DEFLECT);
  const { advisor } = advisorFor({ llm, consented });
  const run = summary(await ask(advisor, lang, v.messages));
  return { request: llm.chatCalls[0] as ChatRequest | undefined, run };
}

const leaks = (request: ChatRequest, c: RedactCase) => {
  const text = JSON.stringify(request.messages.map((m) => m.content));
  return c.secrets.filter((s) => text.includes(JSON.stringify(cleanInput(s)).slice(1, -1)) || text.includes(JSON.stringify(s).slice(1, -1)));
};

/** Plays one model answer through the advisor; a passage outside the gate's hits is fetched by a search first. */
async function play(c: OutputCase, final: (inTurn: Set<string>, best: string | undefined) => { answer: ModelAnswer; steps: { tool: string; args: unknown }[] }) {
  const g = gate(index, [c.question], true);
  expect(g.decision, `${c.id}: the question must reach the model`).toBe('answer');
  const cited = [...c.answer.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
  for (const id of cited) expect(index.get(id), `${c.id}: ${id} is a real clause`).toBeDefined();
  const reach = stepsToReach([c.question], cited);
  const inTurn = new Set([...g.hits.map((h) => h.clause.id), ...reach.flatMap((s) => index.search((s.args as { query: string }).query, 5).hits.map((h) => h.clause.id))]);
  for (const id of cited) expect(inTurn.has(id), `${c.id}: the search finds ${id}`).toBe(true);
  const { answer, steps } = final(inTurn, g.hits[0]?.clause.id);
  const { advisor } = advisorFor({ llm: new FakeLlmService().replyChat(...steps, reply(answer)) });
  const a = await ask(advisor, c.lang, [{ role: 'user', content: c.question }]);
  expect(modelTextOutsideExplanation(a, c.lang), c.id).toEqual([]);
  return { ...summary(a), picked: answer };
}

/** A hostile reply as written, and from a model that passes every id check. */
const hostile = (c: OutputCase, anchored: boolean) => (inTurn: Set<string>, best: string | undefined) => {
  const facts = factIdsFor(c.tools);
  const answer = structuredFrom(c.answer, facts);
  return { answer: anchored ? { ...anchoredFrom(answer, inTurn, best), engineFacts: facts } : answer, steps: [...stepsToReach([c.question], [...c.answer.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1])), ...(c.tools ?? [])] };
};

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
    expect(leaks(request!, c), `${c.id} is residual in ADR 0016; if it is now redacted, move it to REDACTED and update the count`).not.toEqual([]);
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

describe('rt77 round 2: what the student would see (items 3–6)', () => {
  // `reasons` names what the free-text guard caught at the time; the explanation guard now does.
  it.each(HOSTILE.map((c) => [c.id, c] as const))('%s is not shown', async (_id, c) => {
    for (const anchored of [false, true]) {
      const run = await play(c, hostile(c, anchored));
      expect(run.explanation, `${c.id}${anchored ? ' anchored' : ''}: ${run.reasons.join(',')}`).toBeNull();
    }
  });

  it.each([...FAITHFUL, ...FAITHFUL_EXTRA].map((c) => [c.id, c] as const))('faithful %s is shown', async (_id, c) => {
    const run = await play(c, () => faithfulAnswer({ legacy: c.answer, userTurns: [c.question], consented: true, steps: c.tools, explanation: EXPLANATIONS[`r2/${c.id}`] ?? null }));
    expect(['answered', 'partial'], run.reasons.join(',')).toContain(run.outcome);
    expect(run.passages).toEqual(run.picked.passageIds);
    expect(run.facts).toHaveLength(run.picked.engineFacts.length);
  });
});

describe('rt77 round 2: the gate (item 7)', () => {
  it.each(LEGIT.map((q) => [q.id, q] as const))('legit %s is not refused as off-topic', (_id, q) => {
    for (const consented of [true, false]) expect(gate(index, [q.q], consented).decision, `${q.q} (consent ${consented})`).not.toBe('off_topic');
  });
});
