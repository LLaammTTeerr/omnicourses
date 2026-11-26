import type { EntityManager } from 'typeorm';
import type { TranscriptEntry } from './transcript-entry.js';

export interface TranscriptSave {
  userId: string;
  wasEmpty: boolean;
  changed: boolean;
}

export type TranscriptSaveListener = (tx: EntityManager, save: TranscriptSave) => Promise<void>;

const key = (e: TranscriptEntry): string => JSON.stringify([e.term.year, e.term.number, e.courseCode, e.courseName, e.credits, e.result, e.grade]);

export function sameEntries(a: readonly TranscriptEntry[], b: readonly TranscriptEntry[]): boolean {
  if (a.length !== b.length) return false;
  const [x, y] = [a.map(key).sort(), b.map(key).sort()];
  return x.every((k, i) => k === y[i]);
}
