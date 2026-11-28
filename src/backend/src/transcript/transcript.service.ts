import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { toTerm } from '../terms/term.js';
import { lockAccountRow, ROW_LOCK } from '../users/account-state.js';
import { sameEntries, type TranscriptSaveListener } from './transcript-change.js';
import { TranscriptEntry } from './transcript-entry.js';
import { TranscriptRow } from './transcript-row.entity.js';

@Injectable()
export class TranscriptService {
  private readonly saveListeners = new Set<TranscriptSaveListener>();

  constructor(
    private readonly db: DataSource,
    @InjectRepository(TranscriptRow) private readonly rows: Repository<TranscriptRow>,
  ) {}

  async rowsFor(userId: string): Promise<TranscriptEntry[]> {
    const rows = await this.rows.find({ where: { userId }, order: { termYear: 'ASC', termNumber: 'ASC', courseCode: 'ASC', id: 'ASC' } });
    return rows.map(toEntry);
  }

  onSaved(listener: TranscriptSaveListener): () => void {
    this.saveListeners.add(listener);
    return () => void this.saveListeners.delete(listener);
  }

  async replace(userId: string, rows: TranscriptEntry[]): Promise<TranscriptEntry[]> {
    await this.db.transaction(async (tx) => {
      await lockAccountRow(tx, userId, ROW_LOCK.noKeyUpdate);
      const listened = this.saveListeners.size > 0;
      const before = listened ? (await tx.findBy(TranscriptRow, { userId })).map(toEntry) : [];
      await tx.delete(TranscriptRow, { userId });
      await tx.insert(TranscriptRow, rows.map((r) => toEntity(userId, r)));
      if (!listened) return;
      const after = (await tx.findBy(TranscriptRow, { userId })).map(toEntry);
      const save = { userId, wasEmpty: before.length === 0, changed: !sameEntries(before, after) };
      for (const listener of this.saveListeners) await listener(tx, save);
    });
    return this.rowsFor(userId);
  }
}

function toEntry(row: TranscriptRow): TranscriptEntry {
  return {
    courseCode: row.courseCode,
    courseName: row.courseName,
    credits: row.credits,
    result: row.result,
    grade: row.grade,
    term: toTerm(row.termYear, row.termNumber),
  };
}

function toEntity(userId: string, row: TranscriptEntry): Partial<TranscriptRow> {
  return {
    userId,
    courseCode: row.courseCode,
    courseName: row.courseName,
    credits: row.credits,
    result: row.result,
    grade: row.grade ?? null,
    termYear: row.term.year,
    termNumber: row.term.number,
  };
}
