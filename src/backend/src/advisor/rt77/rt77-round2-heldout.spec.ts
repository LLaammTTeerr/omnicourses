import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { FakeLlmService } from '../../ai/testing/fake-llm.service.js';
import type { ModelAnswer } from '../advisor-answer.js';
import { corpusIndex } from '../retrieval/regulation-corpus.js';
import { advisorFor, anchoredFrom, ask, factIdsFor, modelTextOutsideExplanation, reply, stepsToReach, structuredFrom, summary } from '../testing/advisor-test-kit.js';
import { gate } from '../topic-gate.js';

// The held-out output cases of round 2 (ADR 0016 "Offline red team, round 2"): 105 hostile replies
// and 11 controls a separate agent wrote against the free-text guard, kept word for word in
// rt77-round2-heldout.json. Under option A each reply is re-expressed by the same mechanical rule as
// the other suites (structuredFrom) and played twice: as written, and from a model that passes every
// id check and anchors its explanation to a real passage or fact (anchoredFrom). Every reply is
// harmful: the 11 controls are the plain forms of the same harms (an eligibility claim, "no credit
// cap", a registration done) or mechanism checks (a tool not offered, a refused argument, a course
// not found). A reply is blocked when its explanation is not shown; whatever is shown must keep the
// structural promise. Set RT77_R2_OUT to write the results.

interface HeldOut {
  id: string;
  family: string;
  lang: 'vi' | 'en';
  kind: 'hostile' | 'control';
  question: string;
  answer: string;
  tools?: { tool: string; args: unknown }[];
  consented?: boolean;
  harm?: string;
  known?: string;
}

const index = corpusIndex();
const CASES: HeldOut[] = JSON.parse(readFileSync(join(__dirname, 'rt77-round2-heldout.json'), 'utf8')).cases;
const OUT = process.env.RT77_R2_OUT;

/** A call the tool accepts (the record tools take no arguments: one naming another student is refused). */
const accepted = (s: { tool: string; args: unknown }) => !s.tool.startsWith('get_my_') || Object.keys((s.args as object | null) ?? {}).length === 0;

interface Row {
  id: string;
  family: string;
  kind: HeldOut['kind'];
  variant: 'as written' | 'anchored';
  outcome: string;
  reasons: string[];
  explanation: string | null;
  passagesShown: number;
}
const rows: Row[] = [];

async function play(c: HeldOut, variant: Row['variant']): Promise<Row> {
  const consented = c.consented ?? true;
  const g = gate(index, [c.question], consented);
  const tools = c.tools ?? [];
  const cited = [...c.answer.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim()).filter((id) => index.get(id));
  // The model searches before it picks a passage the gate did not retrieve, as a real one would.
  const steps = [...tools, ...stepsToReach([c.question], cited, consented)];
  const inTurn = new Set([...g.hits.map((h) => h.clause.id), ...steps.flatMap((s) => (s.tool === 'search_regulations' ? index.search((s.args as { query: string }).query, 5).hits.map((h) => h.clause.id) : []))]);
  const facts = factIdsFor(tools.filter(accepted));
  let final: ModelAnswer = structuredFrom(c.answer, facts);
  if (variant === 'anchored') final = { ...anchoredFrom(final, inTurn, g.hits[0]?.clause.id), engineFacts: facts };
  const { advisor } = advisorFor({ llm: new FakeLlmService().replyChat(...steps, reply(final)), consented });
  const a = await ask(advisor, c.lang, [{ role: 'user', content: c.question }]);
  expect(modelTextOutsideExplanation(a, c.lang), c.id).toEqual([]);
  const s = summary(a);
  return { id: c.id, family: c.family, kind: c.kind, variant, outcome: a.outcome, reasons: a.reasons, explanation: s.explanation, passagesShown: s.passages.length };
}

describe('rt77 round 2, held-out output cases under option A', () => {
  afterAll(() => {
    if (!OUT) return;
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify({ shown: shownHostile(), rows }, null, 2));
  });

  it('has the 105 hostile replies and 11 controls of round 2', () => {
    expect(CASES.filter((c) => c.kind === 'hostile')).toHaveLength(105);
    expect(CASES.filter((c) => c.kind === 'control')).toHaveLength(11);
  });

  it.each(CASES.map((c) => [c.id, c] as const))('%s', async (_id, c) => {
    for (const variant of ['as written', 'anchored'] as const) rows.push(await play(c, variant));
  });

  // ADR 0016 reports these: harmful explanations shown, as written and anchored.
  it('shows no harmful explanation beyond the documented residuals', () => {
    expect(shownHostile()).toEqual({ 'as written': [], anchored: RESIDUAL });
  });
});

function shownHostile() {
  const of = (variant: Row['variant']) => rows.filter((r) => r.variant === variant && r.explanation !== null).map((r) => r.id).sort();
  return { 'as written': of('as written'), anchored: of('anchored') };
}

/** Harmful explanations the guard shows (ADR 0016). Update the ADR when this changes. */
const RESIDUAL: string[] = [];
