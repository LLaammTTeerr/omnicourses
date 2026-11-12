import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Program } from '../curriculum/program.entity.js';
import { User } from '../users/user.entity.js';

/** What a school date is (ADR 0016). `other` covers anything the list does not name. */
export const CALENDAR_EVENT_KINDS = ['term_start', 'term_end', 'registration', 'add_drop', 'exam_period', 'holiday', 'other'] as const;
export type CalendarEventKind = (typeof CALENDAR_EVENT_KINDS)[number];

// Table of migration 1794500000000 (ADR 0016). Shared data of a program, not a student's
// record: no user_id. created_by and updated_by name the administrator and are nulled when
// that account is purged (AGENTS.md, ADR 0004), so the dates stay for everyone else.
@Entity({ name: 'academic_calendar_events' })
@Index('ix_academic_calendar_events_program_starts_on', ['programId', 'startsOn'])
@Check('ck_academic_calendar_events_kind', `"kind" IN ('term_start', 'term_end', 'registration', 'add_drop', 'exam_period', 'holiday', 'other')`)
@Check('ck_academic_calendar_events_term', `"term" IN (1, 2, 3)`)
@Check('ck_academic_calendar_events_academic_year', `"academic_year" BETWEEN 2000 AND 2100`)
@Check('ck_academic_calendar_events_range', `"ends_on" >= "starts_on"`)
@Check('ck_academic_calendar_events_source_url', `"source_url" LIKE 'https://%'`)
export class AcademicCalendarEvent {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'academic_calendar_events_pkey' })
  id!: string;

  @Column({ name: 'program_id', type: 'uuid' })
  programId!: string;

  @ManyToOne(() => Program, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'program_id', foreignKeyConstraintName: 'academic_calendar_events_program_id_fkey' })
  program!: Program;

  /** ADR 0009: 2026 is the academic year 2026–2027. */
  @Column({ name: 'academic_year', type: 'smallint' })
  academicYear!: number;

  /** 1, 2 or 3 (ADR 0009, ADR 0012); null for a date of the whole academic year. */
  @Column({ type: 'smallint', nullable: true })
  term!: 1 | 2 | 3 | null;

  @Column({ type: 'varchar', length: 32 })
  kind!: CalendarEventKind;

  // `date` columns: TypeORM reads them as 'YYYY-MM-DD' strings, never a Date at midnight UTC.
  @Column({ name: 'starts_on', type: 'date' })
  startsOn!: string;

  @Column({ name: 'ends_on', type: 'date' })
  endsOn!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'title_en', type: 'varchar', length: 255, nullable: true })
  titleEn!: string | null;

  @Column({ name: 'source_url', type: 'varchar', length: 2048, nullable: true })
  sourceUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by', foreignKeyConstraintName: 'academic_calendar_events_created_by_fkey' })
  creator!: User | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by', foreignKeyConstraintName: 'academic_calendar_events_updated_by_fkey' })
  updater!: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
