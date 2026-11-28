import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity.js';
import type { TranscriptResult } from './transcript-entry.js';
import { NAME_MAX_LENGTH } from '../common/column-limits.js';

@Entity({ name: 'transcript_rows' })
@Index('ix_transcript_rows_user_id', ['userId'])
@Index('idx_transcript_rows_course_code', ['courseCode'])
@Check('ck_transcript_rows_course_code', `"course_code" ~ '^[A-Z0-9]{2,20}$'`)
@Check('ck_transcript_rows_credits', `"credits" BETWEEN 0 AND 30`)
@Check('ck_transcript_rows_result', `"result" IN ('graded', 'in_progress', 'exempt', 'pass', 'fail')`)
@Check('ck_transcript_rows_grade', `"grade" BETWEEN 0 AND 10`)
@Check('ck_transcript_rows_grade_iff_graded', `("result" = 'graded') = ("grade" IS NOT NULL)`)
@Check('ck_transcript_rows_term_year', `"term_year" BETWEEN 2000 AND 2100`)
@Check('ck_transcript_rows_term_number', `"term_number" IN (1, 2, 3)`)
export class TranscriptRow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'transcript_rows_user_id_fkey' })
  user!: User;

  @Column({ name: 'course_code', type: 'varchar', length: 20 })
  courseCode!: string;

  @Column({ name: 'course_name', type: 'varchar', length: NAME_MAX_LENGTH })
  courseName!: string;

  @Column({ type: 'smallint' })
  credits!: number;

  @Column({ type: 'varchar', length: 20 })
  result!: TranscriptResult;

  @Column({
    type: 'numeric',
    precision: 3,
    scale: 1,
    nullable: true,
    transformer: { to: (v: number | null) => v, from: (v: string | null) => (v === null ? null : Number(v)) },
  })
  grade!: number | null;

  @Column({ name: 'term_year', type: 'smallint' })
  termYear!: number;

  @Column({ name: 'term_number', type: 'smallint' })
  termNumber!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
