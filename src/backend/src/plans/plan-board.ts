import type { BoardTerm, Placement } from '../rules/types.js';
import { type Term, termKey, toTerm } from '../terms/term.js';
import type { PlanPlacement } from './plan-placement.entity.js';

export const MAX_BOARD_TERMS = 30;
export const MAX_TERM_PLACEMENTS = 30;
export const MAX_BOARD_PLACEMENTS = 300;

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

export function withPlacement(terms: readonly BoardTerm[], placement: Placement, to: Term): BoardTerm[] {
  const key = termKey(to);
  if (!terms.some((t) => termKey(t.term) === key)) return [...terms, { term: to, placements: [placement] }];
  return terms.map((t) => (termKey(t.term) === key ? { term: t.term, placements: [...t.placements, placement] } : t));
}

export const groupIdsOf = (terms: readonly BoardTerm[]): string[] =>
  terms.flatMap((t) => t.placements.flatMap((p) => (p.kind === 'slot' && p.requirementGroupId !== null ? [p.requirementGroupId] : [])));

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

export function toBoard(rows: readonly PlanPlacement[]): BoardTerm[] {
  const sorted = [...rows].sort((a, b) => a.termYear - b.termYear || a.termNumber - b.termNumber || a.position - b.position);
  const terms: BoardTerm[] = [];
  for (const row of sorted) {
    let last = terms.at(-1);
    if (!last || last.term.year !== row.termYear || last.term.number !== row.termNumber) {
      last = { term: toTerm(row.termYear, row.termNumber), placements: [] };
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
