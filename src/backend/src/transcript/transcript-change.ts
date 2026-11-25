import type { EntityManager } from 'typeorm';
import type { TranscriptEntry } from './transcript-entry.js';

/**
 * What one save did to the stored transcript (ADR 0018). It carries no row: a listener learns
 * that the transcript changed, never a course or a grade.
 */
export interface TranscriptSave {
  userId: string;
  /** Nothing was saved before this save. */
  wasEmpty: boolean;
  /** The stored rows after the save differ from the stored rows before it. */
  changed: boolean;
}

/**
 * Called inside the save's transaction, after the rows are replaced and before the commit.
 * Write through `tx`, so the write commits or rolls back with the save. A listener that throws
 * rolls the save back.
 */
export type TranscriptSaveListener = (tx: EntityManager, save: TranscriptSave) => Promise<void>;

const key = (e: TranscriptEntry): string => JSON.stringify([e.term.year, e.term.number, e.courseCode, e.courseName, e.credits, e.result, e.grade]);

/**
 * True when both transcripts hold the same attempts, in any order. A multiset comparison: a
 * retake is a row of its own (ADR 0007), so the same row twice differs from the row once.
 */
export function sameEntries(a: readonly TranscriptEntry[], b: readonly TranscriptEntry[]): boolean {
  if (a.length !== b.length) return false;
  const [x, y] = [a.map(key).sort(), b.map(key).sort()];
  return x.every((k, i) => k === y[i]);
}
