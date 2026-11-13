import type { BoardTerm, Placement } from '../rules/inputs.js';
import { compareTerms, sameTerm, Term, termFromColumns, termKey } from '../terms/term.js';
import type { PlanPlacement } from './plan-placement.entity.js';

// The board of a plan (ADR 0014): one row per term, placements in order. Pure functions, so the
// shape checks are unit-tested without a database. None of them is an academic rule (AGENTS.md
// hard rule 1): prerequisites, offering terms, credit caps and coverage are the rule engine's.

// The shapes, BoardTerm and Placement, are the rule engine's input (`rules/inputs.ts`).

/** Upper bounds against oversized requests, far above any real plan (12 terms of about 8 courses for APCS). */
export const MAX_BOARD_TERMS = 30;
export const MAX_TERM_PLACEMENTS = 30;
export const MAX_BOARD_PLACEMENTS = 300;

/** Why a board cannot be stored as sent, or [] when its shape is sound. */
export function boardProblems(terms: readonly BoardTerm[]): string[] {
  const problems: string[] = [];
  const seenTerms = new Set<string>();
  const seenCodes = new Set<string>();
  let total = 0;
  for (const { term, placements } of terms) {
    const key = termKey(term);
    if (seenTerms.has(key)) problems.push(`term ${key} is listed twice`);
    seenTerms.add(key);
    total += placements.length;
    for (const p of placements) {
      if (p.kind !== 'course' || p.courseCode === null) continue;
      if (seenCodes.has(p.courseCode)) problems.push(`course ${p.courseCode} is placed twice`);
      seenCodes.add(p.courseCode);
    }
  }
  if (total > MAX_BOARD_PLACEMENTS) problems.push(`a plan holds at most ${MAX_BOARD_PLACEMENTS} placements`);
  return problems;
}

/**
 * The board with `placement` added at the end of `to`, the term made if it holds nothing yet. The planner draws a
 * drop the same way, so the positions in each report match its tiles. Board shape only: no rule is judged here.
 */
export function withPlacement(terms: readonly BoardTerm[], placement: Placement, to: Term): BoardTerm[] {
  const key = termKey(to);
  if (!terms.some((t) => termKey(t.term) === key)) return [...terms, { term: to, placements: [placement] }];
  return terms.map((t) => (termKey(t.term) === key ? { term: t.term, placements: [...t.placements, placement] } : t));
}

export const groupIdsOf = (terms: readonly BoardTerm[]): string[] =>
  terms.flatMap((t) => t.placements.flatMap((p) => (p.kind === 'slot' && p.requirementGroupId !== null ? [p.requirementGroupId] : [])));

/** The rows that store a board; position is the order within its term. */
export function toRows(planId: string, userId: string, terms: readonly BoardTerm[]): Partial<PlanPlacement>[] {
  return terms.flatMap(({ term, placements }) =>
    placements.map((p, position) => ({
      planId,
      userId,
      termYear: term.year,
      termNumber: term.number,
      position,
      courseCode: p.kind === 'course' ? p.courseCode : null,
      requirementGroupId: p.kind === 'slot' ? p.requirementGroupId : null,
      slotCredits: p.kind === 'slot' ? p.credits : null,
    })),
  );
}

/** The board stored in these rows: terms oldest first, placements in position order. */
export function toBoard(rows: readonly PlanPlacement[]): BoardTerm[] {
  const sorted = rows.map((row) => ({ row, term: termFromColumns(row.termYear, row.termNumber) })).sort((a, b) => compareTerms(a.term, b.term) || a.row.position - b.row.position);
  const terms: BoardTerm[] = [];
  for (const { row, term } of sorted) {
    let last = terms.at(-1);
    if (!last || !sameTerm(last.term, term)) {
      last = { term, placements: [] };
      terms.push(last);
    }
    last.placements.push(
      row.courseCode !== null
        ? { kind: 'course', courseCode: row.courseCode, requirementGroupId: null, credits: null }
        : { kind: 'slot', courseCode: null, requirementGroupId: row.requirementGroupId, credits: row.slotCredits },
    );
  }
  return terms;
}
