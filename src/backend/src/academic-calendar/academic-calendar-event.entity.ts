import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Program } from '../curriculum/program.entity.js';
import type { TermNumber } from '../terms/term.js';
import { User } from '../users/user.entity.js';

export const CALENDAR_EVENT_KINDS = ['term_start', 'term_end', 'registration', 'add_drop', 'exam_period', 'holiday', 'other'] as const;
export type CalendarEventKind = (typeof CALENDAR_EVENT_KINDS)[number];
export const CALENDAR_EVENT_KIND_DOC =
  'term_start, term_end: first and last day of a term; registration: course registration window; add_drop: add/drop window; exam_period: final exams; holiday: no classes; other: anything else';

export const TITLE_MAX_LENGTH = 255;
export const SOURCE_URL_MAX_LENGTH = 2048;

@Entity({ name: 'academic_calendar' })
@Index('ix_academic_calendar_program_starts_on', ['programId', 'startsOn'])
@Check('ck_academic_calendar_kind', `"kind" IN ('term_start', 'term_end', 'registration', 'add_drop', 'exam_period', 'holiday', 'other')`)
@Check('ck_academic_calendar_term', `"term" IN (1, 2, 3)`)
@Check('ck_academic_calendar_academic_year', `"academic_year" BETWEEN 2000 AND 2100`)
@Check('ck_academic_calendar_range', `"ends_on" >= "starts_on"`)
@Check('ck_academic_calendar_source_url', `"source_url" LIKE 'https://%'`)
export class AcademicCalendarEvent {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'academic_calendar_pkey' })
  id!: string;

  @Column({ name: 'program_id', type: 'uuid' })
  programId!: string;

  @ManyToOne(() => Program, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'program_id', foreignKeyConstraintName: 'academic_calendar_program_id_fkey' })
  program!: Program;

  @Column({ name: 'academic_year', type: 'smallint' })
  academicYear!: number;

  @Column({ type: 'smallint', nullable: true })
  term!: TermNumber | null;

  @Column({ type: 'varchar', length: 32 })
  kind!: CalendarEventKind;

  @Column({ name: 'starts_on', type: 'date' })
  startsOn!: string;

  @Column({ name: 'ends_on', type: 'date' })
  endsOn!: string;

  @Column({ type: 'varchar', length: TITLE_MAX_LENGTH })
  title!: string;

  @Column({ name: 'title_en', type: 'varchar', length: TITLE_MAX_LENGTH, nullable: true })
  titleEn!: string | null;

  @Column({ name: 'source_url', type: 'varchar', length: SOURCE_URL_MAX_LENGTH, nullable: true })
  sourceUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by', foreignKeyConstraintName: 'academic_calendar_created_by_fkey' })
  creator!: User | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by', foreignKeyConstraintName: 'academic_calendar_updated_by_fkey' })
  updater!: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
