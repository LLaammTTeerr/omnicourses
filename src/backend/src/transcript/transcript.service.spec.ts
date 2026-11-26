import type { DataSource, EntityManager, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { TranscriptEntry } from './transcript-entry.js';
import { TranscriptRow } from './transcript-row.entity.js';
import { TranscriptService } from './transcript.service.js';

const USER = '00000000-0000-4000-8000-000000000001';
const entry: TranscriptEntry = { courseCode: 'ZZ101', courseName: 'Synthetic One', credits: 4, result: 'graded', grade: 8, term: { year: 2025, number: 1 } };
const stored = { userId: USER, courseCode: 'ZZ101', courseName: 'Synthetic One', credits: 4, result: 'graded', grade: 8, termYear: 2025, termNumber: 1 } as TranscriptRow;

function setup(storedBefore: TranscriptRow[]) {
  let table = storedBefore;
  const tx = {
    query: vi.fn(async () => []),
    findBy: vi.fn(async () => table),
    delete: vi.fn(async () => { table = []; }),
    insert: vi.fn(async () => { table = [stored]; }),
  };
  const db = { transaction: async (work: (m: EntityManager) => Promise<void>) => work(tx as unknown as EntityManager) } as unknown as DataSource;
  const rows = { find: vi.fn(async () => table) } as unknown as Repository<TranscriptRow>;
  return { service: new TranscriptService(db, rows), tx };
}

describe('TranscriptService.replace', () => {
  it('reads no rows inside the save when no listener is registered', async () => {
    const { service, tx } = setup([]);
    await expect(service.replace(USER, [entry])).resolves.toEqual([entry]);
    expect(tx.findBy).not.toHaveBeenCalled();
    expect(tx.delete).toHaveBeenCalledOnce();
    expect(tx.insert).toHaveBeenCalledOnce();
  });

  it('reads the rows before and after the save, under the lock, when a listener is registered', async () => {
    const { service, tx } = setup([{ ...stored, grade: 7 } as TranscriptRow]);
    const listener = vi.fn(async () => {});
    service.onSaved(listener);
    await service.replace(USER, [entry]);
    expect(tx.findBy).toHaveBeenCalledTimes(2);
    expect(tx.query.mock.invocationCallOrder[0]).toBeLessThan(tx.findBy.mock.invocationCallOrder[0]);
    expect(tx.findBy.mock.invocationCallOrder[0]).toBeLessThan(tx.delete.mock.invocationCallOrder[0]);
    expect(listener).toHaveBeenCalledWith(tx, { userId: USER, wasEmpty: false, changed: true });
  });

  it('reads no rows again once the last listener is removed', async () => {
    const { service, tx } = setup([]);
    service.onSaved(async () => {})();
    await service.replace(USER, [entry]);
    expect(tx.findBy).not.toHaveBeenCalled();
  });
});
