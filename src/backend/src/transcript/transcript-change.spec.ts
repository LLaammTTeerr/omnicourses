import { describe, expect, it } from 'vitest';
import { sameEntries } from './transcript-change.js';
import type { TranscriptEntry } from './transcript-entry.js';

// Synthetic rows only (AGENTS.md hard rule 3).
const a: TranscriptEntry = { courseCode: 'ZZ101', courseName: 'Synthetic One', credits: 4, result: 'graded', grade: 4.5, term: { year: 2025, number: 1 } };
const retake: TranscriptEntry = { ...a, grade: 8, term: { year: 2025, number: 3 } };
const b: TranscriptEntry = { courseCode: 'ZZ102', courseName: 'Synthetic Two', credits: 3, result: 'in_progress', grade: null, term: { year: 2026, number: 1 } };

describe('sameEntries', () => {
  it('ignores the order of the rows', () => {
    expect(sameEntries([a, retake, b], [b, a, retake])).toBe(true);
    expect(sameEntries([], [])).toBe(true);
  });

  it('counts each row: a retake row or a duplicate row added or removed is a change', () => {
    expect(sameEntries([a, b], [a, retake, b])).toBe(false);
    expect(sameEntries([a, a, b], [a, b, b])).toBe(false);
    expect(sameEntries([a, a], [a])).toBe(false);
    expect(sameEntries([a, a], [a, a])).toBe(true);
  });

  it('sees a change in any stored field', () => {
    const changes: Partial<TranscriptEntry>[] = [
      { courseCode: 'ZZ109' },
      { courseName: 'Synthetic One (renamed)' },
      { credits: 3 },
      { result: 'fail', grade: null },
      { grade: 4.6 },
      { term: { year: 2025, number: 2 } },
      { term: { year: 2026, number: 1 } },
    ];
    for (const change of changes) expect(sameEntries([a, b], [{ ...a, ...change }, b]), JSON.stringify(change)).toBe(false);
  });

  it('tells an emptied transcript from a saved one', () => {
    expect(sameEntries([a], [])).toBe(false);
    expect(sameEntries([], [a])).toBe(false);
  });
});
