import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../ai/llm.service.js';
import { FakeLlmService } from '../../ai/testing/fake-llm.service.js';
import { requestBody, validateRequest, type AttackCase } from '../red-team/red-team-cases.js';
import { corpusIndex } from '../retrieval/regulation-corpus.js';
import { advisorFor, ask, faithfulAnswer, modelTextOutsideExplanation, reply, summary } from '../testing/advisor-test-kit.js';
import { gate } from '../topic-gate.js';
import { CASES } from './rt77-cases.js';
import { FAITHFUL, FAITHFUL_EXTRA } from './rt77-round2-cases.js';

// Over-blocking under option A (ADR 0016). The faithful replies of the three red-team suites (round 0,
// rt77 round 1's legit questions, round 2), re-expressed as the structured answer a faithful model
// returns: the passages its reply cited, the facts its tools returned, and an explanation written
// for these cases by a separate agent that was given only the prompt's explanation rules and never
// saw the guard (faithful-explanations.json, 12 Nov 2026). A legacy reply with no citation, no fixed
// reply and no data shows the two passages the gate retrieved, as the writer was shown. Every answer must be shown; the explanations the guard
// drops are counted (ADR 0016 reports the rate). Set RT77_FAITHFUL_OUT to write the results.

const index = corpusIndex();
const EXPLANATIONS: Record<string, string | null> = JSON.parse(readFileSync(join(__dirname, 'faithful-explanations.json'), 'utf8'));
const OUT = process.env.RT77_FAITHFUL_OUT;

interface Faithful {
  id: string;
  lang: 'vi' | 'en';
  consent: boolean;
  messages: ChatMessage[];
  steps: { tool: string; args: unknown }[];
  legacy: string;
}

function rt77(): Faithful[] {
  return CASES.filter((c) => c.surface === 'legit').map((c) => {
    const hits = gate(index, [c.q!], c.consent ?? true).hits.map((h) => h.clause);
    const legacy = typeof c.reply === 'function' ? c.reply(hits) : (c.reply ?? '');
    return { id: `rt77/${c.id}`, lang: c.lang, consent: c.consent ?? true, messages: [{ role: 'user', content: c.q! }], steps: c.steps ?? [], legacy };
  });
}

function round2(): Faithful[] {
  return [...FAITHFUL, ...FAITHFUL_EXTRA].map((c) => ({ id: `r2/${c.id}`, lang: c.lang, consent: true, messages: [{ role: 'user', content: c.question }], steps: c.tools ?? [], legacy: c.answer }));
}

async function round0(): Promise<Faithful[]> {
  const corpus: AttackCase[] = JSON.parse(readFileSync(join(__dirname, '../red-team/corpus.json'), 'utf8'));
  const replies: { cases: { id: string; faithful: { steps: { tool: string; args: unknown }[]; text: string } }[] } = JSON.parse(
    readFileSync(join(__dirname, '../red-team/replies.json'), 'utf8'),
  );
  const out: Faithful[] = [];
  for (const c of corpus) {
    const r = replies.cases.find((x) => x.id === c.id);
    const valid = await validateRequest(requestBody(c));
    if (!r || !valid.ok) continue;
    out.push({ id: `r0/${c.id}`, lang: c.lang, consent: c.consent, messages: valid.messages, steps: r.faithful.steps, legacy: r.faithful.text });
  }
  return out;
}

const results: { id: string; outcome: string; reasons: string[]; explanation: string | null; dropped: boolean }[] = [];

describe('faithful answers under option A (blind explanations)', async () => {
  const cases = [...rt77(), ...round2(), ...(await round0())];

  afterAll(() => {
    if (!OUT) return;
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify({ cases: results.length, dropped: results.filter((r) => r.dropped).length, results }, null, 2));
  });

  it('has an explanation for every faithful case', () => {
    expect(cases).toHaveLength(125);
    expect(Object.keys(EXPLANATIONS).sort()).toEqual(cases.map((c) => c.id).sort());
  });

  it.each(cases.map((c) => [c.id, c] as const))('%s is shown', async (_id, c) => {
    const userTurns = c.messages.filter((m) => m.role === 'user').map((m) => m.content);
    const { answer, steps } = faithfulAnswer({ legacy: c.legacy, userTurns, consented: c.consent, steps: c.steps, explanation: EXPLANATIONS[c.id] });
    const { passageIds, engineFacts } = answer;
    const { advisor } = advisorFor({ llm: new FakeLlmService().replyChat(...steps, reply(answer)), consented: c.consent });
    const a = await ask(advisor, c.lang, c.messages);
    const run = summary(a);
    const dropped = answer.explanation !== null && run.explanation === null && !['off_topic', 'needs_consent'].includes(a.outcome);
    results.push({ id: c.id, outcome: a.outcome, reasons: a.reasons, explanation: answer.explanation, dropped });
    expect(modelTextOutsideExplanation(a, c.lang)).toEqual([]);
    // The gate answers some without the model (r0/fake-citation-04 needs consent first).
    if (a.outcome === 'off_topic' || a.outcome === 'needs_consent') return;
    // The answer itself is never lost: every passage and fact it picked is shown.
    expect(run.passages).toEqual(passageIds);
    expect(run.facts).toHaveLength(engineFacts.length);
    expect(['answered', 'partial', 'off_topic', 'needs_consent']).toContain(a.outcome);
    if (a.outcome === 'partial') expect(a.reasons.every((r) => !['unknown_passage', 'unknown_fact', 'unparseable'].includes(r)), a.reasons.join(',')).toBe(true);
  });

  // ADR 0016 reports this rate: explanations dropped although written to the rules.
  it('drops few blind faithful explanations', () => {
    const dropped = results.filter((r) => r.dropped);
    expect(results).toHaveLength(125);
    expect(dropped.map((r) => `${r.id} ${r.reasons.join(',')}`)).toEqual(OVERBLOCKED);
  });
});

/** Faithful explanations the guard drops (ADR 0016, residual R16). Update the ADR when this changes. */
// First run, before any change made after seeing these explanations: 11 of 124 dropped (8.9 %). Two
// changes followed, both kept general: the pointer may end "for your own progress" / "để biết tình
// trạng học tập của bạn", and the action list keeps only idioms (an action claim with a subject, a
// tense or "your" is read by the person and time checks), so "students enrolled in" is no claim.
// What is left is by design: "once the conditions are met", "sau khi đủ điều kiện", "already passed".
const OVERBLOCKED: string[] = ['rt77/L-30 claim', 'r2/f26 claim', 'r2/f33 time'];
