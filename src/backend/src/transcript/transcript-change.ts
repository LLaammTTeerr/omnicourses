import type { EntityManager } from 'typeorm';
import type { TranscriptEntry } from './transcript-entry.js';

export interface TranscriptSave {
  userId: string;
  wasEmpty: boolean;
  changed: boolean;
}

export type TranscriptSaveListener = (tx: EntityManager, save: TranscriptSave) => Promise<void>;

const key = (entry: TranscriptEntry): string => JSON.stringify([entry.term.year, entry.term.number, entry.courseCode, entry.courseName, entry.credits, entry.result, entry.grade]);

export function sameEntries(left: readonly TranscriptEntry[], right: readonly TranscriptEntry[]): boolean {
  if (left.length !== right.length) return false;
  const [x, y] = [left.map(key).sort(), right.map(key).sort()];
  return x.every((k, i) => k === y[i]);
}
