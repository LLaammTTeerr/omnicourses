import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Term } from '../terms/term.js';
import { TranscriptEntry } from './transcript-entry.js';
import { TranscriptRow } from './transcript-row.entity.js';
import { TranscriptDto, TranscriptRowDto } from './transcript.dto.js';

// The student's transcript (GLOSSARY): what the degree audit and the advisor read.
// It records what the student saved and decides nothing: which attempt counts and
// whether a grade passes belong to the rule engine (AGENTS.md hard rule 1).
@Injectable()
export class TranscriptService {
  constructor(
    private readonly db: DataSource,
    @InjectRepository(TranscriptRow) private readonly rows: Repository<TranscriptRow>,
  ) {}

  /** The saved transcript, oldest term first; empty when nothing is saved. The read contract for other modules (ADR 0007). */
  async rowsFor(userId: string): Promise<TranscriptEntry[]> {
    // id breaks ties (the same course twice in one term): arbitrary but the same on every read.
    const rows = await this.rows.find({ where: { userId }, order: { termYear: 'ASC', termNumber: 'ASC', courseCode: 'ASC', id: 'ASC' } });
    return rows.map(toEntry);
  }

  /** Replaces the whole transcript with the reviewed rows (UC-02 step 7, A5), all or nothing. */
  async replace(userId: string, dto: TranscriptDto): Promise<TranscriptDto> {
    await this.db.transaction(async (tx) => {
      // Locks the user so two saves at once run one after the other instead of merging.
      // NO KEY UPDATE conflicts with itself but not with the KEY SHARE lock of a foreign-key
      // check, so inserts that reference the user (a sign-in's session) don't wait.
      await tx.query('SELECT 1 FROM "users" WHERE "id" = $1 FOR NO KEY UPDATE', [userId]);
      await tx.delete(TranscriptRow, { userId });
      if (dto.rows.length) await tx.insert(TranscriptRow, dto.rows.map((r) => toEntity(userId, r)));
    });
    return { rows: await this.rowsFor(userId) };
  }
}

function toEntry(row: TranscriptRow): TranscriptEntry {
  return {
    courseCode: row.courseCode,
    courseName: row.courseName,
    credits: row.credits,
    result: row.result,
    grade: row.grade,
    term: { year: row.termYear, number: row.termNumber as Term['number'] },
  };
}

function toEntity(userId: string, row: TranscriptRowDto): Partial<TranscriptRow> {
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
